import { describe, expect, it } from 'vitest';

import type { City } from '@/lib/cities-data';

import { filterCities, GOJUON_ROWS, HOKKAIDO_SUBREGIONS, rowOf } from './city-picker';

function city(over: Partial<City> & Pick<City, 'id' | 'name'>): City {
  return {
    reading: 'X',
    path: '',
    bounds: { north: 0, south: 0, east: 0, west: 0 },
    ...over,
  };
}

const sapporo = city({ id: '01100', name: '札幌市', reading: 'SAPPORO', kana: 'さっぽろし', subregion: 'ishikari' });
const hakodate = city({ id: '01202', name: '函館市', reading: 'HAKODATE', kana: 'はこだてし', subregion: 'oshima' });
const otaru   = city({ id: '01203', name: '小樽市', reading: 'OTARU',    kana: 'おたるし',  subregion: 'shiribeshi' });
const asahikawa = city({ id: '01204', name: '旭川市', reading: 'ASAHIKAWA', kana: 'あさひかわし', subregion: 'kamikawa' });
const muroran = city({ id: '01205', name: '室蘭市', reading: 'MURORAN',   kana: 'むろらんし', subregion: 'iburi' });
const okhotskHosts = city({ id: '01695', name: '色丹村' }); // kana/subregion missing

const all = [sapporo, hakodate, otaru, asahikawa, muroran, okhotskHosts];

describe('rowOf', () => {
  it('groups vowels into あ行', () => {
    expect(rowOf('あさひかわし')).toBe('a');
    expect(rowOf('おたるし')).toBe('a');
  });

  it('strips dakuten / handakuten', () => {
    expect(rowOf('がっしゅう')).toBe('ka');
    expect(rowOf('ぱりじゃん')).toBe('ha');
    expect(rowOf('ざおう')).toBe('sa');
  });

  it('maps small kana to its base row', () => {
    expect(rowOf('っさ')).toBe('ta'); // small つ → つ → た行
    expect(rowOf('ゃま')).toBe('ya');
  });

  it('returns other when kana is missing or non-hiragana', () => {
    expect(rowOf(undefined)).toBe('other');
    expect(rowOf('')).toBe('other');
    expect(rowOf('Tokyo')).toBe('other');
  });

  it('covers wa-row including ん/を', () => {
    expect(rowOf('わこう')).toBe('wa');
    expect(rowOf('をどり')).toBe('wa');
    expect(rowOf('んなん')).toBe('wa');
  });
});

describe('filterCities', () => {
  it('no filters returns the full list (same order)', () => {
    expect(filterCities(all, {})).toEqual(all);
  });

  it('matches kanji substrings', () => {
    expect(filterCities(all, { query: '函館' })).toEqual([hakodate]);
  });

  it('matches hiragana queries', () => {
    expect(filterCities(all, { query: 'おたる' })).toEqual([otaru]);
  });

  it('matches katakana queries against the hiragana kana field', () => {
    expect(filterCities(all, { query: 'サッポロ' })).toEqual([sapporo]);
  });

  it('matches romaji queries case-insensitively', () => {
    expect(filterCities(all, { query: 'muroran' })).toEqual([muroran]);
    expect(filterCities(all, { query: 'Asahi' })).toEqual([asahikawa]);
  });

  it('filters by 50音 row', () => {
    // あ行: 旭川 (あさひかわし), 小樽 (おたるし)
    expect(filterCities(all, { row: 'a' })).toEqual([otaru, asahikawa]);
    // か行 is empty here
    expect(filterCities(all, { row: 'ka' })).toEqual([]);
    // 'other' picks up cities with no kana
    expect(filterCities(all, { row: 'other' })).toEqual([okhotskHosts]);
  });

  it('filters by Hokkaido subregion', () => {
    expect(filterCities(all, { subregion: 'ishikari' })).toEqual([sapporo]);
    expect(filterCities(all, { subregion: 'shiribeshi' })).toEqual([otaru]);
  });

  it('combines query + row + subregion (AND)', () => {
    // row=a is [otaru, asahikawa]; subregion=kamikawa narrows to asahikawa;
    // query 'asahi' matches.
    expect(filterCities(all, { row: 'a', subregion: 'kamikawa', query: 'asahi' }))
      .toEqual([asahikawa]);
    // Same combo but query that excludes the only candidate → empty.
    expect(filterCities(all, { row: 'a', subregion: 'kamikawa', query: 'otaru' }))
      .toEqual([]);
  });
});

describe('constants', () => {
  it('exposes 11 50音 rows (5 vowel rows + 5 consonant rows + other)', () => {
    expect(GOJUON_ROWS).toHaveLength(11);
    expect(GOJUON_ROWS.at(-1)?.id).toBe('other');
  });

  it('lists 14 Hokkaido subregions', () => {
    expect(HOKKAIDO_SUBREGIONS).toHaveLength(14);
    const ids = new Set(HOKKAIDO_SUBREGIONS.map(s => s.id));
    expect(ids.size).toBe(14);
  });
});
