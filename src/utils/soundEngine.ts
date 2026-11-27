import type { SoundStyle } from '../data/characters';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private ringInterval: number | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlockAudio(): void {
    this.ensureContext();
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.14,
    delay = 0,
    endFreq?: number
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public startRingtone(style: SoundStyle, incoming: boolean, muted: boolean): void {
    this.stopRingtone();
    if (muted) return;

    const playBurst = () => {
      if (incoming) {
        if (style === 'horror') {
          this.playTone(392, 0.28, 'triangle', 0.12, 0);
          this.playTone(370, 0.35, 'triangle', 0.12, 0.3);
        } else if (style === 'idol') {
          this.playTone(587.33, 0.14, 'sine', 0.13, 0);
          this.playTone(739.99, 0.14, 'sine', 0.13, 0.15);
          this.playTone(880, 0.24, 'sine', 0.13, 0.3);
        } else {
          this.playTone(659.25, 0.16, 'sine', 0.14, 0);
          this.playTone(880, 0.22, 'sine', 0.14, 0.18);
          this.playTone(659.25, 0.16, 'sine', 0.14, 0.44);
          this.playTone(880, 0.22, 'sine', 0.14, 0.62);
        }
      } else {
        // Outgoing Android dial ringback
        this.playTone(440, 0.55, 'sine', 0.08, 0);
        this.playTone(480, 0.55, 'sine', 0.08, 0);
      }
    };

    playBurst();
    this.ringInterval = window.setInterval(playBurst, incoming ? 1400 : 1800);
  }

  public stopRingtone(): void {
    if (this.ringInterval !== null) {
      window.clearInterval(this.ringInterval);
      this.ringInterval = null;
    }
  }

  public playConnectChime(muted: boolean): void {
    if (muted) return;
    this.playTone(523.25, 0.11, 'sine', 0.13, 0);
    this.playTone(783.99, 0.18, 'sine', 0.14, 0.09);
  }

  public playHangupTone(muted: boolean): void {
    if (muted) return;
    this.playTone(480, 0.14, 'sine', 0.14, 0, 320);
    this.playTone(300, 0.22, 'sine', 0.12, 0.13, 180);
  }

  public playCharacterStinger(style: SoundStyle, muted: boolean): void {
    if (muted) return;

    switch (style) {
      case 'skibidi':
        this.playTone(196, 0.1, 'square', 0.09, 0.05);
        this.playTone(246.94, 0.1, 'square', 0.09, 0.17);
        this.playTone(293.66, 0.12, 'square', 0.09, 0.29);
        this.playTone(392, 0.18, 'square', 0.09, 0.43);
        break;
      case 'robot':
        this.playTone(140, 0.25, 'sawtooth', 0.08, 0.05, 95);
        this.playTone(620, 0.09, 'square', 0.06, 0.18);
        break;
      case 'idol':
        this.playTone(523.25, 0.12, 'triangle', 0.11, 0.04);
        this.playTone(659.25, 0.12, 'triangle', 0.11, 0.14);
        this.playTone(783.99, 0.12, 'triangle', 0.11, 0.24);
        this.playTone(1046.5, 0.25, 'triangle', 0.12, 0.34);
        break;
      case 'horror':
        this.playTone(110, 0.65, 'sawtooth', 0.09, 0.02, 78);
        this.playTone(116.54, 0.65, 'triangle', 0.09, 0.02, 82);
        break;
      case 'opera':
        this.playTone(587.33, 0.14, 'sine', 0.11, 0.05);
        this.playTone(739.99, 0.14, 'sine', 0.11, 0.19);
        this.playTone(880, 0.3, 'sine', 0.12, 0.33);
        break;
      case 'meme':
      default:
        this.playTone(330, 0.09, 'triangle', 0.11, 0.04);
        this.playTone(494, 0.14, 'triangle', 0.12, 0.14);
        break;
    }
  }

  public speakLine(
    text: string,
    voiceConfig: { pitch: number; rate: number },
    muted: boolean
  ): void {
    if (muted || typeof window === 'undefined') return;

    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.pitch = Math.min(2, Math.max(0.4, voiceConfig.pitch));
        utterance.rate = Math.min(1.6, Math.max(0.6, voiceConfig.rate));
        utterance.volume = 0.95;

        const voices = window.speechSynthesis.getVoices();
        const englishVoice =
          voices.find((v) => v.lang.startsWith('en') && v.localService) ||
          voices.find((v) => v.lang.startsWith('en'));
        if (englishVoice) {
          utterance.voice = englishVoice;
        }

        window.speechSynthesis.speak(utterance);
        return;
      } catch {
        // Fallback below if speechSynthesis throws
      }
    }

    // Subtle vocal-cadence synth fallback
    this.playTone(260 * voiceConfig.pitch, 0.12, 'triangle', 0.08, 0);
    this.playTone(320 * voiceConfig.pitch, 0.14, 'triangle', 0.08, 0.14);
  }

  public stopSpeech(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  public stopAll(): void {
    this.stopRingtone();
    this.stopSpeech();
  }
}

export const soundEngine = new SoundEngine();
