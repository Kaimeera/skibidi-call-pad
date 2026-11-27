/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo, useState } from 'react';
import { ActiveCallScreen } from './components/ActiveCallScreen';
import { CharacterCard } from './components/CharacterCard';
import { TopBar } from './components/TopBar';
import {
  CHARACTERS,
  UNIVERSE_TABS,
  type CharacterProfile,
  type UniverseCategory,
} from './data/characters';
import { soundEngine } from './utils/soundEngine';

interface CallSession {
  character: CharacterProfile;
  mode: 'outgoing' | 'incoming';
}

interface RecentCallRecord {
  characterName: string;
  durationSec: number;
}

function formatShortTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function App() {
  const [activeCategory, setActiveCategory] = useState<UniverseCategory>('all');
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [lastCall, setLastCall] = useState<RecentCallRecord | null>(null);

  const visibleCharacters = useMemo(() => {
    if (activeCategory === 'all') return CHARACTERS;
    return CHARACTERS.filter((char) => char.universe === activeCategory);
  }, [activeCategory]);

  const handleStartCall = (character: CharacterProfile) => {
    soundEngine.unlockAudio();
    setActiveCall({ character, mode: 'outgoing' });
  };

  const handleSurpriseCall = () => {
    soundEngine.unlockAudio();
    const pool = visibleCharacters.length > 0 ? visibleCharacters : CHARACTERS;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    setActiveCall({ character: picked, mode: 'incoming' });
  };

  const handleCallCompleted = (characterName: string, durationSec: number) => {
    setLastCall({ characterName, durationSec });
  };

  return (
    <div id="top" className="min-h-dvh bg-[#0B0D12] text-[#F4F6FA]">
      <TopBar
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
        onTriggerSurpriseCall={handleSurpriseCall}
      />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <section className="mb-6 flex flex-col justify-between gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <h1 className="font-display text-balance text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Tap any character for a live AI video call
            </h1>
            <p className="mt-1.5 text-sm text-slate-400 sm:text-base">
              Talk out loud or type for two full minutesâ€”they answer, chat back in real time, and say bye-bye at the end.
            </p>
          </div>

          <div className="shrink-0 text-xs text-slate-400 lg:text-right">
            <span>{visibleCharacters.length} contacts</span>
            {lastCall && (
              <>
                <span aria-hidden="true" className="mx-2">
                  Â·
                </span>
                <span>
                  Last call: {lastCall.characterName}{' '}
                  <span className="font-mono-tabular text-slate-300">
                    ({formatShortTime(lastCall.durationSec)})
                  </span>
                </span>
              </>
            )}
          </div>
        </section>

        {/* Interactive Universe Filter Toolbar */}
        <section
          aria-label="Filter characters by universe"
          className="mb-6 flex items-center gap-1.5 overflow-x-auto rounded-xl bg-[#161922] p-1.5"
        >
          {UNIVERSE_TABS.map((tab) => {
            const isActive = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id)}
                className={`min-h-[42px] shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                  isActive
                    ? 'bg-emerald-500 font-semibold text-slate-950'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </section>

        <section aria-label="Call roster">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 lg:gap-5">
            {visibleCharacters.map((character) => (
              <CharacterCard
                key={character.id}
                character={character}
                onCall={handleStartCall}
              />
            ))}
          </div>
        </section>
      </main>

      {activeCall && (
        <ActiveCallScreen
          character={activeCall.character}
          initialMode={activeCall.mode}
          onClose={() => setActiveCall(null)}
          onCallCompleted={handleCallCompleted}
        />
      )}
    </div>
  );
}

