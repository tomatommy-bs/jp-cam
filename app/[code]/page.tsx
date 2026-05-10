import { Suspense } from 'react';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { notFound } from 'next/navigation';

import type { Prefecture } from '@/lib/cities-data';

import CameraClient from './camera-client';

async function readPrefectures(): Promise<Prefecture[]> {
  const file = path.join(process.cwd(), 'public', 'data', 'prefectures.json');
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

export async function generateStaticParams() {
  const list = await readPrefectures();
  return list.map(p => ({ code: p.code }));
}

export default async function CameraPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const list = await readPrefectures();
  const pref = list.find(p => p.code === code);
  if (!pref) notFound();
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <CameraClient prefCode={pref.code} prefName={pref.name} />
    </Suspense>
  );
}
