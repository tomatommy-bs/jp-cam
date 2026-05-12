'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

import type { City } from '@/lib/cities-data';

import {
  filterCities,
  GOJUON_ROWS,
  HOKKAIDO_SUBREGIONS,
  type GojuonRowId,
} from './city-picker';

export type CityPickerSheetProps = {
  prefCode: string;
  prefName: string;
  cities: City[];
  cityIndex: number;
  onSelect: (index: number) => void;
  onClose: () => void;
};

export default function CityPickerSheet({
  prefCode,
  prefName,
  cities,
  cityIndex,
  onSelect,
  onClose,
}: CityPickerSheetProps) {
  const [query, setQuery] = useState('');
  const [row, setRow] = useState<GojuonRowId | null>(null);
  const [subregion, setSubregion] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selectedRef = useRef<HTMLButtonElement | null>(null);

  // ESC closes; autofocus the search input on open for fast typing.
  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Bring the currently-selected city into view on open so the user can see
  // which one is active even when the list is long.
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'center' });
  }, []);

  // Indices into the original cities array — we need them so onSelect can
  // dispatch `citySelected` by index without re-deriving it from the id.
  const indexed = useMemo(() => cities.map((city, idx) => ({ city, idx })), [cities]);

  const filtered = useMemo(
    () => filterCities(
      indexed.map(e => e.city),
      { query, row, subregion },
    ),
    [indexed, query, row, subregion],
  );

  const idToIndex = useMemo(() => {
    const m = new Map<string, number>();
    indexed.forEach(({ city, idx }) => m.set(city.id, idx));
    return m;
  }, [indexed]);

  const isHokkaido = prefCode === '01';

  const clearFilters = () => {
    setQuery('');
    setRow(null);
    setSubregion(null);
  };

  const anyFilter = !!query || row !== null || subregion !== null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black/95 backdrop-blur-md text-white">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-white/10">
        <div className="flex-1">
          <div className="text-[10px] text-gray-400 tracking-wider">PREFECTURE</div>
          <h2 className="text-sm font-bold">{prefName}・市区町村を選ぶ</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full hover:bg-white/10 active:bg-white/20"
          aria-label="閉じる"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 py-3 border-b border-white/10 space-y-3">
        <label className="flex items-center gap-2 bg-white/[0.08] border border-white/15 rounded-full px-3 py-2 focus-within:border-white/40 transition-colors">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            ref={inputRef}
            type="search"
            inputMode="search"
            placeholder="漢字・かな・ローマ字で検索"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-gray-500"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-0.5 rounded-full hover:bg-white/10"
              aria-label="検索クリア"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </label>

        {isHokkaido && (
          <div>
            <div className="text-[10px] text-gray-400 mb-1.5 tracking-wider">SUBREGION 振興局</div>
            <div className="flex flex-wrap gap-1.5">
              {HOKKAIDO_SUBREGIONS.map(s => {
                const active = subregion === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSubregion(active ? null : s.id)}
                    className={`px-2.5 py-1 rounded-full text-[11px] transition-colors ${
                      active
                        ? 'bg-amber-400 text-black font-semibold'
                        : 'bg-white/10 text-gray-200 hover:bg-white/20'
                    }`}
                    aria-pressed={active}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <div className="text-[10px] text-gray-400 mb-1.5 tracking-wider">50音</div>
          <div className="flex flex-wrap gap-1">
            {GOJUON_ROWS.map(r => {
              const active = row === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRow(active ? null : r.id)}
                  className={`min-w-[2.25rem] h-8 px-2 rounded-md text-[12px] transition-colors ${
                    active
                      ? 'bg-white text-black font-semibold'
                      : 'bg-white/10 text-gray-200 hover:bg-white/20'
                  }`}
                  aria-pressed={active}
                >
                  {r.label}
                </button>
              );
            })}
            {anyFilter && (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-1 px-2 h-8 rounded-md text-[11px] text-gray-300 hover:bg-white/10 active:bg-white/20"
              >
                クリア
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <div className="text-[10px] text-gray-500 mb-2 tabular-nums">
          {filtered.length} / {cities.length}
        </div>
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            該当する市区町村がありません
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {filtered.map(city => {
              const idx = idToIndex.get(city.id) ?? -1;
              const selected = idx === cityIndex;
              return (
                <button
                  key={city.id}
                  ref={selected ? selectedRef : undefined}
                  type="button"
                  onClick={() => onSelect(idx)}
                  className={`text-left px-3 py-2 rounded-lg transition-colors ${
                    selected
                      ? 'bg-white text-black'
                      : 'bg-white/[0.06] text-gray-100 hover:bg-white/15 active:bg-white/25'
                  }`}
                >
                  <div className="text-sm font-semibold leading-tight">{city.name}</div>
                  <div className={`text-[10px] leading-tight mt-0.5 tracking-[0.1em] ${selected ? 'text-gray-500' : 'text-gray-400'}`}>
                    {city.reading}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
