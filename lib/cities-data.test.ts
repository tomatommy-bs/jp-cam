import { describe, expect, it } from 'vitest';

import { findMunicipality, type BoundsEntry } from './cities-data';

const yokohama: BoundsEntry = {
  code: '14100', prefCode: '14', name: '横浜市',
  north: 35.59, south: 35.31, east: 139.78, west: 139.45,
};
const kanagawa_prefSized: BoundsEntry = {
  code: '14201', prefCode: '14', name: '横須賀市',
  north: 35.30, south: 35.16, east: 139.79, west: 139.59,
};
const tokyoChiyoda: BoundsEntry = {
  code: '13101', prefCode: '13', name: '千代田区',
  north: 35.71, south: 35.67, east: 139.77, west: 139.74,
};
const tokyoMinato: BoundsEntry = {
  code: '13103', prefCode: '13', name: '港区',
  north: 35.68, south: 35.62, east: 139.77, west: 139.71,
};
const huge: BoundsEntry = {
  code: 'huge', prefCode: '99', name: '巨大な仮想自治体',
  north: 90, south: -90, east: 180, west: -180,
};

const sample = [yokohama, kanagawa_prefSized, tokyoChiyoda, tokyoMinato];

describe('findMunicipality', () => {
  it('returns null when no bbox contains the point', () => {
    expect(findMunicipality({ lat: 0, lng: 0 }, sample)).toBeNull();
  });

  it('matches a single bbox when only one contains the point', () => {
    // Center of 横浜市
    const m = findMunicipality({ lat: 35.45, lng: 139.6 }, sample);
    expect(m?.code).toBe('14100');
  });

  it('breaks ties by smallest bbox area', () => {
    // Point inside both 千代田区 and the giant fake bbox.
    const m = findMunicipality({ lat: 35.69, lng: 139.755 }, [tokyoChiyoda, huge]);
    expect(m?.code).toBe('13101');
  });

  it('prefers the more specific entry when nested bboxes both match', () => {
    // Point that sits inside 港区 only — 千代田区 should not match.
    const m = findMunicipality({ lat: 35.65, lng: 139.74 }, sample);
    expect(m?.code).toBe('13103');
  });

  it('inclusive on bbox edges', () => {
    const m = findMunicipality({ lat: tokyoChiyoda.north, lng: tokyoChiyoda.west }, [tokyoChiyoda]);
    expect(m?.code).toBe('13101');
  });

  it('returns null on empty bounds list', () => {
    expect(findMunicipality({ lat: 35, lng: 139 }, [])).toBeNull();
  });
});
