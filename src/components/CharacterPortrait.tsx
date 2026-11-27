import { useState } from 'react';
import { User } from 'lucide-react';
import type { CharacterProfile } from '../data/characters';

const ASSET_IMAGES = import.meta.glob('../assets/images/*.{jpg,png,webp}', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

function resolveCharacterImage(imagePath?: string): string | undefined {
  if (!imagePath) return undefined;
  const filename = imagePath.split('/').pop();
  if (!filename) return imagePath;
  const match = Object.entries(ASSET_IMAGES).find(([key]) =>
    key.endsWith(`/${filename}`)
  );
  return match ? match[1] : imagePath;
}

interface CharacterPortraitProps {
  character: CharacterProfile;
  className?: string;
  alt?: string;
}

function ShrekSvgPortrait({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" className={className} role="img" aria-label="Shrek">
      <defs>
        <radialGradient id="swampBg" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#3F6212" />
          <stop offset="100%" stopColor="#1A2E05" />
        </radialGradient>
        <radialGradient id="ogreSkin" cx="45%" cy="38%" r="60%">
          <stop offset="0%" stopColor="#A3E635" />
          <stop offset="70%" stopColor="#65A30D" />
          <stop offset="100%" stopColor="#3F6212" />
        </radialGradient>
      </defs>
      <rect width="400" height="400" fill="url(#swampBg)" />
      <rect x="0" y="0" width="26" height="400" fill="#291D12" opacity="0.55" />
      <rect x="374" y="0" width="26" height="400" fill="#291D12" opacity="0.55" />
      <circle cx="84" cy="86" r="46" fill="#BEF264" opacity="0.12" />
      <path d="M72 400 C82 300, 318 300, 328 400 Z" fill="#D6C7A9" />
      <path d="M98 400 L122 304 L168 320 L158 400 Z" fill="#5C3A21" />
      <path d="M302 400 L278 304 L232 320 L242 400 Z" fill="#5C3A21" />
      <rect x="160" y="258" width="80" height="62" rx="22" fill="#4D7C0F" />
      <path d="M114 176 L62 128 C52 118, 42 134, 56 148 L108 196 Z" fill="#65A30D" />
      <ellipse cx="56" cy="134" rx="14" ry="9" transform="rotate(-35 56 134)" fill="#365314" />
      <path d="M286 176 L338 128 C348 118, 358 134, 344 148 L292 196 Z" fill="#65A30D" />
      <ellipse cx="344" cy="134" rx="14" ry="9" transform="rotate(35 344 134)" fill="#365314" />
      <ellipse cx="200" cy="186" rx="94" ry="104" fill="url(#ogreSkin)" />
      <path d="M132 142 Q158 128 180 144" fill="none" stroke="#365314" strokeWidth="10" strokeLinecap="round" />
      <path d="M220 144 Q242 128 268 142" fill="none" stroke="#365314" strokeWidth="10" strokeLinecap="round" />
      <ellipse cx="160" cy="166" rx="19" ry="16" fill="#FFFFFF" />
      <ellipse cx="240" cy="166" rx="19" ry="16" fill="#FFFFFF" />
      <circle cx="162" cy="166" r="9" fill="#5C3A21" />
      <circle cx="238" cy="166" r="9" fill="#5C3A21" />
      <circle cx="164" cy="164" r="4" fill="#111827" />
      <circle cx="240" cy="164" r="4" fill="#111827" />
      <circle cx="166" cy="161" r="2.5" fill="#FFFFFF" />
      <circle cx="242" cy="161" r="2.5" fill="#FFFFFF" />
      <ellipse cx="200" cy="198" rx="28" ry="20" fill="#84CC16" stroke="#4D7C0F" strokeWidth="3" />
      <ellipse cx="188" cy="204" rx="5" ry="4" fill="#365314" />
      <ellipse cx="212" cy="204" rx="5" ry="4" fill="#365314" />
      <path d="M148 232 Q200 274 252 232 Q200 250 148 232 Z" fill="#451A03" />
      <path d="M162 238 Q200 250 238 238 L234 246 Q200 256 166 246 Z" fill="#FEF3C7" />
    </svg>
  );
}

function FionaSvgPortrait({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" className={className} role="img" aria-label="Fiona">
      <defs>
        <radialGradient id="castleBg" cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#14532D" />
          <stop offset="100%" stopColor="#052E16" />
        </radialGradient>
        <radialGradient id="fionaSkin" cx="46%" cy="38%" r="60%">
          <stop offset="0%" stopColor="#BEF264" />
          <stop offset="72%" stopColor="#84CC16" />
          <stop offset="100%" stopColor="#4D7C0F" />
        </radialGradient>
      </defs>
      <rect width="400" height="400" fill="url(#castleBg)" />
      <path d="M108 165 Q96 290 138 356 L262 356 Q304 290 292 165 Z" fill="#9A3412" />
      <path d="M84 400 C96 300, 304 300, 316 400 Z" fill="#047857" />
      <path d="M150 320 L200 358 L250 320" fill="none" stroke="#FBBF24" strokeWidth="5" />
      <rect x="172" y="256" width="56" height="58" rx="18" fill="#65A30D" />
      <path d="M118 182 L78 148 C70 140, 62 152, 74 162 L114 198 Z" fill="#84CC16" />
      <path d="M282 182 L322 148 C330 140, 338 152, 326 162 L286 198 Z" fill="#84CC16" />
      <ellipse cx="200" cy="186" rx="84" ry="94" fill="url(#fionaSkin)" />
      <path d="M114 176 C116 96, 284 96, 286 176 C262 132, 224 120, 200 132 C176 120, 138 132, 114 176 Z" fill="#B45309" />
      <path d="M164 106 L178 82 L200 98 L222 82 L236 106 Z" fill="#FBBF24" stroke="#F59E0B" strokeWidth="3" />
      <circle cx="200" cy="96" r="4.5" fill="#10B981" />
      <ellipse cx="164" cy="176" rx="16" ry="14" fill="#FFFFFF" />
      <ellipse cx="236" cy="176" rx="16" ry="14" fill="#FFFFFF" />
      <circle cx="166" cy="176" r="8" fill="#059669" />
      <circle cx="234" cy="176" r="8" fill="#059669" />
      <circle cx="166" cy="176" r="4" fill="#111827" />
      <circle cx="234" cy="176" r="4" fill="#111827" />
      <circle cx="169" cy="173" r="2.5" fill="#FFFFFF" />
      <circle cx="237" cy="173" r="2.5" fill="#FFFFFF" />
      <ellipse cx="200" cy="202" rx="15" ry="11" fill="#65A30D" />
      <path d="M166 230 Q200 258 234 230" fill="none" stroke="#365314" strokeWidth="6" strokeLinecap="round" />
      <path d="M174 232 Q200 250 226 232" fill="#FFFFFF" />
    </svg>
  );
}

export function CharacterPortrait({
  character,
  className = 'h-full w-full object-cover',
  alt,
}: CharacterPortraitProps) {
  const [imgError, setImgError] = useState(false);

  if (character.svgPortrait === 'shrek') {
    return <ShrekSvgPortrait className={className} />;
  }

  if (character.svgPortrait === 'fiona') {
    return <FionaSvgPortrait className={className} />;
  }

  const resolvedSrc = resolveCharacterImage(character.image);

  if (resolvedSrc && !imgError) {
    return (
      <img
        src={resolvedSrc}
        alt={alt ?? character.name}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className={className}
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-800 to-slate-950 p-4 text-center">
      <User className="h-12 w-12 text-slate-400" aria-hidden="true" />
      <span className="font-display text-sm font-semibold text-slate-200">
        {character.name}
      </span>
    </div>
  );
}
