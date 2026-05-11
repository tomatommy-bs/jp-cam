// One-time enrichment: add `kana` (and Hokkaido `subregion`) fields to the
// already-generated public/data/cities/{code}.json files without re-fetching
// the niiyz GeoJSON source.
//
// `kana` is looked up by 5-digit municipality code in
// scripts/municipality-kana.json (distilled from code4fukui/localgovjp).
// `subregion` is set only for Hokkaido entries — JIS X 0402 code ranges map
// directly to the 14 振興局.
//
// Run: node scripts/enrich-cities-kana.mjs

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { hokkaidoSubregionOf } from './hokkaido-subregion.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CITIES_DIR = path.join(ROOT, 'public', 'data', 'cities');

const KANA_INDEX = JSON.parse(
  await fs.readFile(path.join(__dirname, 'municipality-kana.json'), 'utf8'),
);

function kanaFor(code) {
  let kana = KANA_INDEX[code];
  if (!kana) return null;
  const sp = kana.lastIndexOf(' ');
  if (sp >= 0) kana = kana.slice(sp + 1);
  return kana;
}

async function main() {
  const files = (await fs.readdir(CITIES_DIR)).filter(f => /^\d+\.json$/.test(f)).sort();
  let totalCities = 0;
  let withKana = 0;
  let withSubregion = 0;

  for (const f of files) {
    const prefCode = f.replace('.json', '');
    const file = path.join(CITIES_DIR, f);
    const cities = JSON.parse(await fs.readFile(file, 'utf8'));
    const enriched = cities.map(c => {
      const out = { ...c };
      const kana = kanaFor(c.id);
      if (kana) { out.kana = kana; withKana++; }
      if (prefCode === '01') {
        const sub = hokkaidoSubregionOf(c.id);
        if (sub) { out.subregion = sub; withSubregion++; }
      }
      return out;
    });
    totalCities += cities.length;
    await fs.writeFile(file, JSON.stringify(enriched));
    process.stdout.write(`${prefCode}: ${cities.length} entries\n`);
  }

  console.log(`\nEnriched ${totalCities} cities — kana: ${withKana}, subregion: ${withSubregion}`);
}

main().catch(e => { console.error(e); process.exit(1); });
