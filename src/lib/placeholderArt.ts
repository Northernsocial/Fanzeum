import type { CategorySlug } from '../config/categories';

export interface PlaceholderArtSpec {
  category: CategorySlug;
  title: string;
  subtitle?: string;
  year?: string;
  code?: string;
  grade?: string;
  accentSeed?: number;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncateText(str: string, max: number): string {
  const clean = str.trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

const PALETTES: Array<[string, string, string]> = [
  ['#1A2230', '#C9A45C', '#F4F1EA'],
  ['#241B2B', '#D4A857', '#F4F1EA'],
  ['#162624', '#86B89A', '#F4F1EA'],
  ['#2A1C1C', '#D68C6B', '#F4F1EA'],
  ['#1B2432', '#7BA2CC', '#F4F1EA'],
  ['#252218', '#C9A45C', '#F4F1EA'],
];

/**
 * Generates a compact (< 1,850 chars) category-native SVG data URL for copyrighted modern
 * cards, comics, records, boxed toys, and programmes so zero copyrighted photos are scraped
 * while every piece looks authentic in a collector cabinet.
 */
export function buildCollectorArtDataUrl(spec: PlaceholderArtSpec): string {
  const idx = Math.abs(spec.accentSeed ?? spec.title.length) % PALETTES.length;
  const [bg, accent] = PALETTES[idx];

  let svg = '';

  if (spec.category === 'football_cards' || spec.category === 'trading_cards') {
    // Trading / Football card silhouette: angled layered cards with foil shield emblem
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 480" width="720" height="960">
      <defs>
        <radialGradient id="cg" cx="50%" cy="45%" r="65%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.22"/>
          <stop offset="100%" stop-color="#101217" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="360" height="480" rx="16" fill="#12141A"/>
      <rect width="360" height="480" rx="16" fill="url(#cg)"/>
      <g transform="translate(180, 240)" fill="none" stroke="${accent}" stroke-linecap="round" stroke-linejoin="round">
        <rect x="-85" y="-120" width="170" height="240" rx="12" stroke-width="2.5" fill="#181B22" fill-opacity="0.7"/>
        <rect x="-70" y="-105" width="140" height="210" rx="8" stroke-width="1.2" stroke-opacity="0.5"/>
        <path d="M-36 -28 L0 -50 L36 -28 L36 14 C36 40 0 58 0 58 C0 58 -36 40 -36 14 Z" stroke-width="2" fill="${accent}" fill-opacity="0.18"/>
        <circle cx="0" cy="-6" r="12" stroke-width="1.5" stroke-opacity="0.8"/>
        <path d="M-55 76 L55 76" stroke-width="1.5" stroke-opacity="0.4"/>
      </g>
    </svg>`;
  } else if (spec.category === 'comics') {
    // Comic book silhouette: cover frame, title banner block, heroic portrait silhouette
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 500" width="720" height="1000">
      <defs>
        <radialGradient id="cmg" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#0F1014" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="360" height="500" rx="12" fill="#111318"/>
      <rect width="360" height="500" rx="12" fill="url(#cmg)"/>
      <g transform="translate(180, 250)" fill="none" stroke="${accent}" stroke-linecap="round" stroke-linejoin="round">
        <rect x="-95" y="-145" width="190" height="290" rx="8" stroke-width="2.5" fill="#171A21" fill-opacity="0.8"/>
        <rect x="-82" y="-132" width="46" height="52" rx="4" stroke-width="1.5" stroke-opacity="0.7"/>
        <rect x="-24" y="-132" width="106" height="30" rx="4" stroke-width="1.5" stroke-opacity="0.7" fill="${accent}" fill-opacity="0.15"/>
        <circle cx="0" cy="15" r="54" stroke-width="2" fill="${accent}" fill-opacity="0.12"/>
        <path d="M-22 36 L0 -14 L22 36 Z" stroke-width="2.5" stroke-linejoin="round"/>
        <line x1="-80" y1="95" x2="80" y2="95" stroke-width="1.5" stroke-opacity="0.4"/>
      </g>
    </svg>`;
  } else if (spec.category === 'vinyl') {
    // Vinyl record silhouette: concentric grooves and brass spindle centre
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" width="840" height="840">
      <rect width="420" height="420" rx="16" fill="#0D0E12"/>
      <g transform="translate(210, 210)" fill="none" stroke="${accent}" stroke-linecap="round">
        <circle cx="0" cy="0" r="168" fill="#14161C" stroke-width="3"/>
        <circle cx="0" cy="0" r="144" stroke-width="1.2" stroke-opacity="0.35"/>
        <circle cx="0" cy="0" r="120" stroke-width="1.2" stroke-opacity="0.35"/>
        <circle cx="0" cy="0" r="96" stroke-width="1.2" stroke-opacity="0.35"/>
        <circle cx="0" cy="0" r="66" fill="${accent}" fill-opacity="0.25" stroke-width="2.5"/>
        <circle cx="0" cy="0" r="18" fill="#0D0E12" stroke-width="2"/>
        <circle cx="0" cy="0" r="4" fill="${accent}" stroke="none"/>
      </g>
    </svg>`;
  } else if (spec.category === 'coins') {
    // Ancient / bullion coin silhouette: rim dentils and laurel wreath / profile medallion
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="800" height="800">
      <defs>
        <radialGradient id="cng" cx="45%" cy="40%" r="65%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#101115" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="400" height="400" rx="16" fill="#0F1014"/>
      <rect width="400" height="400" rx="16" fill="url(#cng)"/>
      <g transform="translate(200, 200)" fill="none" stroke="${accent}" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="0" cy="0" r="142" stroke-width="3.5" fill="#171A21" fill-opacity="0.75"/>
        <circle cx="0" cy="0" r="126" stroke-width="1.5" stroke-dasharray="5 5" stroke-opacity="0.7"/>
        <path d="M-42 32 C-60 6, -56 -36, -26 -60 C-2 -78, 32 -74, 52 -50" stroke-width="2" stroke-opacity="0.5"/>
        <path d="M-18 -15 C-12 -36, 12 -44, 28 -30 C44 -16, 40 10, 22 28 C4 46, -26 40, -32 20 Z" stroke-width="2" fill="${accent}" fill-opacity="0.2"/>
        <circle cx="0" cy="0" r="62" stroke-width="1.5" stroke-opacity="0.4"/>
      </g>
    </svg>`;
  } else if (spec.category === 'stamps') {
    // Stamp silhouette: perforated postage silhouette with classic profile medallion
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 440" width="760" height="880">
      <defs>
        <radialGradient id="stg" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#101116" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="380" height="440" rx="14" fill="#101217"/>
      <rect width="380" height="440" rx="14" fill="url(#stg)"/>
      <g transform="translate(190, 220)" fill="none" stroke="${accent}" stroke-linecap="round" stroke-linejoin="round">
        <rect x="-95" y="-125" width="190" height="250" rx="4" stroke-width="2.5" fill="#181B24" fill-opacity="0.8"/>
        <rect x="-80" y="-110" width="160" height="220" rx="2" stroke-width="1.2" stroke-opacity="0.5"/>
        <circle cx="0" cy="-6" r="54" stroke-width="2" fill="${accent}" fill-opacity="0.18"/>
        <path d="M-22 -14 C-14 -32, 14 -32, 22 -14 C28 4, 18 20, 0 30 C-18 20, -28 4, -22 -14 Z" stroke-width="1.8" stroke-opacity="0.8"/>
        <line x1="-50" y1="72" x2="50" y2="72" stroke-width="1.5" stroke-opacity="0.5"/>
      </g>
    </svg>`;
  } else {
    // Toys & memorabilia silhouette: display plinth / action figure cardback silhouette
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 460" width="800" height="920">
      <defs>
        <radialGradient id="tyg" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.22"/>
          <stop offset="100%" stop-color="#101116" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="400" height="460" rx="16" fill="#12141A"/>
      <rect width="400" height="460" rx="16" fill="url(#tyg)"/>
      <g transform="translate(200, 225)" fill="none" stroke="${accent}" stroke-linecap="round" stroke-linejoin="round">
        <rect x="-95" y="-135" width="190" height="270" rx="10" stroke-width="2.5" fill="#181B22" fill-opacity="0.75"/>
        <circle cx="0" cy="-115" r="6" stroke-width="2" fill="#12141A"/>
        <rect x="-65" y="-75" width="130" height="150" rx="8" stroke-width="1.8" fill="${accent}" fill-opacity="0.12"/>
        <circle cx="0" cy="-28" r="18" stroke-width="2" stroke-opacity="0.8"/>
        <path d="M-28 32 C-28 6, 28 6, 28 32 Z" stroke-width="2" stroke-opacity="0.8"/>
        <line x1="-70" y1="100" x2="70" y2="100" stroke-width="1.5" stroke-opacity="0.4"/>
      </g>
    </svg>`;
  }

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
