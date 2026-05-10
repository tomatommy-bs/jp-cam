import { describe, expect, it } from 'vitest';

import type { CapturedSnapshot, State } from './state';
import { CITIES, CITY_BOUNDS, init } from './state';
import * as P from './presenter';

const withCamera = (s: State, status: State['camera']): State => ({ ...s, camera: status });

const snapshot = (): CapturedSnapshot => ({
  width: 100,
  height: 100,
  cityId: 'shimonoseki',
  cityName: '下関市',
  cityReading: 'SHIMONOSEKI',
  cityPath: 'M 0 0',
  silhouetteTransform: '',
  color: '#fff',
  opacity: 1,
  strokeWidth: 1,
  dotPos: null,
  dotPosRaw: null,
  showLocationPin: true,
});

const captured = (s: State, preview: Partial<{ maskMode: 'translucent' | 'solid'; strokeWidth: number; showLocation: boolean }> = {}): State => ({
  ...s,
  capture: {
    kind: 'captured',
    raw: 'raw',
    composed: 'composed',
    snapshot: snapshot(),
    preview: {
      maskMode: 'translucent',
      strokeWidth: 1.65,
      showLocation: true,
      ...preview,
    },
  },
});

describe('presenter — currentCity & silhouetteTransform', () => {
  it('currentCity indexes into CITIES', () => {
    expect(P.currentCity({ ...init(), cityIndex: 2 })).toBe(CITIES[2]);
  });

  it('silhouetteTransform without rotation', () => {
    expect(P.silhouetteTransform({ ...init(), scale: 1.25, silhouetteRotated: false }))
      .toBe('translate(100,100)  scale(1.25) translate(-100,-100)');
  });

  it('silhouetteTransform with rotation', () => {
    expect(P.silhouetteTransform({ ...init(), scale: 1, silhouetteRotated: true }))
      .toBe('translate(100,100) rotate(90) scale(1) translate(-100,-100)');
  });
});

describe('presenter — dotPosRaw / dotPos', () => {
  const shimonoseki = CITY_BOUNDS.shimonoseki;
  const insideShimonoseki = {
    lat: (shimonoseki.north + shimonoseki.south) / 2,
    lng: (shimonoseki.east + shimonoseki.west) / 2,
  };

  it('returns null when no userCoords', () => {
    expect(P.dotPosRaw({ ...init(), cityIndex: 0, userCoords: null })).toBeNull();
  });

  it('returns null when coords are outside the city bbox', () => {
    expect(
      P.dotPosRaw({ ...init(), cityIndex: 0, userCoords: { lat: 0, lng: 0 } }),
    ).toBeNull();
  });

  it('projects center of the bbox to (100, 100)', () => {
    const pos = P.dotPosRaw({ ...init(), cityIndex: 0, userCoords: insideShimonoseki });
    expect(pos).not.toBeNull();
    expect(pos!.x).toBeCloseTo(100, 6);
    expect(pos!.y).toBeCloseTo(100, 6);
  });

  it('projects NW corner to (0, 0) and SE corner to (200, 200)', () => {
    const nw = P.dotPosRaw({
      ...init(),
      cityIndex: 0,
      userCoords: { lat: shimonoseki.north, lng: shimonoseki.west },
    });
    expect(nw).toEqual({ x: 0, y: 0 });
    const se = P.dotPosRaw({
      ...init(),
      cityIndex: 0,
      userCoords: { lat: shimonoseki.south, lng: shimonoseki.east },
    });
    expect(se).toEqual({ x: 200, y: 200 });
  });

  it('dotPos respects showLocation toggle', () => {
    const base = { ...init(), cityIndex: 0, userCoords: insideShimonoseki };
    expect(P.dotPos({ ...base, showLocation: true })).not.toBeNull();
    expect(P.dotPos({ ...base, showLocation: false })).toBeNull();
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
    const s = captured(init());
    expect(P.capturedImage(s)).toBe('composed');
    expect(P.capturedSnapshot(s)?.cityId).toBe('shimonoseki');
  });

  it('preview-* fall back to defaults when idle', () => {
    expect(P.previewMaskMode(init())).toBe('translucent');
    expect(P.previewStrokeWidth(init())).toBe(1.65);
    expect(P.previewShowLocation(init())).toBe(true);
  });

  it('preview-* read from capture.preview when captured', () => {
    const s = captured(init(), { maskMode: 'solid', strokeWidth: 0.8, showLocation: false });
    expect(P.previewMaskMode(s)).toBe('solid');
    expect(P.previewStrokeWidth(s)).toBe(0.8);
    expect(P.previewShowLocation(s)).toBe(false);
  });
});
