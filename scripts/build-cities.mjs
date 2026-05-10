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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'data');

// Source: niiyz/JapanCityGeoJson cloned locally. Set NIIYZ_DIR env var to
// override; otherwise we fall back to /tmp/niiyz. Clone with:
//   git clone --depth 1 https://github.com/niiyz/JapanCityGeoJson /tmp/niiyz
// This avoids the GitHub Contents-API rate limit on rebuilds.
const NIIYZ_DIR = process.env.NIIYZ_DIR ?? '/tmp/niiyz';
const NIIYZ_GEOJSON = path.join(NIIYZ_DIR, 'geojson');

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
    .flatMap(polygon => polygon.map(ring => ringToPath(simplifyRing(ring, tol))))
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
    // Each ward = array of GeoJSON Polygon (rings). polygon-clipping wants
    // MultiPolygons (= array of Polygons). Wrap and union them all.
    const inputs = wardCodes.map(k => b.byWard[k]); // array of MultiPolygons
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

  return all.map(({ code, name, reading, polygons }) => {
    const bounds = bboxOf(polygons);
    const projected = projectPolygons(polygons, bounds);
    const path = polygonsToPath(projected, 0.5);
    return {
      id: code,
      name,
      reading: typeof reading === 'string' ? reading : name,
      path,
      bounds: {
        north: +bounds.north.toFixed(4),
        south: +bounds.south.toFixed(4),
        east:  +bounds.east.toFixed(4),
        west:  +bounds.west.toFixed(4),
      },
    };
  });
}

async function emitBoundsIndex() {
  // Flat array of every municipality's bbox (~140 KB). Loaded once on the
  // top page so client-side GPS can match a municipality without fetching
  // every prefecture's full polygon JSON.
  const citiesDir = path.join(OUT_DIR, 'cities');
  const files = (await fs.readdir(citiesDir)).filter(f => /^\d+\.json$/.test(f)).sort();
  const out = [];
  for (const f of files) {
    const prefCode = f.replace('.json', '');
    const cities = JSON.parse(await fs.readFile(path.join(citiesDir, f), 'utf8'));
    for (const c of cities) {
      out.push({ code: c.id, prefCode, name: c.name, ...c.bounds });
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
