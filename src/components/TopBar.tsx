import { PhoneIncoming } from 'lucide-react';
import type { UniverseCategory } from '../data/characters';

interface TopBarProps {
  activeCategory: UniverseCategory;
  onSelectCategory: (category: UniverseCategory) => void;
  onTriggerSurpriseCall: () => void;
}

const HEADER_LINKS: Array<{ id: UniverseCategory; label: string }> = [
  { id: 'all', label: 'All Roster' },
  { id: 'skibidi', label: 'Skibidi' },
  { id: 'fairytale', label: 'Fairytale' },
  { id: 'memes', label: 'Memes' },
];

export function TopBar({
  activeCategory,
  onSelectCategory,
  onTriggerSurpriseCall,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0B0D12]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:gap-8 lg:px-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            onSelectCategory('all');
          }}
          className="font-display shrink-0 whitespace-nowrap text-xl font-bold tracking-tight text-white sm:text-2xl"
        >
          Skibidi Call Pad
        </a>

        {/* Zone 2: Clean Single-Line Nav Links */}
        <nav
          aria-label="Quick universe links"
          className="hidden items-center gap-6 text-sm font-medium md:flex"
        >
          {HEADER_LINKS.map((link) => {
            const isActive = activeCategory === link.id;
            return (
              <button
                key={link.id}
                type="button"
                onClick={() => onSelectCategory(link.id)}
                className={`shrink-0 whitespace-nowrap py-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-400 ${
                  isActive
                    ? 'text-white underline decoration-emerald-400 decoration-2 underline-offset-8'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {link.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <button
          type="button"
          onClick={onTriggerSurpriseCall}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-transform hover:bg-emerald-400 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
        >
          <PhoneIncoming className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Surprise Call</span>
        </button>
      </div>
    </header>
  );
}
