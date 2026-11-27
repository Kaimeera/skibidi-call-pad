import type { LiveVoiceName } from '../data/characters';

export interface LiveCallCallbacks {
  onReady: () => void;
  onSpeakingChange: (speaking: boolean) => void;
  onOutputTranscript: (text: string, append: boolean) => void;
  onInputTranscript: (text: string) => void;
  onError: (message: string) => void;
  onMicStatusChange: (status: 'active' | 'denied' | 'unavailable') => void;
}

function int16ToBase64(pcm16: Int16Array): string {
  const bytes = new Uint8Array(pcm16.buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i += 1) {
    float32[i] = int16[i] / 32768;
  }
  return float32;
}

function resampleTo16k(
  input: Float32Array,
  sourceRate: number
): Int16Array {
  if (sourceRate === 16000) {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i += 1) {
      const clamped = Math.max(-1, Math.min(1, input[i]));
      out[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    }
    return out;
  }

  const ratio = sourceRate / 16000;
  const targetLen = Math.max(1, Math.floor(input.length / ratio));
  const out = new Int16Array(targetLen);
  for (let i = 0; i < targetLen; i += 1) {
    const srcIdx = i * ratio;
    const idx0 = Math.floor(srcIdx);
    const idx1 = Math.min(input.length - 1, idx0 + 1);
    const frac = srcIdx - idx0;
    const sample = input[idx0] * (1 - frac) + input[idx1] * frac;
    const clamped = Math.max(-1, Math.min(1, sample));
    out[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return out;
}

export class LiveCallClient {
  private ws: WebSocket | null = null;
  private inputCtx: AudioContext | null = null;
  private outputCtx: AudioContext | null = null;
  private outputGain: GainNode | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private activeSources = new Set<AudioBufferSourceNode>();
  private nextStartTime = 0;
  private micMuted = false;
  private speakerMuted = false;
  private closed = false;
  private isReady = false;
  private turnActive = false;

  private callbacks: LiveCallCallbacks;

  constructor(callbacks: LiveCallCallbacks) {
    this.callbacks = callbacks;
  }

  public async connect(params: {
    characterName: string;
    systemInstruction: string;
    voiceName: LiveVoiceName;
  }): Promise<void> {
    this.closed = false;
    this.isReady = false;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;

    this.outputCtx = new AudioCtx({ sampleRate: 24000 });
    this.outputGain = this.outputCtx.createGain();
    this.outputGain.gain.value = this.speakerMuted ? 0 : 1;
    this.outputGain.connect(this.outputCtx.destination);
    if (this.outputCtx.state === 'suspended') {
      void this.outputCtx.resume().catch(() => {});
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/api/live-call`;
    const ws = new WebSocket(wsUrl);
    this.ws = ws;

    ws.onopen = () => {
      if (this.closed) {
        ws.close();
        return;
      }
      ws.send(
        JSON.stringify({
          type: 'start',
          characterName: params.characterName,
          systemInstruction: params.systemInstruction,
          voiceName: params.voiceName,
        })
      );
    };

    ws.onmessage = (event) => {
      if (this.closed) return;
      let msg: {
        type: string;
        data?: string;
        text?: string;
        message?: string;
      };
      try {
        msg = JSON.parse(event.data as string);
      } catch {
        return;
      }

      if (msg.type === 'ready') {
        this.isReady = true;
        this.callbacks.onReady();
        void this.startMicrophone();
      } else if (msg.type === 'audio' && msg.data) {
        this.enqueueOutputAudio(msg.data);
      } else if (msg.type === 'outputTranscript' && msg.text) {
        const shouldAppend = this.turnActive;
        this.turnActive = true;
        this.callbacks.onOutputTranscript(msg.text, shouldAppend);
      } else if (msg.type === 'inputTranscript' && msg.text) {
        this.callbacks.onInputTranscript(msg.text);
      } else if (msg.type === 'interrupted') {
        this.clearOutputQueue();
        this.turnActive = false;
        this.callbacks.onSpeakingChange(false);
      } else if (msg.type === 'turnComplete') {
        this.turnActive = false;
      } else if (msg.type === 'error' && msg.message) {
        this.callbacks.onError(msg.message);
      }
    };

    ws.onerror = () => {
      if (!this.closed) {
        this.callbacks.onError('Unable to reach the live voice server.');
      }
    };
  }

  private async startMicrophone(): Promise<void> {
    if (
      this.closed ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      this.callbacks.onMicStatusChange('unavailable');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (this.closed) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      this.mediaStream = stream;
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;

      const inputCtx = new AudioCtx({ sampleRate: 16000 });
      this.inputCtx = inputCtx;
      if (inputCtx.state === 'suspended') {
        void inputCtx.resume().catch(() => {});
      }

      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      this.sourceNode = source;
      this.processor = processor;

      processor.onaudioprocess = (e) => {
        if (
          this.closed ||
          this.micMuted ||
          !this.isReady ||
          !this.ws ||
          this.ws.readyState !== WebSocket.OPEN
        ) {
          return;
        }
        const raw = e.inputBuffer.getChannelData(0);
        const pcm16 = resampleTo16k(raw, inputCtx.sampleRate);
        const b64 = int16ToBase64(pcm16);
        this.ws.send(JSON.stringify({ type: 'audio', audio: b64 }));
      };

      source.connect(processor);
      processor.connect(inputCtx.destination);
      this.callbacks.onMicStatusChange('active');
    } catch {
      this.callbacks.onMicStatusChange('denied');
    }
  }

  private enqueueOutputAudio(base64Pcm: string): void {
    const ctx = this.outputCtx;
    const gain = this.outputGain;
    if (!ctx || !gain || this.closed) return;

    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }

    const float32 = base64ToFloat32(base64Pcm);
    if (float32.length === 0) return;

    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(new Float32Array(float32), 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);

    const now = ctx.currentTime;
    if (this.nextStartTime < now + 0.02) {
      this.nextStartTime = now + 0.04;
    }

    const startTime = this.nextStartTime;
    this.nextStartTime += buffer.duration;

    this.activeSources.add(source);
    this.callbacks.onSpeakingChange(true);

    source.onended = () => {
      this.activeSources.delete(source);
      if (this.activeSources.size === 0 && !this.closed) {
        this.callbacks.onSpeakingChange(false);
      }
    };

    source.start(startTime);
  }

  private clearOutputQueue(): void {
    for (const src of this.activeSources) {
      try {
        src.stop();
      } catch {
        // Ignore already stopped source
      }
    }
    this.activeSources.clear();
    if (this.outputCtx) {
      this.nextStartTime = this.outputCtx.currentTime;
    }
  }

  public sendTextMessage(text: string): void {
    if (
      this.closed ||
      !this.isReady ||
      !this.ws ||
      this.ws.readyState !== WebSocket.OPEN
    ) {
      return;
    }
    this.ws.send(JSON.stringify({ type: 'text', text }));
  }

  public setMicMuted(muted: boolean): void {
    this.micMuted = muted;
  }

  public setSpeakerMuted(muted: boolean): void {
    this.speakerMuted = muted;
    if (this.outputGain && this.outputCtx) {
      this.outputGain.gain.setValueAtTime(
        muted ? 0 : 1,
        this.outputCtx.currentTime
      );
    }
  }

  public disconnect(): void {
    this.closed = true;
    this.isReady = false;
    this.clearOutputQueue();

    if (this.processor) {
      this.processor.onaudioprocess = null;
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.inputCtx) {
      void this.inputCtx.close().catch(() => {});
      this.inputCtx = null;
    }
    if (this.outputCtx) {
      void this.outputCtx.close().catch(() => {});
      this.outputCtx = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // Ignore close errors
      }
      this.ws = null;
    }
  }
}
