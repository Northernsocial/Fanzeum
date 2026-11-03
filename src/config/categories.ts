export type CategorySlug =
  | 'football_cards'
  | 'trading_cards'
  | 'coins'
  | 'stamps'
  | 'comics'
  | 'vinyl'
  | 'toys'
  | 'memorabilia';

export type PresentationStyle =
  | 'card-slab'
  | 'coin-flip'
  | 'stamp-perf'
  | 'comic-slab'
  | 'vinyl-sleeve'
  | 'plinth';

export type FieldInputType = 'text' | 'select' | 'boolean';

export interface CategoryFieldDef {
  key: string;
  label: string;
  placeholder: string;
  type: FieldInputType;
  options?: string[];
  aiDescription: string;
  placardOrder?: number;
  mono?: boolean;
}

export interface CategoryConfig {
  slug: CategorySlug;
  label: string;
  shortLabel: string;
  tagline: string;
  iconName:
    | 'Trophy'
    | 'Sparkles'
    | 'Coins'
    | 'Stamp'
    | 'BookOpen'
    | 'Disc3'
    | 'Gamepad2'
    | 'Award';
  presentationStyle: PresentationStyle;
  conditionScale: string[];
  fields: CategoryFieldDef[];
}

export const RAW_CARD_CONDITIONS = [
  'Mint',
  'Near Mint',
  'Excellent',
  'Very Good',
  'Good',
  'Poor',
];

export const CARD_GRADERS = ['None (Raw)', 'PSA', 'BGS', 'CGC', 'SGC'];

export const COIN_GRADES = [
  'FDC',
  'BU',
  'UNC',
  'EF',
  'VF',
  'F',
  'Fair',
  'Poor',
  'MS-70',
  'MS-67',
  'MS-65',
  'MS-63',
  'AU-58',
  'XF-45',
  'VF-30',
];

export const STAMP_STATES = [
  'MNH (Mint Never Hinged)',
  'MM (Mint Mounted)',
  'Used',
  'On cover',
];

export const GOLDMINE_GRADES = ['M', 'NM', 'VG+', 'VG', 'G+', 'G', 'P'];

const CARD_FIELDS: CategoryFieldDef[] = [
  {
    key: 'playerOrCharacter',
    label: 'Player / Character',
    placeholder: 'e.g. Thierry Henry or Charizard',
    type: 'text',
    aiDescription: 'Player name (for sports cards) or featured character name.',
    placardOrder: 1,
  },
  {
    key: 'team',
    label: 'Club / Franchise',
    placeholder: 'e.g. Arsenal FC or Base Set',
    type: 'text',
    aiDescription: 'Club, national side, or franchise name.',
  },
  {
    key: 'set',
    label: 'Set / Release',
    placeholder: 'e.g. 2003-04 Topps Chrome or Panini Mexico 70',
    type: 'text',
    aiDescription: 'Set name and manufacturer release.',
    placardOrder: 2,
  },
  {
    key: 'year',
    label: 'Season / Year',
    placeholder: 'e.g. 2003-04 or 1970',
    type: 'text',
    aiDescription: 'Release year or season.',
    placardOrder: 0,
    mono: true,
  },
  {
    key: 'cardNumber',
    label: 'Card Number',
    placeholder: 'e.g. #44 or #4/102',
    type: 'text',
    aiDescription: 'Printed card or sticker number.',
    placardOrder: 3,
    mono: true,
  },
  {
    key: 'variantParallel',
    label: 'Variant / Parallel',
    placeholder: 'e.g. Refractor, Gold Prism, Holo',
    type: 'text',
    aiDescription: 'Parallel, foil, or insert variant name (or Base).',
  },
  {
    key: 'serialNumbered',
    label: 'Serial Numbered',
    placeholder: 'e.g. 12/99 (leave blank if unnumbered)',
    type: 'text',
    aiDescription: 'Serial stamp such as 12/99 or /25 if visible, else empty string.',
    mono: true,
  },
  {
    key: 'rookie',
    label: 'Rookie (RC)',
    placeholder: '',
    type: 'boolean',
    aiDescription: 'True if this is an official Rookie Card or debut sticker.',
  },
  {
    key: 'autograph',
    label: 'On-Card / Sticker Auto',
    placeholder: '',
    type: 'boolean',
    aiDescription: 'True if signed / autographed.',
  },
  {
    key: 'graded',
    label: 'Slabbed / Graded',
    placeholder: '',
    type: 'boolean',
    aiDescription: 'True if encapsulated in a grading slab (PSA, BGS, CGC, SGC).',
  },
  {
    key: 'grader',
    label: 'Grading Company',
    placeholder: 'Select grader',
    type: 'select',
    options: CARD_GRADERS,
    aiDescription: 'Grading company if slabbed (PSA, BGS, CGC, SGC), or None (Raw).',
  },
  {
    key: 'grade',
    label: 'Slab Grade',
    placeholder: 'e.g. 10 GEM MT or 9.5',
    type: 'text',
    aiDescription: 'Numeric grade and descriptor on slab label (e.g. "10 GEM MT"), or empty if raw.',
    placardOrder: 4,
    mono: true,
  },
  {
    key: 'rawCondition',
    label: 'Raw Condition',
    placeholder: 'Select condition',
    type: 'select',
    options: RAW_CARD_CONDITIONS,
    aiDescription: 'Raw card condition from: Mint, Near Mint, Excellent, Very Good, Good, Poor.',
    placardOrder: 5,
  },
];

export const CATEGORIES: Record<CategorySlug, CategoryConfig> = {
  football_cards: {
    slug: 'football_cards',
    label: 'Football Cards & Stickers',
    shortLabel: 'Football Cards',
    tagline: 'Panini stickers, Premier League chrome, vintage trade cards & PC pulls',
    iconName: 'Trophy',
    presentationStyle: 'card-slab',
    conditionScale: RAW_CARD_CONDITIONS,
    fields: CARD_FIELDS,
  },
  trading_cards: {
    slug: 'trading_cards',
    label: 'Trading Cards & TCG',
    shortLabel: 'Trading Cards',
    tagline: 'TCG holos, vintage non-sport, numbered parallels & graded slabs',
    iconName: 'Sparkles',
    presentationStyle: 'card-slab',
    conditionScale: RAW_CARD_CONDITIONS,
    fields: CARD_FIELDS,
  },
  coins: {
    slug: 'coins',
    label: 'Coins & Bullion',
    shortLabel: 'Coins',
    tagline: 'Roman denarii, British hammered silver, sovereigns & certified proofs',
    iconName: 'Coins',
    presentationStyle: 'coin-flip',
    conditionScale: COIN_GRADES,
    fields: [
      {
        key: 'country',
        label: 'Country / Empire',
        placeholder: 'e.g. Great Britain or Roman Empire',
        type: 'text',
        aiDescription: 'Issuing country, kingdom, or empire.',
        placardOrder: 1,
      },
      {
        key: 'denomination',
        label: 'Denomination',
        placeholder: 'e.g. Sovereign, Denarius, Groat, Crown',
        type: 'text',
        aiDescription: 'Coin denomination.',
      },
      {
        key: 'year',
        label: 'Year / Reign Date',
        placeholder: 'e.g. 1887 or AD 119–122',
        type: 'text',
        aiDescription: 'Year or historical date range struck.',
        placardOrder: 0,
        mono: true,
      },
      {
        key: 'mintMark',
        label: 'Mint / Mintmark',
        placeholder: 'e.g. London (Tower Hill), Rome, M (Melbourne)',
        type: 'text',
        aiDescription: 'Mint city or mint mark.',
      },
      {
        key: 'metal',
        label: 'Metal / Fineness',
        placeholder: 'e.g. 22ct Gold (.917) or .925 Sterling Silver',
        type: 'text',
        aiDescription: 'Metal composition.',
      },
      {
        key: 'reference',
        label: 'Spink / RIC / KM Ref',
        placeholder: 'e.g. Spink 3866 or RIC II 118',
        type: 'text',
        aiDescription: 'Standard numismatic reference (Spink S., RIC, or KM number).',
        placardOrder: 2,
        mono: true,
      },
      {
        key: 'grade',
        label: 'Grade',
        placeholder: 'Select grade',
        type: 'select',
        options: COIN_GRADES,
        aiDescription: 'British grade (FDC, BU, UNC, EF, VF, F, Fair, Poor) or Sheldon MS/PF grade.',
        placardOrder: 3,
        mono: true,
      },
      {
        key: 'certified',
        label: 'PCGS / NGC Certified',
        placeholder: '',
        type: 'boolean',
        aiDescription: 'True if encapsulated in a PCGS or NGC holder.',
      },
    ],
  },
  stamps: {
    slug: 'stamps',
    label: 'Stamps & Postal History',
    shortLabel: 'Stamps',
    tagline: 'Line-engraved GB, Stanley Gibbons varieties, covers & high values',
    iconName: 'Stamp',
    presentationStyle: 'stamp-perf',
    conditionScale: STAMP_STATES,
    fields: [
      {
        key: 'country',
        label: 'Country',
        placeholder: 'e.g. Great Britain',
        type: 'text',
        aiDescription: 'Issuing country or territory.',
        placardOrder: 1,
      },
      {
        key: 'year',
        label: 'Year of Issue',
        placeholder: 'e.g. 1840',
        type: 'text',
        aiDescription: 'Year issued.',
        placardOrder: 0,
        mono: true,
      },
      {
        key: 'sgNumber',
        label: 'Stanley Gibbons (SG)',
        placeholder: 'e.g. SG 2 (Plate 4)',
        type: 'text',
        aiDescription: 'Stanley Gibbons catalogue number (e.g. SG 1, SG 403).',
        placardOrder: 2,
        mono: true,
      },
      {
        key: 'denomination',
        label: 'Face Value',
        placeholder: 'e.g. 1d Black or £1 Green',
        type: 'text',
        aiDescription: 'Printed denomination.',
      },
      {
        key: 'mintUsedState',
        label: 'Mint / Used State',
        placeholder: 'Select state',
        type: 'select',
        options: STAMP_STATES,
        aiDescription: 'One of: MNH (Mint Never Hinged), MM (Mint Mounted), Used, On cover.',
        placardOrder: 3,
      },
      {
        key: 'marginsPerforation',
        label: 'Margins & Perforations',
        placeholder: 'e.g. 4 clear margins, red Maltese Cross; Perf 14',
        type: 'text',
        aiDescription: 'Notes on margins, centering, watermark, cancellation, or perforation.',
      },
    ],
  },
  comics: {
    slug: 'comics',
    label: 'Comics & Key Issues',
    shortLabel: 'Comics',
    tagline: 'Silver, Bronze & Copper Age keys, CGC slabs & UK 2000 AD runs',
    iconName: 'BookOpen',
    presentationStyle: 'comic-slab',
    conditionScale: ['Near Mint (9.4)', 'Very Fine (8.0)', 'Fine (6.0)', 'Very Good (4.0)', 'Good (2.0)'],
    fields: [
      {
        key: 'publisher',
        label: 'Publisher',
        placeholder: 'e.g. Marvel Comics or IPC Magazines',
        type: 'text',
        aiDescription: 'Comic publisher.',
        placardOrder: 1,
      },
      {
        key: 'comicTitle',
        label: 'Series Title',
        placeholder: 'e.g. The Amazing Spider-Man',
        type: 'text',
        aiDescription: 'Series title.',
      },
      {
        key: 'issueNumber',
        label: 'Issue Number',
        placeholder: 'e.g. #300 or Prog 2',
        type: 'text',
        aiDescription: 'Issue number.',
        placardOrder: 2,
        mono: true,
      },
      {
        key: 'year',
        label: 'Cover Year',
        placeholder: 'e.g. 1988',
        type: 'text',
        aiDescription: 'Cover publication year.',
        placardOrder: 0,
        mono: true,
      },
      {
        key: 'keyIssue',
        label: 'Key Issue',
        placeholder: '',
        type: 'boolean',
        aiDescription: 'True if first appearance, iconic cover, origin, or major key.',
      },
      {
        key: 'keyReason',
        label: 'Key Note',
        placeholder: 'e.g. 1st full appearance of Venom (Eddie Brock)',
        type: 'text',
        aiDescription: 'Why this issue is significant to collectors.',
      },
      {
        key: 'cgcGrade',
        label: 'CGC Grade (if slabbed)',
        placeholder: 'e.g. 9.6 (leave blank if raw)',
        type: 'text',
        aiDescription: 'CGC numeric grade 0.5–10.0 if slabbed, or empty string if raw.',
        placardOrder: 3,
        mono: true,
      },
      {
        key: 'rawCondition',
        label: 'Raw Grade (if unslabbed)',
        placeholder: 'e.g. VF/NM 9.0',
        type: 'text',
        aiDescription: 'Estimated raw Overstreet condition if not CGC graded.',
        placardOrder: 4,
      },
    ],
  },
  vinyl: {
    slug: 'vinyl',
    label: 'Vinyl & 7" Singles',
    shortLabel: 'Vinyl',
    tagline: 'Northern Soul 45s, first UK pressings, matrix runouts & picture sleeves',
    iconName: 'Disc3',
    presentationStyle: 'vinyl-sleeve',
    conditionScale: GOLDMINE_GRADES,
    fields: [
      {
        key: 'artist',
        label: 'Artist / Band',
        placeholder: 'e.g. Frank Wilson or Led Zeppelin',
        type: 'text',
        aiDescription: 'Recording artist or group.',
        placardOrder: 1,
      },
      {
        key: 'albumTitle',
        label: 'Track / Album Title',
        placeholder: 'e.g. Do I Love You (Indeed I Do)',
        type: 'text',
        aiDescription: 'Single or LP title.',
      },
      {
        key: 'label',
        label: 'Record Label',
        placeholder: 'e.g. Tamla Motown, Soul, Vertigo Swirl',
        type: 'text',
        aiDescription: 'Record label name.',
        placardOrder: 2,
      },
      {
        key: 'catalogueNumber',
        label: 'Catalogue Number',
        placeholder: 'e.g. SOUL 35019 or TMG 700',
        type: 'text',
        aiDescription: 'Label catalogue number.',
        placardOrder: 3,
        mono: true,
      },
      {
        key: 'country',
        label: 'Pressing Country',
        placeholder: 'e.g. UK or US Promo',
        type: 'text',
        aiDescription: 'Country of pressing.',
      },
      {
        key: 'year',
        label: 'Pressing Year',
        placeholder: 'e.g. 1965',
        type: 'text',
        aiDescription: 'Year of this specific pressing.',
        placardOrder: 0,
        mono: true,
      },
      {
        key: 'pressingNotes',
        label: 'Matrix / Pressing Notes',
        placeholder: 'e.g. 4-prong push-out centre, A1/B1 Porky Prime Cut',
        type: 'text',
        aiDescription: 'Pressing details, promo markings, or runout matrix info.',
      },
      {
        key: 'mediaGrade',
        label: 'Media Grade (Goldmine)',
        placeholder: 'Select grade',
        type: 'select',
        options: GOLDMINE_GRADES,
        aiDescription: 'Goldmine vinyl media grade: M, NM, VG+, VG, G+, G, P.',
        placardOrder: 4,
        mono: true,
      },
      {
        key: 'sleeveGrade',
        label: 'Sleeve Grade (Goldmine)',
        placeholder: 'Select grade',
        type: 'select',
        options: GOLDMINE_GRADES,
        aiDescription: 'Goldmine sleeve grade: M, NM, VG+, VG, G+, G, P.',
        mono: true,
      },
    ],
  },
  toys: {
    slug: 'toys',
    label: 'Vintage Toys & Action Figures',
    shortLabel: 'Toys',
    tagline: 'Palitoy & Kenner cardbacks, Corgi die-cast, boxed G1 & tinplate',
    iconName: 'Gamepad2',
    presentationStyle: 'plinth',
    conditionScale: ['AFA 85 NM+', 'MOC (Mint on Card)', 'MIB (Mint in Box)', 'Loose Complete', 'Playworn'],
    fields: [
      {
        key: 'brand',
        label: 'Manufacturer / Brand',
        placeholder: 'e.g. Palitoy / Kenner or Corgi Toys',
        type: 'text',
        aiDescription: 'Toy manufacturer.',
        placardOrder: 1,
      },
      {
        key: 'line',
        label: 'Toy Line / Wave',
        placeholder: 'e.g. Star Wars 12-Back-A',
        type: 'text',
        aiDescription: 'Toy line and wave/cardback.',
        placardOrder: 2,
      },
      {
        key: 'year',
        label: 'Year',
        placeholder: 'e.g. 1978',
        type: 'text',
        aiDescription: 'Release year.',
        placardOrder: 0,
        mono: true,
      },
      {
        key: 'packagingState',
        label: 'Boxed / Carded / Loose',
        placeholder: 'Select state',
        type: 'select',
        options: ['Carded (MOC)', 'Boxed (MIB)', 'Boxed (Opened)', 'Loose'],
        aiDescription: 'Packaging state: Carded (MOC), Boxed (MIB), Boxed (Opened), or Loose.',
        placardOrder: 3,
      },
      {
        key: 'complete',
        label: '100% Original Accessories',
        placeholder: '',
        type: 'boolean',
        aiDescription: 'True if complete with original accessories/weapons (no repro).',
      },
    ],
  },
  memorabilia: {
    slug: 'memorabilia',
    label: 'Sporting & Cultural Memorabilia',
    shortLabel: 'Memorabilia',
    tagline: 'Cup Final programmes, ticket stubs, match-worn shirts & signed pieces',
    iconName: 'Award',
    presentationStyle: 'plinth',
    conditionScale: ['Mint', 'Near Mint', 'Very Good (No folds)', 'Good (Light crease)', 'Fair'],
    fields: [
      {
        key: 'memorabiliaType',
        label: 'Piece Type',
        placeholder: 'e.g. Matchday Programme, Ticket Stub, Signed Shirt',
        type: 'text',
        aiDescription: 'Type of memorabilia.',
        placardOrder: 2,
      },
      {
        key: 'maker',
        label: 'Issuer / Venue / Maker',
        placeholder: 'e.g. Wembley Stadium / FA',
        type: 'text',
        aiDescription: 'Club, venue, or manufacturer.',
        placardOrder: 1,
      },
      {
        key: 'year',
        label: 'Year / Fixture Date',
        placeholder: 'e.g. 30 July 1966',
        type: 'text',
        aiDescription: 'Year or event date.',
        placardOrder: 0,
        mono: true,
      },
      {
        key: 'signed',
        label: 'Hand-Signed',
        placeholder: '',
        type: 'boolean',
        aiDescription: 'True if hand-signed.',
      },
      {
        key: 'provenanceNotes',
        label: 'Provenance &COA',
        placeholder: 'e.g. Attended with my dad, North Stand turnstile B',
        type: 'text',
        aiDescription: 'Provenance, COA details, or condition notes.',
        placardOrder: 3,
      },
    ],
  },
};

export const CATEGORY_LIST: CategoryConfig[] = Object.values(CATEGORIES);

export const CATEGORY_KEY_FIELDS: Record<CategorySlug, string[]> = {
  football_cards: ['playerOrCharacter', 'set', 'year'],
  trading_cards: ['playerOrCharacter', 'set', 'year'],
  coins: ['country', 'year', 'denomination'],
  stamps: ['country', 'year', 'sgNumber'],
  comics: ['publisher', 'comicTitle', 'issueNumber', 'year'],
  vinyl: ['artist', 'albumTitle', 'label'],
  toys: ['brand', 'line', 'year'],
  memorabilia: ['memorabiliaType', 'maker', 'year'],
};

export function isPanelConfirmed(
  category: CategorySlug,
  fields: Record<string, { value?: unknown; confidence?: string }>,
  overallConfidence?: string,
): boolean {
  if (overallConfidence && overallConfidence !== 'high') {
    return false;
  }
  const keyFields = CATEGORY_KEY_FIELDS[category] || [];
  if (keyFields.length === 0) return overallConfidence === 'high';

  return keyFields.every((k) => {
    const entry = fields[k];
    if (!entry) return false;
    const hasValue = entry.value !== undefined && entry.value !== '' && entry.value !== null;
    return hasValue && entry.confidence === 'high';
  });
}

export function getItemPlacardParts(
  category: CategorySlug,
  attributes: Record<string, string | boolean | undefined> = {},
): { year: string; maker: string; catNumber: string; condition: string } {
  const str = (k: string) => {
    const v = attributes[k];
    return typeof v === 'string' ? v.trim() : '';
  };

  switch (category) {
    case 'football_cards':
    case 'trading_cards': {
      const graded = Boolean(attributes.graded);
      const grader = str('grader');
      const grade = str('grade');
      const cond =
        graded && grader && grader !== 'None (Raw)'
          ? `${grader} ${grade}`.trim()
          : str('rawCondition') || 'Raw';
      return {
        year: str('year'),
        maker: str('set') || str('team'),
        catNumber: str('serialNumbered')
          ? `${str('cardNumber')} (${str('serialNumbered')})`.trim()
          : str('cardNumber'),
        condition: cond,
      };
    }
    case 'coins':
      return {
        year: str('year'),
        maker: [str('country'), str('mintMark')].filter(Boolean).join(' · '),
        catNumber: str('reference'),
        condition: attributes.certified ? `Cert. ${str('grade')}` : str('grade'),
      };
    case 'stamps':
      return {
        year: str('year'),
        maker: str('country') || 'Great Britain',
        catNumber: str('sgNumber'),
        condition: str('mintUsedState'),
      };
    case 'comics':
      return {
        year: str('year'),
        maker: str('publisher'),
        catNumber: str('issueNumber'),
        condition: str('cgcGrade') ? `CGC ${str('cgcGrade')}` : str('rawCondition'),
      };
    case 'vinyl':
      return {
        year: str('year'),
        maker: [str('artist'), str('label')].filter(Boolean).join(' · '),
        catNumber: str('catalogueNumber'),
        condition: str('mediaGrade')
          ? `${str('mediaGrade')} / ${str('sleeveGrade') || str('mediaGrade')}`
          : '',
      };
    case 'toys':
      return {
        year: str('year'),
        maker: [str('brand'), str('line')].filter(Boolean).join(' · '),
        catNumber: attributes.complete ? 'Complete' : 'Incomplete',
        condition: str('packagingState'),
      };
    case 'memorabilia':
    default:
      return {
        year: str('year'),
        maker: str('maker'),
        catNumber: str('memorabiliaType'),
        condition: attributes.signed ? 'Signed' : 'Original',
      };
  }
}
