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
  const [bg, accent, fg] = PALETTES[idx];
  const t1 = escapeXml(truncateText(spec.title, 34));
  const sub = escapeXml(truncateText(spec.subtitle || '', 36));
  const yr = escapeXml(truncateText(spec.year || '', 12));
  const code = escapeXml(truncateText(spec.code || '', 18));
  const grade = escapeXml(truncateText(spec.grade || '', 18));

  let svg = '';

  if (spec.category === 'football_cards' || spec.category === 'trading_cards') {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 480" width="720" height="960"><rect width="360" height="480" rx="18" fill="#13151A"/><rect x="16" y="16" width="328" height="58" rx="8" fill="#1E2128" stroke="${accent}" stroke-width="1.5"/><text x="30" y="39" fill="${accent}" font-family="monospace" font-size="11" font-weight="700">${yr} · ${code}</text><text x="330" y="54" text-anchor="end" fill="${fg}" font-family="monospace" font-size="14" font-weight="700">${grade}</text><rect x="24" y="88" width="312" height="364" rx="12" fill="${bg}" stroke="${accent}" stroke-width="2"/><circle cx="180" cy="230" r="76" fill="none" stroke="${accent}" stroke-opacity="0.35" stroke-width="1.5"/><path d="M140 255 L180 175 L220 255 Z" fill="none" stroke="${accent}" stroke-width="2"/><text x="180" y="368" text-anchor="middle" fill="${fg}" font-family="Georgia,serif" font-size="17" font-weight="600">${t1}</text><text x="180" y="395" text-anchor="middle" fill="${accent}" font-family="sans-serif" font-size="12">${sub}</text></svg>`;
  } else if (spec.category === 'comics') {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 500" width="720" height="1000"><rect width="360" height="500" fill="${bg}"/><rect x="12" y="12" width="336" height="476" fill="none" stroke="${accent}" stroke-width="2"/><rect x="12" y="12" width="68" height="82" fill="#13151A" stroke="${accent}" stroke-width="1.5"/><text x="46" y="44" text-anchor="middle" fill="${accent}" font-family="monospace" font-size="11">${yr}</text><text x="46" y="72" text-anchor="middle" fill="${fg}" font-family="monospace" font-size="15" font-weight="700">${code}</text><text x="214" y="56" text-anchor="middle" fill="${fg}" font-family="Georgia,serif" font-size="19" font-weight="700">${sub}</text><line x1="80" y1="94" x2="348" y2="94" stroke="${accent}" stroke-width="1.5"/><circle cx="180" cy="260" r="84" fill="#13151A" stroke="${accent}" stroke-width="2"/><text x="180" y="266" text-anchor="middle" fill="${accent}" font-family="monospace" font-size="18" font-weight="700">${grade}</text><text x="180" y="424" text-anchor="middle" fill="${fg}" font-family="Georgia,serif" font-size="16" font-weight="600">${t1}</text></svg>`;
  } else if (spec.category === 'vinyl') {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 420" width="840" height="840"><rect width="420" height="420" fill="${bg}"/><circle cx="210" cy="210" r="182" fill="#0F1014" stroke="#2A2E37" stroke-width="2"/><circle cx="210" cy="210" r="142" fill="none" stroke="#232730" stroke-width="1"/><circle cx="210" cy="210" r="104" fill="none" stroke="#232730" stroke-width="1"/><circle cx="210" cy="210" r="74" fill="${accent}"/><circle cx="210" cy="210" r="12" fill="#0F1014"/><text x="210" y="182" text-anchor="middle" fill="#0E0F12" font-family="monospace" font-size="10" font-weight="700">${code} · ${yr}</text><text x="210" y="246" text-anchor="middle" fill="#0E0F12" font-family="Georgia,serif" font-size="11" font-weight="700">${sub}</text><rect x="20" y="356" width="380" height="44" rx="6" fill="#13151A" fill-opacity="0.9"/><text x="210" y="383" text-anchor="middle" fill="${fg}" font-family="Georgia,serif" font-size="15">${t1}</text></svg>`;
  } else if (spec.category === 'coins') {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="800" height="800"><rect width="400" height="400" fill="#121419"/><circle cx="200" cy="186" r="128" fill="${bg}" stroke="${accent}" stroke-width="4"/><circle cx="200" cy="186" r="114" fill="none" stroke="${accent}" stroke-dasharray="4 4" stroke-width="1.5"/><text x="200" y="168" text-anchor="middle" fill="${accent}" font-family="Georgia,serif" font-size="22" font-weight="700">${yr}</text><text x="200" y="198" text-anchor="middle" fill="${fg}" font-family="monospace" font-size="13">${code}</text><text x="200" y="224" text-anchor="middle" fill="${accent}" font-family="monospace" font-size="12">${grade}</text><text x="200" y="356" text-anchor="middle" fill="${fg}" font-family="Georgia,serif" font-size="15">${t1}</text></svg>`;
  } else if (spec.category === 'stamps') {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 440" width="760" height="880"><rect width="380" height="440" fill="#121419"/><rect x="52" y="42" width="276" height="336" fill="#F4F1EA"/><rect x="68" y="58" width="244" height="304" fill="${bg}" stroke="${accent}" stroke-width="2"/><text x="190" y="102" text-anchor="middle" fill="${accent}" font-family="Georgia,serif" font-size="15" font-weight="700">${sub}</text><text x="190" y="214" text-anchor="middle" fill="${fg}" font-family="Georgia,serif" font-size="26" font-weight="700">${yr}</text><text x="190" y="252" text-anchor="middle" fill="${accent}" font-family="monospace" font-size="14">${code}</text><text x="190" y="330" text-anchor="middle" fill="${fg}" font-family="sans-serif" font-size="13">${t1}</text></svg>`;
  } else {
    // toys & memorabilia plinth / cardback
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 460" width="800" height="920"><rect width="400" height="460" rx="16" fill="${bg}"/><rect x="18" y="18" width="364" height="424" rx="10" fill="none" stroke="${accent}" stroke-width="2"/><rect x="28" y="28" width="344" height="48" rx="6" fill="#13151A"/><text x="44" y="57" fill="${accent}" font-family="monospace" font-size="13" font-weight="700">${yr} · ${code}</text><text x="356" y="57" text-anchor="end" fill="${fg}" font-family="monospace" font-size="12">${grade}</text><rect x="86" y="106" width="228" height="218" rx="14" fill="#13151A" stroke="${accent}" stroke-opacity="0.55" stroke-width="1.5"/><text x="200" y="220" text-anchor="middle" fill="${accent}" font-family="Georgia,serif" font-size="16">${sub}</text><text x="200" y="376" text-anchor="middle" fill="${fg}" font-family="Georgia,serif" font-size="16" font-weight="600">${t1}</text></svg>`;
  }

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
