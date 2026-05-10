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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'data');
const NIIYZ_RAW = 'https://raw.githubusercontent.com/niiyz/JapanCityGeoJson/master/geojson';

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

// Designated cities (政令指定都市): code = 5-digit parent, wardPrefix matches
// the leading 4 digits of all child administrative-ward codes.
const DESIGNATED = [
  ['01100', '札幌市',    'SAPPORO',   '0110'],
  ['04100', '仙台市',    'SENDAI',    '0410'],
  ['11100', 'さいたま市', 'SAITAMA-C', '1111'],
  ['12100', '千葉市',    'CHIBA-C',   '1211'],
  ['14100', '横浜市',    'YOKOHAMA',  '1411'],
  ['14130', '川崎市',    'KAWASAKI',  '1413'],
  ['14150', '相模原市',  'SAGAMIHARA','1415'],
  ['15100', '新潟市',    'NIIGATA-C', '1510'],
  ['22100', '静岡市',    'SHIZUOKA-C','2210'],
  ['22130', '浜松市',    'HAMAMATSU', '2213'],
  ['23100', '名古屋市',  'NAGOYA',    '2311'],
  ['26100', '京都市',    'KYOTO-C',   '2610'],
  ['27100', '大阪市',    'OSAKA-C',   '2711'],
  ['27140', '堺市',      'SAKAI',     '2714'],
  ['28100', '神戸市',    'KOBE',      '2810'],
  ['33100', '岡山市',    'OKAYAMA-C', '3310'],
  ['34100', '広島市',    'HIROSHIMA-C','3410'],
  ['40100', '北九州市',  'KITAKYUSHU','4010'],
  ['40130', '福岡市',    'FUKUOKA-C', '4013'],
  ['43100', '熊本市',    'KUMAMOTO-C','4310'],
];

function findDesignatedParent(code) {
  for (const [parentCode, name, reading, prefix] of DESIGNATED) {
    if (code.startsWith(prefix) && code !== parentCode && +code.slice(2) < 200) {
      return { code: parentCode, name, reading };
    }
  }
  return null;
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
  const url = `https://api.github.com/repos/niiyz/JapanCityGeoJson/contents/geojson/${prefCode}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to list prefecture ${prefCode}: ${res.status}`);
  const list = await res.json();
  return list
    .filter(e => e.name.endsWith('.json'))
    .map(e => e.name.replace('.json', ''))
    .sort();
}

async function fetchGeoJson(prefCode, code) {
  const res = await fetch(`${NIIYZ_RAW}/${prefCode}/${code}.json`);
  if (!res.ok) throw new Error(`Failed to fetch ${prefCode}/${code}: ${res.status}`);
  return await res.json();
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

function projectPolygons(polygons, bbox) {
  const { east: E, west: W, north: N, south: S } = bbox;
  const dx = E - W || 1;
  const dy = N - S || 1;
  return polygons.map(polygon => polygon.map(ring => ring.map(([lng, lat]) => [
    ((lng - W) / dx) * 200,
    ((N - lat) / dy) * 200,
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
        bucket = { code: designated.code, name: designated.name, reading: designated.reading, polygons: [] };
        collectors.set(designated.code, bucket);
      }
      bucket.polygons.push(...polygons);
    } else if (cat === 'ward' && !isSpecialWard(code)) {
      // Unknown ward — skip (shouldn't occur)
      return;
    } else {
      standalone.push({ code, name, reading: name, polygons });
    }
  });

  const all = [...standalone, ...collectors.values()].sort((a, b) => a.code.localeCompare(b.code));

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
}

main().catch(e => { console.error(e); process.exit(1); });
