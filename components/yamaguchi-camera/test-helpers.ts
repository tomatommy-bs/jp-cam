import type { CapturedSnapshot, MaskMode, State } from './state';
import { init } from './state';

export function makeSnapshot(overrides: Partial<CapturedSnapshot> = {}): CapturedSnapshot {
  const i = init();
  return {
    width: 800,
    height: 600,
    cityId: 'shimonoseki',
    cityName: '下関市',
    cityReading: 'SHIMONOSEKI',
    cityPath: 'M 0 0',
    silhouetteTransform: 'translate(100,100) scale(1) translate(-100,-100)',
    silhouetteRotated: i.silhouetteRotated,
    color: i.color,
    opacity: i.opacity,
    strokeWidth: i.strokeWidth,
    dotPos: null,
    dotPosRaw: null,
    showLocationPin: i.showLocationPin,
    userCoords: null,
    capturedAt: 0,
    ...overrides,
  };
}

type Preview = { maskMode: MaskMode; strokeWidth: number; showLocation: boolean };

export function withCaptured(s: State, preview: Partial<Preview> = {}): State {
  const i = init();
  return {
    ...s,
    capture: {
      kind: 'captured',
      raw: 'raw',
      composed: 'composed',
      snapshot: makeSnapshot(),
      preview: {
        maskMode: i.maskMode,
        strokeWidth: i.strokeWidth,
        showLocation: i.showLocation,
        ...preview,
      },
    },
  };
}

export function withCamera(s: State, status: State['camera']): State {
  return { ...s, camera: status };
}

export function expectCaptured(s: State): Extract<State['capture'], { kind: 'captured' }> {
  if (s.capture.kind !== 'captured') {
    throw new Error(`expected capture.kind === 'captured', got '${s.capture.kind}'`);
  }
  return s.capture;
}
