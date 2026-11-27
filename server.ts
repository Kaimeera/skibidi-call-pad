import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

type VoiceName = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';

interface StartPayload {
  type: 'start';
  characterName?: string;
  systemInstruction?: string;
  voiceName?: VoiceName;
}

interface AudioPayload {
  type: 'audio';
  audio: string;
}

interface TextPayload {
  type: 'text';
  text: string;
}

type ClientMessage = StartPayload | AudioPayload | TextPayload;

const VALID_VOICES = new Set<VoiceName>([
  'Puck',
  'Charon',
  'Kore',
  'Fenrir',
  'Zephyr',
]);

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, hasApiKey: Boolean(process.env.GEMINI_API_KEY) });
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/api/live-call' });

  wss.on('connection', (clientWs: WebSocket) => {
    let liveSession: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null =
      null;
    let isClosing = false;

    const sendToClient = (payload: Record<string, unknown>) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    };

    const closeSession = () => {
      if (isClosing) return;
      isClosing = true;
      if (liveSession) {
        try {
          liveSession.close();
        } catch {
          // Ignore close errors
        }
        liveSession = null;
      }
    };

    clientWs.on('message', async (rawData) => {
      let parsed: ClientMessage;
      try {
        parsed = JSON.parse(rawData.toString()) as ClientMessage;
      } catch {
        return;
      }

      if (parsed.type === 'start') {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          sendToClient({
            type: 'error',
            message:
              'GEMINI_API_KEY is missing. Configure it in Settings > Secrets to enable live AI voice calls.',
          });
          return;
        }

        const voiceName: VoiceName =
          parsed.voiceName && VALID_VOICES.has(parsed.voiceName)
            ? parsed.voiceName
            : 'Puck';

        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        try {
          const session = await ai.live.connect({
            model: 'gemini-3.8-live',
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName },
                },
              },
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              systemInstruction:
                parsed.systemInstruction ||
                'You are a playful video call character. Keep replies short, natural, and fun.',
            },
            callbacks: {
              onmessage: (message: LiveServerMessage) => {
                const content = message.serverContent;
                for (const part of content?.modelTurn?.parts ?? []) {
                  if (part.inlineData?.data) {
                    sendToClient({
                      type: 'audio',
                      data: part.inlineData.data,
                    });
                  }
                }
                if (content?.outputTranscription?.text) {
                  sendToClient({
                    type: 'outputTranscript',
                    text: content.outputTranscription.text,
                  });
                }
                if (content?.inputTranscription?.text) {
                  sendToClient({
                    type: 'inputTranscript',
                    text: content.inputTranscription.text,
                  });
                }
                if (content?.interrupted) {
                  sendToClient({ type: 'interrupted' });
                }
                if (content?.turnComplete) {
                  sendToClient({ type: 'turnComplete' });
                }
              },
              onerror: (err: unknown) => {
                const msg =
                  err instanceof Error ? err.message : 'Live API connection error';
                sendToClient({ type: 'error', message: msg });
              },
              onclose: () => {
                if (!isClosing) {
                  sendToClient({ type: 'closed' });
                }
              },
            },
          });

          if (isClosing || clientWs.readyState !== WebSocket.OPEN) {
            session.close();
            return;
          }

          liveSession = session;
          sendToClient({ type: 'ready' });

          // Trigger the opening "Hello" greeting right as the call connects
          session.sendRealtimeInput({
            text: `The 1-minute video call with ${parsed.characterName ?? 'you'} just connected! Answer right away by saying hello in character in one short playful sentence.`,
          });
        } catch (err) {
          const message =
            err instanceof Error
              ? err.message
              : 'Failed to connect to Gemini Live API.';
          sendToClient({ type: 'error', message });
        }
        return;
      }

      if (!liveSession) return;

      if (parsed.type === 'audio' && parsed.audio) {
        try {
          liveSession.sendRealtimeInput({
            audio: {
              data: parsed.audio,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        } catch {
          // Ignore transient stream send errors during teardown
        }
      } else if (parsed.type === 'text' && parsed.text) {
        try {
          liveSession.sendRealtimeInput({
            text: parsed.text,
          });
        } catch {
          // Ignore transient send errors
        }
      }
    });

    clientWs.on('close', closeSession);
    clientWs.on('error', closeSession);
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
