import pennyBlackImg from '../assets/images/stamp_penny_black_1793568551174.jpg';
import goldSovereignImg from '../assets/images/coin_gold_sovereign_1793568554640.jpg';
import seahorseStampImg from '../assets/images/stamp_seahorse_highvalue_1793568555029.jpg';
import type {
  CollectibleItemRecord,
  CollectionRecord,
  UserProfile,
} from '../types/domain';

function svgDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Bespoke archival lithograph illustrations for vintage UK football cards & silver crown
const footballCard1966Svg = svgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800">
  <rect width="600" height="800" fill="#EFEAE1"/>
  <rect x="60" y="52" width="480" height="696" rx="10" fill="#FBF8F1" stroke="#C9BFA9" stroke-width="4"/>
  <rect x="84" y="76" width="432" height="540" fill="#9A3412"/>
  <path d="M84 440 L516 390 L516 616 L84 616 Z" fill="#14532D" opacity="0.88"/>
  <circle cx="300" cy="245" r="76" fill="#F2D2B6"/>
  <path d="M235 215 C245 160 355 160 365 215 Z" fill="#3F2E21"/>
  <path d="M180 540 C190 365 410 365 420 540 Z" fill="#B91C1C" stroke="#FBF8F1" stroke-width="8"/>
  <rect x="262" y="346" width="76" height="28" fill="#FBF8F1"/>
  <text x="300" y="476" text-anchor="middle" font-family="Georgia, serif" font-size="68" font-weight="bold" fill="#FBF8F1">6</text>
  <rect x="84" y="632" width="432" height="92" fill="#1C1917"/>
  <text x="108" y="670" font-family="Georgia, serif" font-size="26" font-weight="bold" fill="#FBF9F5">CAPTAIN OF ENGLAND</text>
  <text x="108" y="704" font-family="sans-serif" font-size="15" letter-spacing="3" fill="#D6CEBE">A&amp;BC FOOTBALLER SERIES · NO. 42 · 1966</text>
</svg>
`);

const footballCard1958Svg = svgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800">
  <rect width="600" height="800" fill="#ECE6DC"/>
  <rect x="64" y="56" width="472" height="688" rx="8" fill="#FAF6ED" stroke="#BFB39C" stroke-width="4"/>
  <rect x="88" y="80" width="424" height="530" fill="#1E3A8A"/>
  <circle cx="300" cy="250" r="72" fill="#EED0B5"/>
  <path d="M238 220 C250 170 350 170 362 220 Z" fill="#292524"/>
  <path d="M185 545 C200 375 400 375 415 545 Z" fill="#FBF9F5" stroke="#1C1917" stroke-width="5"/>
  <path d="M250 385 L300 430 L350 385" fill="none" stroke="#1E3A8A" stroke-width="12"/>
  <rect x="88" y="628" width="424" height="92" fill="#292524"/>
  <text x="112" y="666" font-family="Georgia, serif" font-size="25" font-weight="bold" fill="#FBF9F5">FIRST DIVISION WINGER</text>
  <text x="112" y="700" font-family="sans-serif" font-size="14" letter-spacing="3" fill="#D6CEBE">CHIX CONFECTIONERY · CARD NO. 7 · 1958</text>
</svg>
`);

const gothicCrown1847Svg = svgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 700">
  <rect width="700" height="700" fill="#171614"/>
  <circle cx="350" cy="350" r="258" fill="#A8A29E" stroke="#E7E5E4" stroke-width="8"/>
  <circle cx="350" cy="350" r="236" fill="#78716C" stroke="#D6D3D1" stroke-width="3" stroke-dasharray="6 6"/>
  <circle cx="350" cy="350" r="196" fill="#57534E" stroke="#E7E5E4" stroke-width="2"/>
  <path d="M280 230 L350 185 L420 230 L405 268 L295 268 Z" fill="#F5F5F4"/>
  <circle cx="350" cy="335" r="66" fill="#E7E5E4"/>
  <path d="M276 465 C295 395 405 395 424 465 Z" fill="#D6D3D1"/>
  <text x="350" y="520" text-anchor="middle" font-family="Georgia, serif" font-size="22" letter-spacing="6" fill="#F5F5F4">MDCCCXLVII</text>
  <text x="350" y="138" text-anchor="middle" font-family="Georgia, serif" font-size="20" letter-spacing="5" fill="#F5F5F4">VICTORIA DEI GRATIA</text>
</svg>
`);

export const DEMO_CURATORS: UserProfile[] = [
  {
    uid: 'demo_curator_eleanor',
    handle: 'eleanor_vance',
    displayName: 'Dr Eleanor Vance',
    bio: 'Fellow of the Royal Philatelic Society guidelines & specialist in line-engraved Victorian postal history (1840–1915). Curating four-margin plates and Maltese Cross cancellations.',
    avatarUrl: '',
    location: 'Bloomsbury, London, UK',
    specialties: ['stamps'],
    goal: 'exhibit',
    role: 'expert',
    plan: 'premium',
    isVerifiedExpert: true,
    isPublicProfile: true,
    onboardingCompleted: true,
    collectionsCount: 1,
  },
  {
    uid: 'demo_curator_callum',
    handle: 'callum_terraces',
    displayName: 'Callum MacLeod',
    bio: 'Collecting post-war British football trade cards from A&BC Gum, Barratt & Co., and Chix Confectionery. Focused on centered lithographs from 1955 to 1970.',
    avatarUrl: '',
    location: 'Glasgow, Scotland, UK',
    specialties: ['football_cards', 'memorabilia'],
    goal: 'complete_set',
    role: 'collector',
    plan: 'premium',
    isVerifiedExpert: false,
    isPublicProfile: true,
    onboardingCompleted: true,
    collectionsCount: 1,
  },
  {
    uid: 'demo_curator_arthur',
    handle: 'st_james_numismatics',
    displayName: 'Arthur Pendelton',
    bio: 'Third-generation numismatist documenting Tower Hill Royal Mint gold sovereigns, Jubilee proofs, and Victorian Gothic silver crowns.',
    avatarUrl: '',
    location: 'York, North Yorkshire, UK',
    specialties: ['coins'],
    goal: 'exhibit',
    role: 'expert',
    plan: 'store',
    isVerifiedExpert: true,
    isPublicProfile: true,
    onboardingCompleted: true,
    collectionsCount: 1,
  },
];

export const DEMO_COLLECTIONS: CollectionRecord[] = [
  {
    id: 'demo-britain-line-engraved',
    ownerId: 'demo_curator_eleanor',
    ownerName: 'Dr Eleanor Vance',
    ownerHandle: 'eleanor_vance',
    title: 'Line & Empire: Great Britain Classic Philately (1840–1913)',
    story:
      'On 6 May 1840, Rowland Hill’s postal reform transformed human correspondence with the world’s first adhesive postage stamp. This cabinet traces seventy-three years of British engraving mastery—from Perkins, Bacon & Petch’s engine-turned steel plates on the One Penny Black to Bertram Mackennal and George Eve’s monumental Seahorses high-values of King George V.\n\nEach example in this exhibition has been selected for fresh paper character, crisp plate impression, and sympathetic postal cancellation.',
    coverImageUrl: pennyBlackImg,
    category: 'stamps',
    visibility: 'public',
    itemCount: 2,
    setTargetCount: 12,
    estimatedTotalMinGbp: 2450,
    estimatedTotalMaxGbp: 3400,
    featured: true,
    isDemo: true,
  },
  {
    id: 'demo-royal-mint-sovereigns',
    ownerId: 'demo_curator_arthur',
    ownerName: 'Arthur Pendelton',
    ownerHandle: 'st_james_numismatics',
    title: 'Sovereigns & Crowns of the Victorian Royal Mint',
    story:
      'Struck at Tower Hill to exacting 22-carat gold and .925 sterling silver standards, Victorian coinage united neoclassical artistry with industrial precision. This study pairs Joseph Edgar Boehm’s 1887 Golden Jubilee gold sovereign with William Wyon’s celebrated Gothic Revival crown—widely regarded by British numismatists as the finest silver coin ever struck in London.',
    coverImageUrl: goldSovereignImg,
    category: 'coins',
    visibility: 'public',
    itemCount: 2,
    setTargetCount: 8,
    estimatedTotalMinGbp: 5150,
    estimatedTotalMaxGbp: 6850,
    featured: true,
    isDemo: true,
  },
  {
    id: 'demo-golden-era-football-cards',
    ownerId: 'demo_curator_callum',
    ownerName: 'Callum MacLeod',
    ownerHandle: 'callum_terraces',
    title: 'Floodlit Legends: English & Scottish Football Cards (1958–1966)',
    story:
      'Before glossy chromium parallels, playground swaps were printed on thick, sweet-scented cardboard by A&BC Chewing Gum in Chesham and Chix Confectionery in Slough. Surviving examples with sharp corners and uncreased backs are remarkably scarce.\n\nThis ongoing set archive documents iconic skippers and touchline wingers leading up to the summer of 1966.',
    coverImageUrl: footballCard1966Svg,
    category: 'football_cards',
    visibility: 'public',
    itemCount: 2,
    setTargetCount: 44,
    estimatedTotalMinGbp: 410,
    estimatedTotalMaxGbp: 620,
    featured: true,
    isDemo: true,
  },
];

export const DEMO_ITEMS: CollectibleItemRecord[] = [
  {
    id: 'demo-item-penny-black',
    collectionId: 'demo-britain-line-engraved',
    ownerId: 'demo_curator_eleanor',
    category: 'stamps',
    visibility: 'public',
    name: '1840 Great Britain 1d Intense Black (Plate 4, Lettering P–L)',
    year: '1840',
    maker: 'Perkins, Bacon & Petch (London)',
    series: 'Queen Victoria Line-Engraved',
    setNumber: 'SG 1 / Plate 4',
    condition: 'Superb Used — 4 Clear Margins, Red Maltese Cross',
    valueMinGbp: 1850,
    valueMaxGbp: 2500,
    aiConfidence: 'high',
    curatorialNote:
      'Four generous, balanced margins on handmade Crown watermarked rag paper, cancelled by a crisp scarlet Maltese Cross strike leaving Queen Victoria’s profile clear.',
    imageUrl: pennyBlackImg,
    forSale: false,
    isDemo: true,
  },
  {
    id: 'demo-item-seahorse-2s6d',
    collectionId: 'demo-britain-line-engraved',
    ownerId: 'demo_curator_eleanor',
    category: 'stamps',
    visibility: 'public',
    name: '1913 Great Britain King George V 2s 6d Deep Sepia-Brown Seahorses',
    year: '1913',
    maker: 'Waterlow Bros. & Layton',
    series: 'King George V High-Value Seahorses',
    setNumber: 'SG 399',
    condition: 'Unmounted Mint (UM) — Fresh Gum & Crisp Perfs',
    valueMinGbp: 600,
    valueMaxGbp: 900,
    aiConfidence: 'high',
    curatorialNote:
      'First Waterlow printing in rich deep sepia-brown shade showing razor-sharp engraved Britannia charioteer lines and full perfs.',
    imageUrl: seahorseStampImg,
    forSale: false,
    isDemo: true,
  },
  {
    id: 'demo-item-1887-sovereign',
    collectionId: 'demo-royal-mint-sovereigns',
    ownerId: 'demo_curator_arthur',
    category: 'coins',
    visibility: 'public',
    name: '1887 Queen Victoria Golden Jubilee Full Sovereign (London Mint)',
    year: '1887',
    maker: 'The Royal Mint, Tower Hill (J.E. Boehm / B. Pistrucci)',
    series: 'Victorian Gold Sovereigns',
    setNumber: 'Spink 3866',
    condition: 'Good Extremely Fine (GEF) — Original Mint Lustre',
    valueMinGbp: 650,
    valueMaxGbp: 850,
    aiConfidence: 'high',
    curatorialNote:
      'First year of issue for Boehm’s Jubilee bust paired with Benedetto Pistrucci’s St George and the Dragon reverse; warm fields with crisp denticles.',
    imageUrl: goldSovereignImg,
    forSale: false,
    isDemo: true,
  },
  {
    id: 'demo-item-1847-gothic-crown',
    collectionId: 'demo-royal-mint-sovereigns',
    ownerId: 'demo_curator_arthur',
    category: 'coins',
    visibility: 'public',
    name: '1847 Queen Victoria Silver Gothic Crown (UNDECIMO Edge)',
    year: '1847',
    maker: 'The Royal Mint (Engraver: William Wyon RA)',
    series: 'Victorian Proof Silver Crowns',
    setNumber: 'Spink 3883',
    condition: 'Choice Proof — Cabinet Steel & Cobalt Toning',
    valueMinGbp: 4500,
    valueMaxGbp: 6000,
    aiConfidence: 'high',
    curatorialNote:
      'Mintage of just 8,000 pieces featuring blackletter Gothic legends and crowned cruciform shields; deeply mirrored fields.',
    imageUrl: gothicCrown1847Svg,
    forSale: false,
    isDemo: true,
  },
  {
    id: 'demo-item-1966-captain-card',
    collectionId: 'demo-golden-era-football-cards',
    ownerId: 'demo_curator_callum',
    category: 'football_cards',
    visibility: 'public',
    name: '1966 A&BC Footballer Series — England Captain (#42 Orange Back)',
    year: '1966',
    maker: 'A&BC Chewing Gum Ltd, Chesham, Bucks',
    series: '1966 Footballer (Orange Quiz Back)',
    setNumber: 'No. 42 of 88',
    condition: 'Excellent-Mint (EX-MT 6) — 55/45 Centering, Clean Rub-Off Back',
    valueMinGbp: 260,
    valueMaxGbp: 390,
    aiConfidence: 'high',
    curatorialNote:
      'Unrubbed quiz reverse with vivid lithographic colour registration and honest corner wear rare for playground-issued gum packs.',
    imageUrl: footballCard1966Svg,
    forSale: false,
    isDemo: true,
  },
  {
    id: 'demo-item-1958-winger-card',
    collectionId: 'demo-golden-era-football-cards',
    ownerId: 'demo_curator_callum',
    category: 'football_cards',
    visibility: 'public',
    name: '1958 Chix Confectionery Famous Footballers — First Series #7',
    year: '1958',
    maker: 'Chix Confectionery Co. Ltd, Slough',
    series: 'Famous Footballers (1st Series of 48)',
    setNumber: 'No. 7 of 48',
    condition: 'Very Good-Excellent (VG-EX 4.5) — Bright Lithograph',
    valueMinGbp: 150,
    valueMaxGbp: 230,
    aiConfidence: 'high',
    curatorialNote:
      'Classic late-1950s painted portrait issue on cream card stock with crisp biographical text on reverse.',
    imageUrl: footballCard1958Svg,
    forSale: false,
    isDemo: true,
  },
];
