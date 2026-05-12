// Pure helpers for the city picker modal: query filtering, 50音 row
// grouping, and the Hokkaido 振興局 list. Kept separate from compose.ts
// (canvas / SVG) so the unit tests don't have to touch image code.

import type { City } from '@/lib/cities-data';

export type GojuonRowId =
  | 'a' | 'ka' | 'sa' | 'ta' | 'na' | 'ha' | 'ma' | 'ya' | 'ra' | 'wa' | 'other';

export type GojuonRow = { id: GojuonRowId; label: string };

export const GOJUON_ROWS: GojuonRow[] = [
  { id: 'a',  label: 'あ' },
  { id: 'ka', label: 'か' },
  { id: 'sa', label: 'さ' },
  { id: 'ta', label: 'た' },
  { id: 'na', label: 'な' },
  { id: 'ha', label: 'は' },
  { id: 'ma', label: 'ま' },
  { id: 'ya', label: 'や' },
  { id: 'ra', label: 'ら' },
  { id: 'wa', label: 'わ' },
  { id: 'other', label: '他' },
];

export type HokkaidoSubregion = { id: string; name: string };

// Mirror of scripts/hokkaido-subregion.mjs HOKKAIDO_SUBREGIONS — duplicated
// rather than imported so the client bundle doesn't pull in a .mjs script.
// Keep these two lists in sync if the chips ever change.
export const HOKKAIDO_SUBREGIONS: HokkaidoSubregion[] = [
  { id: 'sorachi',    name: '空知' },
  { id: 'ishikari',   name: '石狩' },
  { id: 'shiribeshi', name: '後志' },
  { id: 'iburi',      name: '胆振' },
  { id: 'hidaka',     name: '日高' },
  { id: 'oshima',     name: '渡島' },
  { id: 'hiyama',     name: '檜山' },
  { id: 'kamikawa',   name: '上川' },
  { id: 'rumoi',      name: '留萌' },
  { id: 'soya',       name: '宗谷' },
  { id: 'okhotsk',    name: 'オホーツク' },
  { id: 'tokachi',    name: '十勝' },
  { id: 'kushiro',    name: '釧路' },
  { id: 'nemuro',     name: '根室' },
];

// Convert katakana ranges to hiragana so a query in either script matches
// the kana field (which is always hiragana).
function katakanaToHiragana(s: string): string {
  let out = '';
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    out += code >= 0x30a1 && code <= 0x30f6 ? String.fromCodePoint(code - 0x60) : ch;
  }
  return out;
}

function normalizeQuery(q: string): string {
  return katakanaToHiragana(q.trim()).toLowerCase();
}

// True when the first non-dakuten hiragana of `kana` belongs to `row`.
// Strips combining marks so がぎ etc. land in か行, and small ぁぃ etc. fold
// into their full-size base so an ぁ-led name still appears in あ行.
export function rowOf(kana: string | undefined): GojuonRowId {
  if (!kana) return 'other';
  const first = kana.charCodeAt(0);
  // Normalize: small chars (ぁ-ょ) → their base; offset is +1 (e.g. ぁ→あ).
  const SMALL_TO_BASE: Record<string, string> = {
    'ぁ': 'あ', 'ぃ': 'い', 'ぅ': 'う', 'ぇ': 'え', 'ぉ': 'お',
    'っ': 'つ', 'ゃ': 'や', 'ゅ': 'ゆ', 'ょ': 'よ', 'ゎ': 'わ',
  };
  const base = SMALL_TO_BASE[kana[0]] ?? kana[0];
  const c = base.codePointAt(0)!;
  // Range starts within U+3041–U+3093 (hiragana block).
  if (c < 0x3041 || c > 0x3096) return 'other';
  // Strip dakuten / handakuten by mapping to the unvoiced base. The
  // hiragana table is contiguous, so dakuten chars (が/ぎ/…) sit one code
  // above the unvoiced (か/き/…); handakuten (ぱ/ぴ/…) sit two above the
  // h-row base. Easiest: switch on the first char.
  const ch = String.fromCodePoint(c);
  if ('あいうえお'.includes(ch)) return 'a';
  if ('かきくけこがぎぐげご'.includes(ch)) return 'ka';
  if ('さしすせそざじずぜぞ'.includes(ch)) return 'sa';
  if ('たちつてとだぢづでど'.includes(ch)) return 'ta';
  if ('なにぬねの'.includes(ch)) return 'na';
  if ('はひふへほばびぶべぼぱぴぷぺぽ'.includes(ch)) return 'ha';
  if ('まみむめも'.includes(ch)) return 'ma';
  if ('やゆよ'.includes(ch)) return 'ya';
  if ('らりるれろ'.includes(ch)) return 'ra';
  if ('わをんゐゑ'.includes(ch)) return 'wa';
  return 'other';
}

export type CityFilter = {
  query?: string;        // free text — matched against name / kana / reading
  row?: GojuonRowId | null;
  subregion?: string | null;
};

// Filter cities by any combination of free-text query, 50音 row, and
// Hokkaido subregion. All criteria are AND-combined; empty / null criteria
// are no-ops. Preserves the input order so the result is stable.
export function filterCities(cities: City[], f: CityFilter): City[] {
  const q = f.query ? normalizeQuery(f.query) : '';
  const row = f.row ?? null;
  const sub = f.subregion ?? null;
  if (!q && !row && !sub) return cities;
  return cities.filter(c => {
    if (sub && c.subregion !== sub) return false;
    if (row && rowOf(c.kana) !== row) return false;
    if (q) {
      const haystack = [
        c.name,
        c.kana ?? '',
        katakanaToHiragana(c.name),
        c.reading.toLowerCase(),
      ].join('|');
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}
