import { promises as fs } from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import { MapPin } from 'lucide-react';

import type { Prefecture } from '@/lib/cities-data';

import LocatePrompt from './locate-prompt';

async function readPrefectures(): Promise<Prefecture[]> {
  const file = path.join(process.cwd(), 'public', 'data', 'prefectures.json');
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

export default async function Home() {
  const prefectures = await readPrefectures();

  return (
    <main className="min-h-screen bg-black text-white flex flex-col">
      <header className="px-4 py-3 flex items-center gap-2 border-b border-white/5">
        <MapPin className="w-4 h-4 text-amber-400" />
        <div>
          <h1 className="text-sm font-bold tracking-wide">JP-CAM</h1>
          <p className="text-[9px] text-gray-400 leading-none">日本全国 市区町村シルエットカメラ</p>
        </div>
      </header>

      <LocatePrompt prefectures={prefectures} />

      <div className="px-4 pt-2 pb-2">
        <h2 className="text-xs text-gray-300 tracking-[0.15em]">都道府県を選んでください</h2>
      </div>

      <ul className="flex-1 px-3 pb-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 content-start">
        {prefectures.map(p => (
          <li key={p.code}>
            <Link
              href={`/${p.code}`}
              className="block w-full px-3 py-3 rounded-md bg-white/5 hover:bg-white/15 active:bg-white/25 border border-white/10 transition-colors"
            >
              <div className="text-sm font-bold leading-tight">{p.name}</div>
              <div className="text-[9px] text-gray-400 tracking-[0.15em] leading-none mt-1">{p.reading}</div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
