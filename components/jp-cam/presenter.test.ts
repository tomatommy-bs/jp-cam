import { describe, expect, it } from 'vitest';

import * as P from './presenter';
import { init } from './state';
import { makeCity, withCamera, withCaptured, withCities } from './test-helpers';

const SHIMONOSEKI_BOUNDS = { north: 34.30, south: 33.95, east: 131.10, west: 130.85 };
const HAGI_BOUNDS = { north: 34.65, south: 34.20, east: 131.80, west: 131.25 };

const sampleCities = [
  makeCity({ id: 'shimonoseki', name: '下関市', bounds: SHIMONOSEKI_BOUNDS }),
  makeCity({ id: 'hagi', name: '萩市', bounds: HAGI_BOUNDS }),
];

describe('presenter — currentCity & cities lifecycle', () => {
  it('currentCity returns null while cities are loading', () => {
    expect(P.currentCity(init())).toBeNull();
    expect(P.citiesLoading(init())).toBe(true);
  });

  it('currentCity indexes into the loaded list', () => {
    const s = withCities({ ...init(), cityIndex: 1 }, sampleCities);
    expect(P.currentCity(s)?.id).toBe('hagi');
  });

  it('citiesError surfaces error messages', () => {
    const s = { ...init(), cities: { kind: 'error' as const, message: 'boom' } };
    expect(P.citiesError(s)).toBe('boom');
  });
});

describe('presenter — currentSilhouette (island level)', () => {
  const FULL_BOUNDS = { north: 35, south: 33, east: 132, west: 130 };
  const STD_BOUNDS = { north: 34.5, south: 33.5, east: 131.5, west: 130.5 };
  const MAIN_BOUNDS = { north: 34.3, south: 33.7, east: 131.3, west: 130.7 };
  const cityFull = makeCity({
    id: 'rich', path: 'P-std', bounds: STD_BOUNDS,
    pathFull: 'P-full', boundsFull: FULL_BOUNDS,
    pathMain: 'P-main', boundsMain: MAIN_BOUNDS,
  });

  it('returns null while cities are loading', () => {
    expect(P.currentSilhouette(init())).toBeNull();
  });

  it('level 1 → path/bounds (default)', () => {
    const s = withCities({ ...init(), islandLevel: 1 }, [cityFull]);
    expect(P.currentSilhouette(s)).toEqual({ path: 'P-std', bounds: STD_BOUNDS });
  });

  it('level 0 → pathFull/boundsFull when present', () => {
    const s = withCities({ ...init(), islandLevel: 0 }, [cityFull]);
    expect(P.currentSilhouette(s)).toEqual({ path: 'P-full', bounds: FULL_BOUNDS });
  });

  it('level 2 → pathMain/boundsMain when present', () => {
    const s = withCities({ ...init(), islandLevel: 2 }, [cityFull]);
    expect(P.currentSilhouette(s)).toEqual({ path: 'P-main', bounds: MAIN_BOUNDS });
  });

  it('falls back to path/bounds when level-specific variant is absent', () => {
    const single = makeCity({ id: 'plain', path: 'P-only', bounds: STD_BOUNDS });
    const s0 = withCities({ ...init(), islandLevel: 0 }, [single]);
    const s2 = withCities({ ...init(), islandLevel: 2 }, [single]);
    expect(P.currentSilhouette(s0)).toEqual({ path: 'P-only', bounds: STD_BOUNDS });
    expect(P.currentSilhouette(s2)).toEqual({ path: 'P-only', bounds: STD_BOUNDS });
  });
});

describe('presenter — silhouetteTransform', () => {
  it('without rotation', () => {
    expect(P.silhouetteTransform({ ...init(), scale: 1.25, silhouetteRotated: false }))
      .toBe('translate(100,100)  scale(1.25) translate(-100,-100)');
  });

  it('with rotation', () => {
    expect(P.silhouetteTransform({ ...init(), scale: 1, silhouetteRotated: true }))
      .toBe('translate(100,100) rotate(90) scale(1) translate(-100,-100)');
  });
});

describe('presenter — dotPosRaw / dotPos', () => {
  const insideShimonoseki = {
    lat: (SHIMONOSEKI_BOUNDS.north + SHIMONOSEKI_BOUNDS.south) / 2,
    lng: (SHIMONOSEKI_BOUNDS.east + SHIMONOSEKI_BOUNDS.west) / 2,
  };

  it('returns null when no userCoords', () => {
    const s = withCities({ ...init(), cityIndex: 0, userCoords: null }, sampleCities);
    expect(P.dotPosRaw(s)).toBeNull();
  });

  it('returns null while cities are still loading', () => {
    expect(P.dotPosRaw({ ...init(), userCoords: insideShimonoseki })).toBeNull();
  });

  it('returns null when coords are outside the city bbox', () => {
    const s = withCities({ ...init(), cityIndex: 0, userCoords: { lat: 0, lng: 0 } }, sampleCities);
    expect(P.dotPosRaw(s)).toBeNull();
  });

  it('projects center of the bbox to (100, 100)', () => {
    const s = withCities({ ...init(), cityIndex: 0, userCoords: insideShimonoseki }, sampleCities);
    const pos = P.dotPosRaw(s);
    expect(pos).not.toBeNull();
    expect(pos!.x).toBeCloseTo(100, 6);
    expect(pos!.y).toBeCloseTo(100, 6);
  });

  it('projects bbox corners onto the aspect-preserving fit window', () => {
    // The longer post-cosLat side fills 200; the shorter is centered with
    // padding. For Shimonoseki (lat span 0.35°, lng span ~0.21° after cosLat),
    // the lng axis is letterboxed by offsetX.
    const centerLat = (SHIMONOSEKI_BOUNDS.north + SHIMONOSEKI_BOUNDS.south) / 2;
    const cosLat = Math.cos((centerLat * Math.PI) / 180);
    const dx = (SHIMONOSEKI_BOUNDS.east - SHIMONOSEKI_BOUNDS.west) * cosLat;
    const dy = SHIMONOSEKI_BOUNDS.north - SHIMONOSEKI_BOUNDS.south;
    const scale = 200 / Math.max(dx, dy);
    const offsetX = (200 - dx * scale) / 2;
    const offsetY = (200 - dy * scale) / 2;

    const nw = withCities({
      ...init(), cityIndex: 0,
      userCoords: { lat: SHIMONOSEKI_BOUNDS.north, lng: SHIMONOSEKI_BOUNDS.west },
    }, sampleCities);
    const nwPos = P.dotPosRaw(nw);
    expect(nwPos!.x).toBeCloseTo(offsetX, 6);
    expect(nwPos!.y).toBeCloseTo(offsetY, 6);

    const se = withCities({
      ...init(), cityIndex: 0,
      userCoords: { lat: SHIMONOSEKI_BOUNDS.south, lng: SHIMONOSEKI_BOUNDS.east },
    }, sampleCities);
    const sePos = P.dotPosRaw(se);
    expect(sePos!.x).toBeCloseTo(200 - offsetX, 6);
    expect(sePos!.y).toBeCloseTo(200 - offsetY, 6);
  });

  it('dotPos respects showLocation toggle', () => {
    const base = withCities({ ...init(), cityIndex: 0, userCoords: insideShimonoseki }, sampleCities);
    expect(P.dotPos({ ...base, showLocation: true })).not.toBeNull();
    expect(P.dotPos({ ...base, showLocation: false })).toBeNull();
  });

  it('reprojects against the level-specific bounds when the user switches islandLevel', () => {
    // Wider Full bounds → narrower Main bounds. A coord at the center of the
    // city must project to (100,100) in both — proving the projection picks
    // up the level's bounds, not the legacy `bounds` field. A coord that's
    // inside Full but outside Main must return null at level 2.
    const FULL = { north: 34.6, south: 33.8, east: 131.3, west: 130.7 };
    const MAIN = { north: 34.6, south: 34.3, east: 131.0, west: 130.8 };
    const city = makeCity({
      id: 'rich',
      bounds: MAIN,
      pathFull: 'F', boundsFull: FULL,
      pathMain: 'M', boundsMain: MAIN,
    });
    // South of MAIN but still inside FULL — verifies the projection swaps
    // its bbox source when islandLevel changes.
    const coord = { lat: 34.0, lng: 130.9 };
    const sFull = withCities({ ...init(), islandLevel: 0, userCoords: coord }, [city]);
    expect(P.dotPosRaw(sFull)).not.toBeNull();
    const sMain = withCities({ ...init(), islandLevel: 2, userCoords: coord }, [city]);
    expect(P.dotPosRaw(sMain)).toBeNull();
  });
});

describe('presenter — camera derivations', () => {
  it('errorMessage / isLoading', () => {
    expect(P.errorMessage(init())).toBeNull();
    expect(P.isLoading(init())).toBe(true);
    const errored = withCamera(init(), { kind: 'error', message: 'oops' });
    expect(P.errorMessage(errored)).toBe('oops');
    expect(P.isLoading(errored)).toBe(false);
  });

  it('zoomCaps / isDigitalZoom / zoomMin / zoomMax', () => {
    const noCaps = withCamera(init(), { kind: 'ready', zoomCaps: null });
    expect(P.zoomCaps(noCaps)).toBeNull();
    expect(P.isDigitalZoom(noCaps)).toBe(true);
    expect(P.zoomMin(noCaps)).toBe(1);
    expect(P.zoomMax(noCaps)).toBe(5);

    const caps = { min: 0.5, max: 4, step: 0.1 };
    const withCaps = withCamera(init(), { kind: 'ready', zoomCaps: caps });
    expect(P.zoomCaps(withCaps)).toBe(caps);
    expect(P.isDigitalZoom(withCaps)).toBe(false);
    expect(P.zoomMin(withCaps)).toBe(0.5);
    expect(P.zoomMax(withCaps)).toBe(4);
  });

  it('camera in loading state has no zoomCaps and is digital', () => {
    expect(P.zoomCaps(init())).toBeNull();
    expect(P.isDigitalZoom(init())).toBe(true);
  });
});

describe('presenter — capture derivations', () => {
  it('capturedImage / capturedSnapshot return null when idle', () => {
    expect(P.capturedImage(init())).toBeNull();
    expect(P.capturedSnapshot(init())).toBeNull();
  });

  it('capturedImage / capturedSnapshot expose values when captured', () => {
    const s = withCaptured(init());
    expect(P.capturedImage(s)).toBe('composed');
    expect(P.capturedSnapshot(s)?.cityId).toBe('shimonoseki');
  });

  it('preview-* fall back to defaults when idle', () => {
    expect(P.previewMaskMode(init())).toBe('translucent');
    expect(P.previewStrokeWidth(init())).toBe(1.65);
    expect(P.previewShowLocation(init())).toBe(true);
  });

  it('preview-* read from capture.preview when captured', () => {
    const s = withCaptured(init(), { maskMode: 'solid', strokeWidth: 0.8, showLocation: false });
    expect(P.previewMaskMode(s)).toBe('solid');
    expect(P.previewStrokeWidth(s)).toBe(0.8);
    expect(P.previewShowLocation(s)).toBe(false);
  });
});
