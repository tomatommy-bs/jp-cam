'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin, Loader2 } from 'lucide-react';

import { findMunicipality, loadBounds } from '@/lib/cities-data';
import type { Prefecture } from '@/lib/cities-data';

type Status =
  | { kind: 'idle' }
  | { kind: 'locating' }
  | { kind: 'matched'; prefCode: string; prefName: string; cityCode: string; cityName: string }
  | { kind: 'denied' }
  | { kind: 'unmatched' }
  | { kind: 'unsupported' };

export default function LocatePrompt({ prefectures }: { prefectures: Prefecture[] }) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setStatus({ kind: 'unsupported' });
      return;
    }
    let cancelled = false;
    setStatus({ kind: 'locating' });
    Promise.all([
      new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false, maximumAge: 30_000, timeout: 10_000,
        });
      }),
      loadBounds(),
    ]).then(([pos, bounds]) => {
      if (cancelled) return;
      const match = findMunicipality({ lat: pos.coords.latitude, lng: pos.coords.longitude }, bounds);
      if (!match) { setStatus({ kind: 'unmatched' }); return; }
      const pref = prefectures.find(p => p.code === match.prefCode);
      setStatus({
        kind: 'matched',
        prefCode: match.prefCode,
        prefName: pref?.name ?? match.prefCode,
        cityCode: match.code,
        cityName: match.name,
      });
    }).catch(() => {
      if (!cancelled) setStatus({ kind: 'denied' });
    });
    return () => { cancelled = true; };
  }, [prefectures]);

  if (status.kind === 'idle' || status.kind === 'unsupported' || status.kind === 'denied' || status.kind === 'unmatched') {
    return null;
  }

  if (status.kind === 'locating') {
    return (
      <div className="mx-3 mb-3 rounded-md border border-white/10 bg-white/5 px-4 py-3 flex items-center gap-2 text-xs text-gray-300">
        <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
        現在地を確認中…
      </div>
    );
  }

  // matched
  return (
    <Link
      href={`/${status.prefCode}?city=${status.cityCode}`}
      className="mx-3 mb-3 rounded-md border border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/20 active:bg-amber-400/30 px-4 py-3 flex items-center gap-3 transition-colors"
    >
      <MapPin className="w-5 h-5 text-amber-400 shrink-0" />
      <div className="flex-1">
        <div className="text-[10px] text-amber-400 tracking-[0.15em]">CURRENT LOCATION</div>
        <div className="text-sm font-bold leading-tight">{status.cityName}</div>
        <div className="text-[10px] text-gray-300 mt-0.5">{status.prefName}</div>
      </div>
      <span className="text-xs text-gray-300">→</span>
    </Link>
  );
}
