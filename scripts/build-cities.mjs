// Build per-prefecture city data from niiyz/JapanCityGeoJson.
//
// For each of Japan's 47 prefectures, fetch every municipality polygon,
// merge designated-city wards into their parent, project to a 0-200
// SVG viewBox per municipality, simplify, and emit one JSON per
// prefecture under public/data/cities/{code}.json. Also writes
// public/data/prefectures.json with the 47-entry index.
//
// Run: node scripts/build-cities.mjs

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import polygonClipping from 'polygon-clipping';
import { toRomaji } from 'wanakana';

import { hokkaidoSubregionOf } from './hokkaido-subregion.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'data');

// Source: niiyz/JapanCityGeoJson cloned locally. Set NIIYZ_DIR env var to
// override; otherwise we fall back to /tmp/niiyz. Clone with:
//   git clone --depth 1 https://github.com/niiyz/JapanCityGeoJson /tmp/niiyz
// This avoids the GitHub Contents-API rate limit on rebuilds.
const NIIYZ_DIR = process.env.NIIYZ_DIR ?? '/tmp/niiyz';
const NIIYZ_GEOJSON = path.join(NIIYZ_DIR, 'geojson');

// Slim {5-digit-code: hiragana} index distilled from code4fukui/localgovjp.
// Used to derive romaji "readings" for the watermark / city-info overlay
// instead of falling back to the kanji name (which would look inconsistent
// next to the prefecture-level Hepburn romaji).
const KANA_INDEX = JSON.parse(
  await fs.readFile(path.join(__dirname, 'municipality-kana.json'), 'utf8'),
);

// Suffix → kana endings the citykana field uses. 市/区 are 1-mora; 町/村
// vary so we try both common readings.
const SUFFIX_KANA = {
  市: ['し'],
  区: ['く'],
  町: ['まち', 'ちょう'],
  村: ['むら', 'そん'],
};

// Returns the kanji + kana with the trailing 市/区/町/村 stripped so the
// derived romaji matches the existing Yamaguchi convention (e.g.
// 下関市/しものせきし → SHIMONOSEKI, not SHIMONOSEKISHI).
function stripMunicipalitySuffix(name, kana) {
  const last = name.slice(-1);
  const candidates = SUFFIX_KANA[last];
  if (!candidates) return { stem: name, stemKana: kana };
  for (const s of candidates) {
    if (kana.endsWith(s)) return { stem: name.slice(0, -1), stemKana: kana.slice(0, -s.length) };
  }
  return { stem: name, stemKana: kana };
}

// Returns the official hiragana for this code (without designated-city
// parent prefix). Used by both the romaji derivation and the kana field
// that the city-picker search/50音-tab features rely on. Returns null when
// the code is missing from the localgovjp index (rare — mostly historical
// merges and the disputed northern-territory villages).
function kanaFor(code) {
  let kana = KANA_INDEX[code];
  if (!kana) return null;
  // Designated-city wards come back as "札幌市 中央区"; we want just the
  // ward portion ("中央区" → ちゅうおうく). We don't actually emit ward-
  // level entries (they're merged into the parent), but be defensive.
  const sp = kana.lastIndexOf(' ');
  if (sp >= 0) kana = kana.slice(sp + 1);
  return kana;
}

// Derive a Hepburn-uppercase reading from the official kana, falling back
// to the kanji name when localgovjp doesn't list this code (rare; mostly
// the parent of merged historical municipalities).
function readingFor(code, name) {
  const kana = kanaFor(code);
  if (!kana) return name; // fallback — keeps the entry usable
  const { stemKana } = stripMunicipalitySuffix(name, kana);
  return toRomaji(stemKana).toUpperCase();
}

const PREFECTURES = [
  ['01', '北海道', 'HOKKAIDO'],   ['02', '青森県', 'AOMORI'],     ['03', '岩手県', 'IWATE'],
  ['04', '宮城県', 'MIYAGI'],     ['05', '秋田県', 'AKITA'],      ['06', '山形県', 'YAMAGATA'],
  ['07', '福島県', 'FUKUSHIMA'],  ['08', '茨城県', 'IBARAKI'],    ['09', '栃木県', 'TOCHIGI'],
  ['10', '群馬県', 'GUNMA'],      ['11', '埼玉県', 'SAITAMA'],    ['12', '千葉県', 'CHIBA'],
  ['13', '東京都', 'TOKYO'],      ['14', '神奈川県', 'KANAGAWA'], ['15', '新潟県', 'NIIGATA'],
  ['16', '富山県', 'TOYAMA'],     ['17', '石川県', 'ISHIKAWA'],   ['18', '福井県', 'FUKUI'],
  ['19', '山梨県', 'YAMANASHI'],  ['20', '長野県', 'NAGANO'],     ['21', '岐阜県', 'GIFU'],
  ['22', '静岡県', 'SHIZUOKA'],   ['23', '愛知県', 'AICHI'],      ['24', '三重県', 'MIE'],
  ['25', '滋賀県', 'SHIGA'],      ['26', '京都府', 'KYOTO'],      ['27', '大阪府', 'OSAKA'],
  ['28', '兵庫県', 'HYOGO'],      ['29', '奈良県', 'NARA'],       ['30', '和歌山県', 'WAKAYAMA'],
  ['31', '鳥取県', 'TOTTORI'],    ['32', '島根県', 'SHIMANE'],    ['33', '岡山県', 'OKAYAMA'],
  ['34', '広島県', 'HIROSHIMA'],  ['35', '山口県', 'YAMAGUCHI'],  ['36', '徳島県', 'TOKUSHIMA'],
  ['37', '香川県', 'KAGAWA'],     ['38', '愛媛県', 'EHIME'],      ['39', '高知県', 'KOCHI'],
  ['40', '福岡県', 'FUKUOKA'],    ['41', '佐賀県', 'SAGA'],       ['42', '長崎県', 'NAGASAKI'],
  ['43', '熊本県', 'KUMAMOTO'],   ['44', '大分県', 'OITA'],       ['45', '宮崎県', 'MIYAZAKI'],
  ['46', '鹿児島県', 'KAGOSHIMA'], ['47', '沖縄県', 'OKINAWA'],
];

// Designated cities (政令指定都市): wards have codes parent+1 .. parent+29.
// (Largest is 大阪市 with 24 wards, smallest is 相模原市 with 3 — all fit.)
// The +30 gap to the next designated parent in the same prefecture (e.g.
// 横浜 14100 → 川崎 14130) means a numeric-range check unambiguously
// identifies the parent without the prefix-mismatch bugs that ate
// 14101-14109 (横浜) or 28110-28111 (神戸) under the old scheme.
const DESIGNATED = [
  ['01100', '札幌市',    'SAPPORO'],
  ['04100', '仙台市',    'SENDAI'],
  ['11100', 'さいたま市', 'SAITAMA-C'],
  ['12100', '千葉市',    'CHIBA-C'],
  ['14100', '横浜市',    'YOKOHAMA'],
  ['14130', '川崎市',    'KAWASAKI'],
  ['14150', '相模原市',  'SAGAMIHARA'],
  ['15100', '新潟市',    'NIIGATA-C'],
  ['22100', '静岡市',    'SHIZUOKA-C'],
  ['22130', '浜松市',    'HAMAMATSU'],
  ['23100', '名古屋市',  'NAGOYA'],
  ['26100', '京都市',    'KYOTO-C'],
  ['27100', '大阪市',    'OSAKA-C'],
  ['27140', '堺市',      'SAKAI'],
  ['28100', '神戸市',    'KOBE'],
  ['33100', '岡山市',    'OKAYAMA-C'],
  ['34100', '広島市',    'HIROSHIMA-C'],
  ['40100', '北九州市',  'KITAKYUSHU'],
  ['40130', '福岡市',    'FUKUOKA-C'],
  ['43100', '熊本市',    'KUMAMOTO-C'],
];

function findDesignatedParent(code) {
  // DESIGNATED is sorted; pick the LAST eligible parent (closest below
  // the ward code) so 14151 maps to 14150 (相模原市), not to 14130 (川崎市).
  const n = +code;
  let best = null;
  for (const [parentCode, name, reading] of DESIGNATED) {
    const p = +parentCode;
    if (p >= n) break;
    if (n - p < 30) best = { code: parentCode, name, reading };
  }
  return best;
}

// True for 23特別区 (Tokyo, codes 13101-13123): treat as standalone.
function isSpecialWard(code) {
  return code.startsWith('13') && +code.slice(2) >= 101 && +code.slice(2) <= 123;
}

// Pool: simple concurrency limiter for fetches.
async function pool(items, limit, fn) {
  const results = [];
  let cursor = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

async function fetchPrefectureFiles(prefCode) {
  const dir = path.join(NIIYZ_GEOJSON, prefCode);
  const entries = await fs.readdir(dir);
  return entries
    .filter(e => e.endsWith('.json'))
    .map(e => e.replace('.json', ''))
    .sort();
}

async function fetchGeoJson(prefCode, code) {
  return JSON.parse(await fs.readFile(path.join(NIIYZ_GEOJSON, prefCode, `${code}.json`), 'utf8'));
}

function extractPolygons(geo) {
  // Returns flattened array of Polygons (each = ring[]). MultiPolygon is split.
  const polygons = [];
  let name = '';
  for (const f of geo.features) {
    name = f.properties.N03_004 || name;
    if (f.geometry.type === 'Polygon') polygons.push(f.geometry.coordinates);
    else if (f.geometry.type === 'MultiPolygon') {
      for (const p of f.geometry.coordinates) polygons.push(p);
    }
  }
  return { name, polygons };
}

function bboxOf(polygons) {
  let n = -Infinity, s = Infinity, e = -Infinity, w = Infinity;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const [lng, lat] of ring) {
        if (lat > n) n = lat;
        if (lat < s) s = lat;
        if (lng > e) e = lng;
        if (lng < w) w = lng;
      }
    }
  }
  return { north: n, south: s, east: e, west: w };
}

// Shoelace on the outer ring; returns absolute signed area in deg².
function ringAreaDeg2(ring) {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

// Approximate polygon area in km² using shoelace on the outer ring +
// cosLat correction at the polygon's center. Holes are ignored — for
// classification purposes the outer ring is what matters.
function polygonAreaKm2(polygon) {
  const bb = bboxOf([polygon]);
  const centerLat = (bb.north + bb.south) / 2;
  const cosLat = Math.cos((centerLat * Math.PI) / 180);
  const a = ringAreaDeg2(polygon[0]) * cosLat;
  return a * 111 * 111;
}

// Approximate min distance between two lat/lng bboxes in km. 0 when they
// overlap. Used as a fast proxy for "polygon i is far from main" — exact
// point-to-point min distance is O(n*m) per pair and not worth the cost
// at our scale, while bbox-to-bbox is conservative (returns 0 whenever
// the polygons interlock, which is exactly when we'd want to keep them).
function bboxDistanceKm(a, b) {
  const aLat = (a.north + a.south) / 2;
  const bLat = (b.north + b.south) / 2;
  const cosLat = Math.cos((((aLat + bLat) / 2) * Math.PI) / 180);
  let dx = 0;
  if (a.west > b.east) dx = a.west - b.east;
  else if (b.west > a.east) dx = b.west - a.east;
  let dy = 0;
  if (a.south > b.north) dy = a.south - b.north;
  else if (b.south > a.north) dy = b.south - a.north;
  return Math.hypot(dx * cosLat * 111, dy * 111);
}

// Island-trimming thresholds. See docs/build-cities-classification (the
// rationale lives there) — α/β are the level-1 "drop tiny + remote" rule;
// δ is the archipelago-guard ratio that disables main-only trimming when
// no single polygon dominates (小笠原村, 十島村, 三島村, etc.).
const ALPHA = 0.02; // area_i / area_main below this is candidate to drop
const BETA  = 0.5;  // dist_i / √area_main above this is candidate to drop
const DELTA = 0.5;  // area_main / area_total below this → archipelago

// niiyz frequently packs offshore islands as additional rings inside a
// single Polygon (e.g. 萩市's 見島・大島, 唐津市's 加唐島群, 八丈町's 八丈
// 小島). Under the GeoJSON spec those are holes, but niiyz uses them as
// land. For classification we need each ring as its own component, so
// promote rings to single-ring "polygons" before bucketing. This stays
// faithful to the downstream `polygonsToPath` which already flattens
// rings into independent fills.
function promoteRingsToPolygons(polygons) {
  return polygons.flatMap(polygon => polygon.map(ring => [ring]));
}

// Split a city's polygons into three buckets:
//   - main: the largest connected component (or [], when archipelago)
//   - near: kept at level 1 (standard) and level 0 (full)
//   - far:  kept only at level 0
//
// Archipelago cities (no dominant main) → main empty, all polygons in
// `near`. The view then surfaces the same silhouette for level 1 and
// level 2 (本島のみ falls back to standard).
function classifyPolygons(polygons) {
  const units = promoteRingsToPolygons(polygons);
  if (units.length <= 1) {
    return { main: units.slice(), near: [], far: [], archipelago: false };
  }
  const enriched = units.map(p => ({
    p,
    bb: bboxOf([p]),
    area: polygonAreaKm2(p),
  }));
  enriched.sort((a, b) => b.area - a.area);
  const total = enriched.reduce((s, e) => s + e.area, 0);
  const main = enriched[0];
  if (total === 0 || main.area / total < DELTA) {
    return {
      main: [],
      near: enriched.map(e => e.p),
      far: [],
      archipelago: true,
    };
  }
  const sqrtMain = Math.sqrt(main.area);
  const near = [];
  const far = [];
  for (const e of enriched.slice(1)) {
    const ratio = e.area / main.area;
    const dist = bboxDistanceKm(main.bb, e.bb);
    if (ratio < ALPHA && dist / sqrtMain > BETA) {
      far.push(e.p);
    } else {
      near.push(e.p);
    }
  }
  return { main: [main.p], near, far, archipelago: false };
}

// Keep this in lockstep with lib/projection.ts. cosLat compensates for
// degrees of longitude being shorter than latitude at non-equator
// latitudes; the longer post-cosLat dimension fills 200 with the shorter
// one centered. The runtime GPS-pin projection uses the exact same
// formula so the pin always lands at the geographically correct spot
// inside the rendered silhouette.
function projectPolygons(polygons, bbox) {
  const { east: E, west: W, north: N, south: S } = bbox;
  const centerLat = (N + S) / 2;
  const cosLat = Math.cos((centerLat * Math.PI) / 180);
  const dxScaled = (E - W) * cosLat;
  const dyScaled = N - S;
  const span = Math.max(dxScaled, dyScaled) || 1;
  const scale = 200 / span;
  const offsetX = (200 - dxScaled * scale) / 2;
  const offsetY = (200 - dyScaled * scale) / 2;
  return polygons.map(polygon => polygon.map(ring => ring.map(([lng, lat]) => [
    (lng - W) * cosLat * scale + offsetX,
    (N - lat) * scale + offsetY,
  ])));
}

// Douglas-Peucker on a single ring (xy-array). tol in SVG units.
function simplifyRing(ring, tol) {
  if (ring.length < 4) return ring;
  // Closed ring: keep first==last
  const first = ring[0], last = ring[ring.length - 1];
  const closed = first[0] === last[0] && first[1] === last[1];
  const open = closed ? ring.slice(0, -1) : ring;
  if (open.length < 3) return ring;

  const keep = new Uint8Array(open.length);
  keep[0] = 1; keep[open.length - 1] = 1;
  const stack = [[0, open.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    if (b - a < 2) continue;
    let maxD = 0, idx = -1;
    const [ax, ay] = open[a], [bx, by] = open[b];
    const ddx = bx - ax, ddy = by - ay;
    const len2 = ddx * ddx + ddy * ddy || 1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = open[i];
      const t = Math.max(0, Math.min(1, ((px - ax) * ddx + (py - ay) * ddy) / len2));
      const cx = ax + t * ddx, cy = ay + t * ddy;
      const d = Math.hypot(px - cx, py - cy);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol && idx !== -1) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  const out = [];
  for (let i = 0; i < open.length; i++) if (keep[i]) out.push(open[i]);
  if (closed) out.push(out[0]);
  return out;
}

function ringToPath(ring) {
  if (ring.length < 2) return '';
  const fmt = (v) => (Math.round(v * 100) / 100).toString();
  const parts = ring.map(([x, y]) => `${fmt(x)},${fmt(y)}`);
  return `M ${parts[0]} L ${parts.slice(1).join(' L ')} Z`;
}

function polygonsToPath(polygons, tol = 0.5) {
  return polygons
    .flatMap(polygon => polygon.map(ring => simplifyRing(ring, tol)))
    .filter(ring => {
      // Drop sub-pixel rings — niiyz packs tiny structures (buildings, etc.)
      // as ring siblings, which after the union-fix are preserved as their
      // own polygons. At 200×200 they're invisible but inflate the path.
      if (ring.length < 4) return false;
      let n = -Infinity, s = Infinity, e = -Infinity, w = Infinity;
      for (const [x, y] of ring) {
        if (y > n) n = y; if (y < s) s = y;
        if (x > e) e = x; if (x < w) w = x;
      }
      return (e - w) >= tol || (n - s) >= tol;
    })
    .map(ringToPath)
    .filter(Boolean)
    .join(' ');
}

function categorize(code) {
  const sub = +code.slice(2);
  if (sub < 200) return 'ward'; // 行政区 (designated city subdivision) or 特別区
  if (sub < 300) return 'city';
  if (sub < 400) return 'town';
  return 'village';
}

function readingForCode(code, name, designatedReading) {
  // We don't have a kana/romaji index for every municipality. Return
  // the raw kanji name as the "reading" placeholder; UI can still use
  // it. Designated cities and known prefectures get hand-curated romaji.
  if (designatedReading) return designatedReading;
  return name;
}

async function buildPrefecture(prefCode, prefName) {
  const codes = await fetchPrefectureFiles(prefCode);

  const collectors = new Map(); // designated parent code → { name, reading, polygons }
  const standalone = []; // { code, name, polygons }

  await pool(codes, 8, async (code) => {
    const geo = await fetchGeoJson(prefCode, code);
    const { name, polygons } = extractPolygons(geo);

    const cat = categorize(code);
    const designated = findDesignatedParent(code);

    if (designated && cat === 'ward') {
      let bucket = collectors.get(designated.code);
      if (!bucket) {
        // Keep wards keyed by their own code so the merge order is deterministic
        // regardless of pool() arrival order — designated-city silhouettes would
        // otherwise diff on every rebuild.
        bucket = { code: designated.code, name: designated.name, reading: designated.reading, byWard: {} };
        collectors.set(designated.code, bucket);
      }
      bucket.byWard[code] = polygons;
    } else if (cat === 'ward' && !isSpecialWard(code)) {
      // Unknown ward — skip (shouldn't occur)
      return;
    } else {
      standalone.push({ code, name, reading: name, polygons });
    }
  });

  // Designated-city aggregates: union all ward polygons so adjacent
  // boundaries collapse into a single outline (otherwise the rendered
  // silhouette shows internal ward dividers as double-stroked lines).
  const aggregated = [...collectors.values()].map(b => {
    const wardCodes = Object.keys(b.byWard).sort();
    // niiyz packs offshore islands as additional rings inside a single
    // Polygon (e.g. 玄界島 in 福岡市西区, 八景島 in 横浜市金沢区, 馬島 in
    // 北九州市). polygon-clipping treats every non-first ring as a hole,
    // which silently strips those islands from the merged silhouette.
    // Promote each ring to its own single-ring Polygon so the union sees
    // every land mass as a distinct shape.
    const inputs = wardCodes.map(k =>
      b.byWard[k].flatMap(polygon => polygon.map(ring => [ring])),
    );
    const merged = inputs.length === 1
      ? inputs[0]
      : polygonClipping.union(inputs[0], ...inputs.slice(1));
    // Result is a MultiPolygon (array of Polygons) — match the rest of the
    // pipeline which expects an array of Polygons.
    return {
      code: b.code,
      name: b.name,
      reading: b.reading,
      polygons: merged,
    };
  });
  const all = [...standalone, ...aggregated].sort((a, b) => a.code.localeCompare(b.code));

  // Project + simplify a subset of polygons against their own bbox, emitting
  // both the SVG path and the rounded bbox the runtime needs. Returns null
  // when the subset is empty so callers can omit the field entirely.
  function emitBucket(polys) {
    if (polys.length === 0) return null;
    const bb = bboxOf(polys);
    return {
      path: polygonsToPath(projectPolygons(polys, bb), 0.5),
      bounds: {
        north: +bb.north.toFixed(4),
        south: +bb.south.toFixed(4),
        east:  +bb.east.toFixed(4),
        west:  +bb.west.toFixed(4),
      },
    };
  }

  return all.map(({ code, name, polygons }) => {
    const { main, near, far, archipelago } = classifyPolygons(polygons);

    // `path` / `bounds` are the canonical level-1 (standard) silhouette —
    // always present, drives the GPS-pin projection and the default render.
    // For archipelago cities `main` is empty by design; everything sits in
    // `near` so the standard view shows all islands.
    const standard = emitBucket([...main, ...near]);
    const full = far.length > 0 ? emitBucket([...main, ...near, ...far]) : null;
    const mainOnly = near.length > 0 && !archipelago ? emitBucket(main) : null;

    const kana = kanaFor(code);
    const subregion = prefCode === '01' ? hokkaidoSubregionOf(code) : null;
    const out = {
      id: code,
      name,
      reading: readingFor(code, name),
      path: standard.path,
      bounds: standard.bounds,
    };
    if (full) {
      out.pathFull = full.path;
      out.boundsFull = full.bounds;
    }
    if (mainOnly) {
      out.pathMain = mainOnly.path;
      out.boundsMain = mainOnly.bounds;
    }
    if (kana) out.kana = kana;
    if (subregion) out.subregion = subregion;
    return out;
  });
}

async function emitBoundsIndex() {
  // Flat array of every municipality's bbox (~140 KB). Loaded once on the
  // top page so client-side GPS can match a municipality without fetching
  // every prefecture's full polygon JSON. Uses the *full* bounds (level 0)
  // so users on remote islands still match their parent municipality —
  // the runtime silhouette may trim those islands at level 1/2, but the
  // GPS match should remain inclusive.
  const citiesDir = path.join(OUT_DIR, 'cities');
  const files = (await fs.readdir(citiesDir)).filter(f => /^\d+\.json$/.test(f)).sort();
  const out = [];
  for (const f of files) {
    const prefCode = f.replace('.json', '');
    const cities = JSON.parse(await fs.readFile(path.join(citiesDir, f), 'utf8'));
    for (const c of cities) {
      const b = c.boundsFull ?? c.bounds;
      out.push({ code: c.id, prefCode, name: c.name, ...b });
    }
  }
  const json = JSON.stringify(out);
  await fs.writeFile(path.join(OUT_DIR, 'bounds.json'), json);
  console.log(`bounds.json: ${out.length} entries, ${(json.length / 1024).toFixed(1)} KB`);
}

async function main() {
  const onlyPref = process.argv[2]; // optional: build a single prefecture
  await fs.mkdir(path.join(OUT_DIR, 'cities'), { recursive: true });

  const targets = onlyPref
    ? PREFECTURES.filter(([c]) => c === onlyPref)
    : PREFECTURES;

  let total = 0;
  let totalBytes = 0;
  for (const [code, name, reading] of targets) {
    process.stdout.write(`${code} ${name}…`);
    const cities = await buildPrefecture(code, name);
    const json = JSON.stringify(cities);
    const file = path.join(OUT_DIR, 'cities', `${code}.json`);
    await fs.writeFile(file, json);
    total += cities.length;
    totalBytes += json.length;
    process.stdout.write(` ${cities.length} entries, ${(json.length / 1024).toFixed(1)} KB\n`);
  }

  if (!onlyPref) {
    const index = PREFECTURES.map(([code, name, reading]) => ({ code, name, reading }));
    await fs.writeFile(path.join(OUT_DIR, 'prefectures.json'), JSON.stringify(index));
    console.log(`\nTotal: ${total} entries across ${targets.length} prefectures, ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
  }

  await emitBoundsIndex();
}

main().catch(e => { console.error(e); process.exit(1); });
