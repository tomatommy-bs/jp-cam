import { describe, expect, it } from 'vitest';

import {
  buildSilhouetteSvg,
  cameraErrorMessage,
  captureFilename,
  computeCaptureCrop,
  deriveZoomCaps,
} from './compose';
import { makeSnapshot } from './test-helpers';

describe('computeCaptureCrop', () => {
  it('does not crop when video and container share the same aspect', () => {
    const c = computeCaptureCrop({
      videoWidth: 1920,
      videoHeight: 1080,
      containerWidth: 800,
      containerHeight: 450,
      zoom: 1,
      isDigitalZoom: false,
    });
    expect(c.srcX).toBeCloseTo(0, 6);
    expect(c.srcY).toBeCloseTo(0, 6);
    expect(c.srcWidth).toBeCloseTo(1920, 6);
    expect(c.srcHeight).toBeCloseTo(1080, 6);
    expect(c.destWidth).toBe(1920);
    expect(c.destHeight).toBe(1080);
  });

  it('crops horizontally when the video is wider than the container', () => {
    const c = computeCaptureCrop({
      videoWidth: 1920,
      videoHeight: 1080,
      containerWidth: 400,
      containerHeight: 600,
      zoom: 1,
      isDigitalZoom: false,
    });
    expect(c.srcY).toBe(0);
    expect(c.srcHeight).toBe(1080);
    expect(c.srcWidth).toBeCloseTo(720, 6);
    expect(c.srcX).toBeCloseTo((1920 - 720) / 2, 6);
  });

  it('crops vertically when the video is taller than the container', () => {
    const c = computeCaptureCrop({
      videoWidth: 1080,
      videoHeight: 1920,
      containerWidth: 600,
      containerHeight: 400,
      zoom: 1,
      isDigitalZoom: false,
    });
    expect(c.srcX).toBe(0);
    expect(c.srcWidth).toBe(1080);
    expect(c.srcHeight).toBeCloseTo(720, 6);
    expect(c.srcY).toBeCloseTo((1920 - 720) / 2, 6);
  });

  it('shrinks the source rect when digital zoom is engaged', () => {
    const c = computeCaptureCrop({
      videoWidth: 1000,
      videoHeight: 1000,
      containerWidth: 1000,
      containerHeight: 1000,
      zoom: 2,
      isDigitalZoom: true,
    });
    expect(c.srcWidth).toBe(500);
    expect(c.srcHeight).toBe(500);
    expect(c.srcX).toBe(250);
    expect(c.srcY).toBe(250);
    expect(c.destWidth).toBe(1000);
    expect(c.destHeight).toBe(1000);
  });

  it('ignores zoom when hardware zoom is in play (isDigitalZoom=false)', () => {
    const c = computeCaptureCrop({
      videoWidth: 1000,
      videoHeight: 1000,
      containerWidth: 1000,
      containerHeight: 1000,
      zoom: 3,
      isDigitalZoom: false,
    });
    expect(c.srcWidth).toBe(1000);
    expect(c.srcHeight).toBe(1000);
  });

  it('rounds destination dimensions but leaves source as float', () => {
    const c = computeCaptureCrop({
      videoWidth: 1000,
      videoHeight: 1000,
      containerWidth: 333,
      containerHeight: 333,
      zoom: 1,
      isDigitalZoom: false,
    });
    expect(Number.isInteger(c.destWidth)).toBe(true);
    expect(Number.isInteger(c.destHeight)).toBe(true);
  });
});

describe('buildSilhouetteSvg', () => {
  it('uses fill-opacity 1 for solid mask, 0.6 for translucent', () => {
    const snap = makeSnapshot();
    expect(buildSilhouetteSvg({ snapshot: snap, maskMode: 'solid', strokeWidth: 1, locationVisible: false }))
      .toContain('fill-opacity="1"');
    expect(buildSilhouetteSvg({ snapshot: snap, maskMode: 'translucent', strokeWidth: 1, locationVisible: false }))
      .toContain('fill-opacity="0.6"');
  });

  it('omits the location pin when no dotPosRaw', () => {
    const snap = makeSnapshot({ dotPosRaw: null });
    const svg = buildSilhouetteSvg({ snapshot: snap, maskMode: 'translucent', strokeWidth: 1, locationVisible: true });
    expect(svg).not.toContain('<circle');
  });

  it('omits the location pin when locationVisible is false even if dotPosRaw exists', () => {
    const snap = makeSnapshot({ dotPosRaw: { x: 100, y: 100 } });
    const svg = buildSilhouetteSvg({ snapshot: snap, maskMode: 'translucent', strokeWidth: 1, locationVisible: false });
    expect(svg).not.toContain('<circle');
  });

  it('renders the location pin at dotPosRaw when both visible and present', () => {
    const snap = makeSnapshot({ dotPosRaw: { x: 50, y: 75 } });
    const svg = buildSilhouetteSvg({ snapshot: snap, maskMode: 'translucent', strokeWidth: 1, locationVisible: true });
    expect(svg).toContain('cx="50"');
    expect(svg).toContain('cy="75"');
    expect(svg).toContain('fill="#ef4444"');
  });

  it('interpolates snapshot fields into the path/transform/viewbox', () => {
    const snap = makeSnapshot({
      width: 640,
      height: 480,
      cityPath: 'M 1 2',
      silhouetteTransform: 'rotate(45)',
      color: '#abcdef',
      opacity: 0.42,
    });
    const svg = buildSilhouetteSvg({ snapshot: snap, maskMode: 'translucent', strokeWidth: 2.5, locationVisible: false });
    expect(svg).toContain('width="640"');
    expect(svg).toContain('height="480"');
    expect(svg).toContain('d="M 1 2"');
    expect(svg).toContain('transform="rotate(45)"');
    expect(svg).toContain('stroke="#abcdef"');
    expect(svg).toContain('stroke-width="2.5"');
    expect(svg).toContain('opacity="0.42"');
  });
});

describe('captureFilename', () => {
  it('uses the cityId and provided timestamp', () => {
    expect(captureFilename('shimonoseki', 1700000000000)).toBe('yamaguchi_shimonoseki_1700000000000.png');
  });

  it('falls back to Date.now() when no timestamp is given', () => {
    const before = Date.now();
    const name = captureFilename('hagi');
    const after = Date.now();
    const match = name.match(/^yamaguchi_hagi_(\d+)\.png$/);
    expect(match).not.toBeNull();
    const ts = Number(match![1]);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});

describe('cameraErrorMessage', () => {
  it('maps NotAllowedError to the permission-denied message', () => {
    expect(cameraErrorMessage({ name: 'NotAllowedError' })).toBe('カメラへのアクセスが拒否されました');
  });

  it('maps NotFoundError to the not-found message', () => {
    expect(cameraErrorMessage({ name: 'NotFoundError' })).toBe('カメラが見つかりませんでした');
  });

  it('returns error.message when present and unknown name', () => {
    expect(cameraErrorMessage({ name: 'WeirdError', message: 'something broke' })).toBe('something broke');
  });

  it('falls back to the generic message for null/undefined/empty', () => {
    expect(cameraErrorMessage(null)).toBe('カメラを起動できませんでした');
    expect(cameraErrorMessage(undefined)).toBe('カメラを起動できませんでした');
    expect(cameraErrorMessage({})).toBe('カメラを起動できませんでした');
    expect(cameraErrorMessage({ message: '' })).toBe('カメラを起動できませんでした');
  });
});

describe('deriveZoomCaps', () => {
  it('returns null when raw is missing or has no max', () => {
    expect(deriveZoomCaps(undefined)).toBeNull();
    expect(deriveZoomCaps(null)).toBeNull();
    expect(deriveZoomCaps({})).toBeNull();
  });

  it('returns null when max <= min (i.e., no real zoom range)', () => {
    expect(deriveZoomCaps({ min: 1, max: 1 })).toBeNull();
    expect(deriveZoomCaps({ min: 2, max: 1 })).toBeNull();
  });

  it('defaults min to 1 and step to 0.1 when not provided', () => {
    expect(deriveZoomCaps({ max: 4 })).toEqual({ min: 1, max: 4, step: 0.1 });
  });

  it('honors a positive step', () => {
    expect(deriveZoomCaps({ min: 1, max: 4, step: 0.25 })).toEqual({ min: 1, max: 4, step: 0.25 });
  });

  it('falls back to 0.1 when step is zero or negative', () => {
    expect(deriveZoomCaps({ min: 1, max: 4, step: 0 })?.step).toBe(0.1);
    expect(deriveZoomCaps({ min: 1, max: 4, step: -1 })?.step).toBe(0.1);
  });
});
