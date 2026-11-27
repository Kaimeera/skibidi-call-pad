import { Video } from 'lucide-react';
import type { CharacterProfile } from '../data/characters';
import { CharacterPortrait } from './CharacterPortrait';

interface CharacterCardProps {
  character: CharacterProfile;
  onCall: (character: CharacterProfile) => void;
}

export function CharacterCard({ character, onCall }: CharacterCardProps) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#161922] transition-transform duration-150 hover:-translate-y-0.5 hover:border-white/20">
      <button
        type="button"
        onClick={() => onCall(character)}
        aria-label={`Start live AI video call with ${character.name}`}
        className="relative aspect-square w-full overflow-hidden bg-[#10131B] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
      >
        <CharacterPortrait
          character={character}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#161922] via-[#161922]/40 to-transparent"
        />
      </button>

      <div className="flex flex-1 flex-col justify-between gap-4 p-4">
        <div className="min-w-0">
          <h2 className="font-display truncate text-lg font-bold tracking-tight text-white">
            {character.name}
          </h2>
          <p className="mt-1 truncate text-xs text-slate-400">
            <span>{character.universeLabel}</span>
            <span aria-hidden="true" className="mx-1.5">
              ·
            </span>
            <span>{character.tagline}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => onCall(character)}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-500 hover:text-slate-950 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
        >
          <Video className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Video Call</span>
        </button>
      </div>
    </article>
  );
}
