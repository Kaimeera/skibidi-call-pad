import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Hand,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  RotateCcw,
  Send,
  User,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { CharacterProfile } from '../data/characters';
import { LiveCallClient } from '../utils/liveCallClient';
import { soundEngine } from '../utils/soundEngine';
import { CharacterPortrait } from './CharacterPortrait';

export type CallPhase =
  | 'RINGING_OUTGOING'
  | 'RINGING_INCOMING'
  | 'CONNECTED'
  | 'ENDED';

const CALL_DURATION_SECONDS = 120;
const FAREWELL_TRIGGER_SECOND = 112;

interface ActiveCallScreenProps {
  character: CharacterProfile;
  initialMode: 'outgoing' | 'incoming';
  onClose: () => void;
  onCallCompleted: (characterName: string, durationSec: number) => void;
}

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function ActiveCallScreen({
  character,
  initialMode,
  onClose,
  onCallCompleted,
}: ActiveCallScreenProps) {
  const [phase, setPhase] = useState<CallPhase>(
    initialMode === 'incoming' ? 'RINGING_INCOMING' : 'RINGING_OUTGOING'
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [finalDuration, setFinalDuration] = useState(0);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [selfCamOn, setSelfCamOn] = useState(true);
  const [aiReady, setAiReady] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [characterCaption, setCharacterCaption] = useState('');
  const [userCaption, setUserCaption] = useState('');
  const [micStatus, setMicStatus] = useState<'pending' | 'active' | 'denied' | 'unavailable'>('pending');
  const [liveError, setLiveError] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');

  const liveClientRef = useRef<LiveCallClient | null>(null);
  const farewellSentRef = useRef(false);
  const speakerMutedRef = useRef(speakerMuted);
  const elapsedRef = useRef(elapsedSeconds);

  useEffect(() => {
    speakerMutedRef.current = speakerMuted;
  }, [speakerMuted]);

  useEffect(() => {
    elapsedRef.current = elapsedSeconds;
  }, [elapsedSeconds]);

  const stopLiveSession = useCallback(() => {
    if (liveClientRef.current) {
      liveClientRef.current.disconnect();
      liveClientRef.current = null;
    }
  }, []);

  const startLiveSession = useCallback(() => {
    stopLiveSession();
    setAiReady(false);
    setLiveError(null);
    setCharacterCaption('');
    setUserCaption('');
    setMicStatus('pending');

    const client = new LiveCallClient({
      onReady: () => {
        setAiReady(true);
      },
      onSpeakingChange: (speaking) => {
        setIsSpeaking(speaking);
      },
      onOutputTranscript: (text, append) => {
        setCharacterCaption((prev) => (append ? `${prev}${text}` : text));
      },
      onInputTranscript: (text) => {
        setUserCaption(text);
      },
      onMicStatusChange: (status) => {
        setMicStatus(status);
      },
      onError: (message) => {
        setLiveError(message);
      },
    });

    client.setMicMuted(micMuted);
    client.setSpeakerMuted(speakerMutedRef.current);
    liveClientRef.current = client;

    void client.connect({
      characterName: character.name,
      systemInstruction: character.systemInstruction,
      voiceName: character.liveVoiceName,
    });
  }, [
    character.liveVoiceName,
    character.name,
    character.systemInstruction,
    micMuted,
    stopLiveSession,
  ]);

  const connectCall = useCallback(() => {
    soundEngine.stopRingtone();
    soundEngine.playConnectChime(speakerMutedRef.current);
    farewellSentRef.current = false;
    setElapsedSeconds(0);
    elapsedRef.current = 0;
    setPhase('CONNECTED');
    startLiveSession();
  }, [startLiveSession]);

  const endCall = useCallback(
    (playedDuration?: number) => {
      soundEngine.stopAll();
      stopLiveSession();
      soundEngine.playHangupTone(speakerMutedRef.current);
      const duration = playedDuration ?? elapsedRef.current;
      setFinalDuration(duration);
      setIsSpeaking(false);
      setPhase('ENDED');
      onCallCompleted(character.name, duration);
    },
    [character.name, onCallCompleted, stopLiveSession]
  );

  // Ringing phase & auto-answer for outgoing calls
  useEffect(() => {
    if (phase !== 'RINGING_OUTGOING' && phase !== 'RINGING_INCOMING') {
      return;
    }

    const isIncoming = phase === 'RINGING_INCOMING';
    soundEngine.startRingtone(character.soundStyle, isIncoming, speakerMuted);

    let answerTimer: number | null = null;
    if (phase === 'RINGING_OUTGOING') {
      answerTimer = window.setTimeout(() => {
        connectCall();
      }, 2000);
    }

    return () => {
      soundEngine.stopRingtone();
      if (answerTimer !== null) {
        window.clearTimeout(answerTimer);
      }
    };
  }, [phase, character.soundStyle, speakerMuted, connectCall]);

  // 1-minute (60s) connected call countdown
  useEffect(() => {
    if (phase !== 'CONNECTED') return;

    const timerId = window.setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        elapsedRef.current = next;

        if (next === FAREWELL_TRIGGER_SECOND && !farewellSentRef.current) {
          farewellSentRef.current = true;
          liveClientRef.current?.sendTextMessage(
            'The 1-minute call is ending in a few seconds. Say "Bye bye!" in character now!'
          );
        }

        if (next >= CALL_DURATION_SECONDS) {
          window.clearInterval(timerId);
          window.setTimeout(() => {
            endCall(CALL_DURATION_SECONDS);
          }, 180);
          return CALL_DURATION_SECONDS;
        }

        return next;
      });
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [phase, endCall]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      soundEngine.stopAll();
      stopLiveSession();
    };
  }, [stopLiveSession]);

  const handleToggleSpeaker = () => {
    const nextMuted = !speakerMuted;
    setSpeakerMuted(nextMuted);
    liveClientRef.current?.setSpeakerMuted(nextMuted);
    if (nextMuted) {
      soundEngine.stopAll();
    }
  };

  const handleToggleMic = () => {
    const nextMicMuted = !micMuted;
    setMicMuted(nextMicMuted);
    liveClientRef.current?.setMicMuted(nextMicMuted);
  };

  const handleWavePrompt = () => {
    if (phase !== 'CONNECTED' || !aiReady) return;
    setUserCaption('Waved hello');
    liveClientRef.current?.sendTextMessage(
      'The caller just waved hello at the camera! React playfully in character.'
    );
  };

  const handleSendText = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = draftText.trim();
    if (!trimmed || phase !== 'CONNECTED' || !aiReady) return;
    setUserCaption(trimmed);
    liveClientRef.current?.sendTextMessage(trimmed);
    setDraftText('');
  };

  const handleRedial = () => {
    soundEngine.unlockAudio();
    farewellSentRef.current = false;
    setElapsedSeconds(0);
    setCharacterCaption('');
    setUserCaption('');
    setLiveError(null);
    setPhase('RINGING_OUTGOING');
  };

  const getPortraitMotionClass = () => {
    if (phase !== 'CONNECTED') return '';
    if (isSpeaking) return 'animate-face-talk';
    if (character.filterMode === 'horror') return 'animate-horror-twitch';
    return 'animate-face-breathe';
  };

  const remainingSeconds = Math.max(0, CALL_DURATION_SECONDS - elapsedSeconds);

  const getVoiceStatusLabel = () => {
    if (liveError) return 'Voice connection error';
    if (!aiReady) return 'Connecting AI voice...';
    if (isSpeaking) return `${character.name} speaking`;
    if (micStatus === 'active' && !micMuted) return 'Listening via mic';
    if (micStatus === 'denied' || micStatus === 'unavailable') {
      return 'Use text box or Say Hi';
    }
    return 'Mic muted';
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Video call with ${character.name}`}
      className="fixed inset-0 z-50 flex flex-col bg-[#080A0F] text-white"
    >
      {/* Top Android Call Status Strip */}
      <div className="relative z-20 flex items-center justify-between gap-4 border-b border-white/10 bg-[#0B0D12]/80 px-4 py-3 backdrop-blur-md sm:px-8">
        <div className="min-w-0">
          <h2 className="font-display truncate text-lg font-bold tracking-tight text-white sm:text-xl">
            {character.name}
          </h2>
          <p className="truncate text-xs text-slate-400">
            <span>{character.universeLabel}</span>
            {phase === 'CONNECTED' && (
              <>
                <span aria-hidden="true" className="mx-1.5">
                  ·
                </span>
                <span className={liveError ? 'text-red-400' : 'text-emerald-300'}>
                  {getVoiceStatusLabel()}
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          {phase === 'CONNECTED' && (
            <div className="text-right">
              <div className="font-mono-tabular text-base font-semibold text-emerald-400 sm:text-lg">
                {formatDuration(elapsedSeconds)}
              </div>
              <div className="font-mono-tabular text-[11px] text-slate-400">
                Ends in {remainingSeconds}s
              </div>
            </div>
          )}
          {phase === 'RINGING_OUTGOING' && (
            <span className="text-sm font-medium text-slate-300">Calling...</span>
          )}
          {phase === 'RINGING_INCOMING' && (
            <span className="text-sm font-medium text-emerald-400">
              Incoming Video Call
            </span>
          )}
          {phase === 'ENDED' && (
            <span className="text-sm font-medium text-slate-400">Call Ended</span>
          )}
        </div>
      </div>

      {/* Main Tablet Video Feed Viewport */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-3 sm:p-5">
        {(phase === 'RINGING_OUTGOING' || phase === 'RINGING_INCOMING') && (
          <div className="relative flex max-w-md flex-col items-center text-center">
            <div className="relative flex h-52 w-52 items-center justify-center sm:h-64 sm:w-64">
              <div
                aria-hidden="true"
                className="animate-ring-ripple absolute inset-0 rounded-full border-2 border-emerald-400/50"
              />
              <div
                aria-hidden="true"
                style={{ animationDelay: '0.55s' }}
                className="animate-ring-ripple absolute inset-0 rounded-full border-2 border-emerald-400/40"
              />
              <div className="relative h-44 w-44 overflow-hidden rounded-full border-4 border-white/15 bg-[#161922] shadow-2xl sm:h-52 sm:w-52">
                <CharacterPortrait
                  character={character}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>

            <h3 className="font-display mt-6 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {character.name}
            </h3>
            <p className="mt-2 text-sm text-slate-300">
              {phase === 'RINGING_INCOMING'
                ? `${character.name} wants to talk on live video...`
                : 'Connecting 1-minute AI voice call...'}
            </p>
          </div>
        )}

        {phase === 'CONNECTED' && (
          <div className="relative flex h-full w-full max-w-5xl items-center justify-center overflow-hidden rounded-3xl border border-white/15 bg-[#11141D] shadow-2xl">
            {/* Ambient blurred backdrop */}
            <div className="pointer-events-none absolute inset-0 scale-125 opacity-30 blur-2xl">
              <CharacterPortrait
                character={character}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>

            {/* Main Animated Character Face Stage */}
            <div className="relative flex h-full w-full items-center justify-center overflow-hidden">
              <CharacterPortrait
                character={character}
                className={`h-full max-h-full w-full max-w-2xl object-cover sm:object-contain ${getPortraitMotionClass()}`}
              />

              {character.filterMode === 'crt' && (
                <div
                  aria-hidden="true"
                  className="crt-scanlines pointer-events-none absolute inset-0 opacity-65"
                />
              )}
              {character.filterMode === 'horror' && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.82)_100%)]"
                />
              )}
              {character.filterMode === 'stage' && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(244,114,182,0.16),transparent_60%)]"
                />
              )}

              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/90 via-black/50 to-transparent"
              />
            </div>

            {/* Picture-in-Picture Player Tablet Cam */}
            {selfCamOn && (
              <div className="absolute right-4 top-4 flex h-28 w-24 flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-[#181C28]/90 shadow-lg backdrop-blur-md sm:h-36 sm:w-28">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-slate-200">
                  <User className="h-6 w-6" aria-hidden="true" />
                </div>
                <span className="mt-2 text-xs font-medium text-slate-300">
                  You
                </span>
              </div>
            )}

            {/* Live AI Error Alert (never masked) */}
            {liveError && (
              <div className="absolute inset-x-4 top-4 flex justify-center sm:inset-x-auto sm:left-4">
                <div className="flex max-w-md items-start gap-2.5 rounded-2xl border border-red-400/30 bg-red-950/90 px-4 py-3 text-left text-xs text-red-100 backdrop-blur-md sm:text-sm">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
                  <span>{liveError}</span>
                </div>
              </div>
            )}

            {/* Live Voice Captions */}
            {(characterCaption || userCaption) && (
              <div className="absolute inset-x-4 bottom-4 flex flex-col items-center gap-2 sm:inset-x-10">
                {userCaption && (
                  <p className="max-w-lg rounded-xl bg-black/60 px-3.5 py-1.5 text-center text-xs text-slate-300 backdrop-blur-md">
                    You: “{userCaption}”
                  </p>
                )}
                {characterCaption && (
                  <div className="max-w-2xl rounded-2xl border border-white/15 bg-black/80 px-5 py-3 text-center backdrop-blur-md">
                    <p className="text-base font-semibold text-white sm:text-lg">
                      “{characterCaption}”
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {phase === 'ENDED' && (
          <div className="flex w-full max-w-md flex-col items-center rounded-3xl border border-white/10 bg-[#161922] p-8 text-center shadow-2xl">
            <div className="h-28 w-28 overflow-hidden rounded-full border-2 border-white/15 bg-[#0B0D12]">
              <CharacterPortrait
                character={character}
                className="h-full w-full object-cover opacity-85"
              />
            </div>

            <h3 className="font-display mt-5 text-2xl font-bold text-white">
              {character.name}
            </h3>
            <p className="mt-1.5 text-sm text-slate-400">
              <span>Call Ended</span>
              <span aria-hidden="true" className="mx-1.5">
                ·
              </span>
              <span className="font-mono-tabular text-slate-200">
                {formatDuration(finalDuration)}
              </span>
            </p>

            <div className="mt-7 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleRedial}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition-transform hover:bg-emerald-400 active:scale-[0.98]"
              >
                <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Call Again</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-[48px] items-center justify-center whitespace-nowrap rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10 active:scale-[0.98]"
              >
                Back to Roster
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Android Tablet Call Action Dock */}
      {phase !== 'ENDED' && (
        <div className="relative z-20 border-t border-white/10 bg-[#0B0D12]/95 px-4 py-3 backdrop-blur-md sm:py-4">
          {phase === 'RINGING_INCOMING' && (
            <div className="mx-auto flex max-w-md items-center justify-center gap-8 py-1">
              <button
                type="button"
                onClick={() => endCall(0)}
                aria-label="Decline call"
                className="flex min-h-[56px] min-w-[132px] items-center justify-center gap-2.5 rounded-full bg-red-600 px-6 py-3 text-base font-semibold text-white shadow-lg transition-transform hover:bg-red-500 active:scale-[0.96]"
              >
                <PhoneOff className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>Decline</span>
              </button>
              <button
                type="button"
                onClick={connectCall}
                aria-label="Answer call"
                className="flex min-h-[56px] min-w-[132px] items-center justify-center gap-2.5 rounded-full bg-emerald-500 px-6 py-3 text-base font-semibold text-slate-950 shadow-lg transition-transform hover:bg-emerald-400 active:scale-[0.96]"
              >
                <Phone className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>Answer</span>
              </button>
            </div>
          )}

          {phase === 'RINGING_OUTGOING' && (
            <div className="mx-auto flex max-w-md items-center justify-center py-1">
              <button
                type="button"
                onClick={() => endCall(0)}
                aria-label="Cancel call"
                className="flex min-h-[56px] min-w-[160px] items-center justify-center gap-2.5 rounded-full bg-red-600 px-7 py-3 text-base font-semibold text-white shadow-lg transition-transform hover:bg-red-500 active:scale-[0.96]"
              >
                <PhoneOff className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>Hang Up</span>
              </button>
            </div>
          )}

          {phase === 'CONNECTED' && (
            <div className="mx-auto flex max-w-4xl flex-col gap-3">
              {/* Live conversation text bar (for quiet rooms or typing prompts alongside voice) */}
              <form
                onSubmit={handleSendText}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  disabled={!aiReady}
                  placeholder={
                    aiReady
                      ? `Talk with your mic or type a message to ${character.name}...`
                      : 'Connecting AI voice conversation...'
                  }
                  className="min-h-[44px] flex-1 rounded-xl border border-white/10 bg-[#161922] px-4 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!aiReady || !draftText.trim()}
                  aria-label="Send message"
                  className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                </button>
              </form>

              <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4">
                <button
                  type="button"
                  onClick={handleToggleMic}
                  aria-label={micMuted ? 'Unmute microphone' : 'Mute microphone'}
                  className={`flex min-h-[48px] items-center gap-2 whitespace-nowrap rounded-2xl px-4 py-2.5 text-sm font-semibold transition-colors active:scale-[0.97] ${
                    micMuted
                      ? 'border border-amber-400/30 bg-amber-500/20 text-amber-300'
                      : 'bg-[#1A1F2B] text-slate-200 hover:bg-[#232938]'
                  }`}
                >
                  {micMuted ? (
                    <MicOff className="h-4 w-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <Mic className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                  )}
                  <span>{micMuted ? 'Mic Off' : 'Mic On'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleSpeaker}
                  aria-label={speakerMuted ? 'Unmute speaker' : 'Mute speaker'}
                  className={`flex min-h-[48px] items-center gap-2 whitespace-nowrap rounded-2xl px-4 py-2.5 text-sm font-semibold transition-colors active:scale-[0.97] ${
                    speakerMuted
                      ? 'border border-amber-400/30 bg-amber-500/20 text-amber-300'
                      : 'bg-[#1A1F2B] text-slate-200 hover:bg-[#232938]'
                  }`}
                >
                  {speakerMuted ? (
                    <VolumeX className="h-4 w-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <Volume2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  )}
                  <span>{speakerMuted ? 'Muted' : 'Speaker'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleWavePrompt}
                  disabled={!aiReady || elapsedSeconds >= FAREWELL_TRIGGER_SECOND - 1}
                  className="flex min-h-[48px] items-center gap-2 whitespace-nowrap rounded-2xl bg-[#1A1F2B] px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-[#232938] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Hand className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                  <span>Say Hi</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelfCamOn((v) => !v)}
                  aria-label={selfCamOn ? 'Hide self camera' : 'Show self camera'}
                  className="flex min-h-[48px] items-center gap-2 whitespace-nowrap rounded-2xl bg-[#1A1F2B] px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-[#232938] active:scale-[0.97]"
                >
                  {selfCamOn ? (
                    <Video className="h-4 w-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <VideoOff className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  )}
                  <span>{selfCamOn ? 'Cam On' : 'Cam Off'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => endCall()}
                  aria-label="Hang up call"
                  className="flex min-h-[48px] min-w-[136px] items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-red-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-transform hover:bg-red-500 active:scale-[0.97]"
                >
                  <PhoneOff className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Hang Up</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
