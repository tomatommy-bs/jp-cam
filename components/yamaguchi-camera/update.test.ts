import { describe, expect, it } from 'vitest';

import type { State } from './state';
import { CITIES, SCALE_MAX, SCALE_MIN, init } from './state';
import { expectCaptured, makeSnapshot } from './test-helpers';
import { update } from './update';

const captured = (s: State): State =>
  update(s, {
    type: 'captureCompleted',
    raw: 'data:raw',
    composed: 'data:composed',
    snapshot: makeSnapshot(),
  });

describe('update — settingsHydrated', () => {
  it('applies a valid patch and flips settingsLoaded', () => {
    const s = update(init(), {
      type: 'settingsHydrated',
      patch: {
        cityIndex: 3,
        color: '#000000',
        opacity: 0.5,
        scale: 1.2,
        strokeWidth: 0.8,
        facingMode: 'user',
        maskMode: 'solid',
        showLocation: false,
        showLocationPin: false,
        silhouetteRotated: true,
      },
    });
    expect(s.cityIndex).toBe(3);
    expect(s.color).toBe('#000000');
    expect(s.opacity).toBe(0.5);
    expect(s.scale).toBe(1.2);
    expect(s.strokeWidth).toBe(0.8);
    expect(s.facingMode).toBe('user');
    expect(s.maskMode).toBe('solid');
    expect(s.showLocation).toBe(false);
    expect(s.showLocationPin).toBe(false);
    expect(s.silhouetteRotated).toBe(true);
    expect(s.settingsLoaded).toBe(true);
  });

  it('ignores garbage values and still flips settingsLoaded', () => {
    const before = init();
    const s = update(before, {
      type: 'settingsHydrated',
      patch: {
        cityIndex: 9999,
        // PersistedSettings.facingMode is typed `string`; runtime guard rejects
        // anything other than 'environment' | 'user', so no @ts-expect-error here.
        facingMode: 'sideways',
        // @ts-expect-error — runtime guard against bogus persisted data
        maskMode: 'banana',
        // @ts-expect-error — runtime guard against bogus persisted data
        showLocation: 'yes',
      },
    });
    expect(s.cityIndex).toBe(before.cityIndex);
    expect(s.facingMode).toBe(before.facingMode);
    expect(s.maskMode).toBe(before.maskMode);
    expect(s.showLocation).toBe(before.showLocation);
    expect(s.settingsLoaded).toBe(true);
  });

  it('treats negative cityIndex as invalid', () => {
    const s = update(init(), { type: 'settingsHydrated', patch: { cityIndex: -1 } });
    expect(s.cityIndex).toBe(0);
  });
});

describe('update — camera lifecycle', () => {
  it('cameraReady without zoom caps falls back to zoom=1', () => {
    const s = update(init(), { type: 'cameraReady', zoomCaps: null });
    expect(s.camera).toEqual({ kind: 'ready', zoomCaps: null });
    expect(s.zoom).toBe(1);
  });

  it('cameraReady with zoom caps anchors zoom to caps.min', () => {
    const s = update(init(), {
      type: 'cameraReady',
      zoomCaps: { min: 0.5, max: 4, step: 0.1 },
    });
    expect(s.zoom).toBe(0.5);
  });

  it('cameraFailed records the message', () => {
    const s = update(init(), { type: 'cameraFailed', message: 'nope' });
    expect(s.camera).toEqual({ kind: 'error', message: 'nope' });
  });

  it('cameraSwitchToggled flips facingMode and goes back to loading', () => {
    const ready = update(init(), { type: 'cameraReady', zoomCaps: null });
    const switched = update(ready, { type: 'cameraSwitchToggled' });
    expect(switched.facingMode).toBe('user');
    expect(switched.camera).toEqual({ kind: 'loading' });
    expect(switched.zoom).toBe(1);
  });
});

describe('update — zoom', () => {
  it('zoomNudged clamps to default 1..5 when no caps', () => {
    const ready = update(init(), { type: 'cameraReady', zoomCaps: null });
    const high = update(ready, { type: 'zoomNudged', delta: 99 });
    expect(high.zoom).toBe(5);
    const low = update(high, { type: 'zoomNudged', delta: -99 });
    expect(low.zoom).toBe(1);
  });

  it('zoomNudged clamps to caps when present', () => {
    const ready = update(init(), {
      type: 'cameraReady',
      zoomCaps: { min: 0.5, max: 2, step: 0.1 },
    });
    const high = update(ready, { type: 'zoomNudged', delta: 99 });
    expect(high.zoom).toBe(2);
    const low = update(high, { type: 'zoomNudged', delta: -99 });
    expect(low.zoom).toBe(0.5);
  });

  it('zoomNudged rounds to two decimal places', () => {
    const ready = update(init(), { type: 'cameraReady', zoomCaps: null });
    const s = update(ready, { type: 'zoomNudged', delta: 0.1 + 0.2 });
    expect(s.zoom).toBe(1.3);
  });
});

describe('update — silhouette settings', () => {
  it('citySelected sets cityIndex', () => {
    expect(update(init(), { type: 'citySelected', index: 4 }).cityIndex).toBe(4);
  });

  it('cityStepped wraps around both ends', () => {
    const s0 = init();
    const last = update(s0, { type: 'cityStepped', delta: -1 });
    expect(last.cityIndex).toBe(CITIES.length - 1);
    const first = update(last, { type: 'cityStepped', delta: 1 });
    expect(first.cityIndex).toBe(0);
  });

  it('colorSet, opacitySet, maskModeSet, silhouetteRotateToggled', () => {
    const s = update(init(), { type: 'colorSet', color: '#abcdef' });
    expect(s.color).toBe('#abcdef');
    expect(update(s, { type: 'opacitySet', opacity: 0.42 }).opacity).toBe(0.42);
    expect(update(s, { type: 'maskModeSet', mode: 'solid' }).maskMode).toBe('solid');
    expect(update(s, { type: 'silhouetteRotateToggled' }).silhouetteRotated).toBe(true);
  });

  it('scaleNudged clamps to SCALE_MIN..SCALE_MAX', () => {
    const high = update(init(), { type: 'scaleNudged', delta: 999 });
    expect(high.scale).toBe(SCALE_MAX);
    const low = update(init(), { type: 'scaleNudged', delta: -999 });
    expect(low.scale).toBe(SCALE_MIN);
  });

  it('strokeWidthSet sets value and closes the active menu', () => {
    const opened = update(init(), { type: 'menuToggled', menu: 'stroke' });
    expect(opened.activeMenu).toBe('stroke');
    const after = update(opened, { type: 'strokeWidthSet', value: 0.8 });
    expect(after.strokeWidth).toBe(0.8);
    expect(after.activeMenu).toBeNull();
  });
});

describe('update — geolocation & UI', () => {
  it('coordsReceived clears geoError', () => {
    const failed = update(init(), { type: 'geoFailed', message: 'no signal' });
    expect(failed.geoError).toBe('no signal');
    const ok = update(failed, { type: 'coordsReceived', coords: { lat: 34, lng: 131 } });
    expect(ok.userCoords).toEqual({ lat: 34, lng: 131 });
    expect(ok.geoError).toBeNull();
  });

  it('locationToggled and locationPinSet', () => {
    const init0 = init();
    const off = update(init0, { type: 'locationToggled' });
    expect(off.showLocation).toBe(!init0.showLocation);
    const pin = update(init0, { type: 'locationPinSet', visible: false });
    expect(pin.showLocationPin).toBe(false);
  });

  it('settingsToggled / settingsClosed', () => {
    const opened = update(init(), { type: 'settingsToggled' });
    expect(opened.showSettings).toBe(true);
    expect(update(opened, { type: 'settingsClosed' }).showSettings).toBe(false);
  });

  it('menuToggled toggles the same menu off, replaces another', () => {
    const open = update(init(), { type: 'menuToggled', menu: 'zoom' });
    expect(open.activeMenu).toBe('zoom');
    const same = update(open, { type: 'menuToggled', menu: 'zoom' });
    expect(same.activeMenu).toBeNull();
    const other = update(open, { type: 'menuToggled', menu: 'size' });
    expect(other.activeMenu).toBe('size');
    expect(update(other, { type: 'menuClosed' }).activeMenu).toBeNull();
  });
});

describe('update — capture flow', () => {
  it('captureCompleted seeds preview from current settings', () => {
    const before: State = {
      ...init(),
      maskMode: 'solid',
      strokeWidth: 0.8,
      showLocation: false,
    };
    const after = expectCaptured(captured(before));
    expect(after.preview).toEqual({
      maskMode: 'solid',
      strokeWidth: 0.8,
      showLocation: false,
    });
    expect(after.raw).toBe('data:raw');
    expect(after.composed).toBe('data:composed');
  });

  it('previewMaskSet / previewStrokeSet / previewLocationToggled update only the preview', () => {
    const c = captured(init());
    const masked = expectCaptured(
      update(c, { type: 'previewMaskSet', mode: 'solid', composed: 'data:m' }),
    );
    expect(masked.preview.maskMode).toBe('solid');
    expect(masked.composed).toBe('data:m');

    const stroked = expectCaptured(
      update({ ...c, capture: masked }, {
        type: 'previewStrokeSet', value: 0.8, composed: 'data:s',
      }),
    );
    expect(stroked.preview.strokeWidth).toBe(0.8);
    expect(stroked.composed).toBe('data:s');

    const beforeLoc = stroked.preview.showLocation;
    const toggled = expectCaptured(
      update({ ...c, capture: stroked }, {
        type: 'previewLocationToggled', composed: 'data:l',
      }),
    );
    expect(toggled.preview.showLocation).toBe(!beforeLoc);
    expect(toggled.composed).toBe('data:l');
  });

  it('preview-* msgs are no-ops when capture is idle', () => {
    const s = init();
    expect(update(s, { type: 'previewMaskSet', mode: 'solid', composed: 'x' })).toBe(s);
    expect(update(s, { type: 'previewStrokeSet', value: 0.8, composed: 'x' })).toBe(s);
    expect(update(s, { type: 'previewLocationToggled', composed: 'x' })).toBe(s);
  });

  it('captureCleared returns to idle', () => {
    const c = captured(init());
    const cleared = update(c, { type: 'captureCleared' });
    expect(cleared.capture).toEqual({ kind: 'idle' });
  });
});
