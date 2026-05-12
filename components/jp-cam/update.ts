// Pure (state, msg) -> state. No I/O, no DOM, no React.
// All side effects (camera, geolocation, localStorage, canvas
// composition) live in the view component, which dispatches Msgs.

import type { State } from './state';
import { SCALE_MAX, SCALE_MIN } from './state';
import type { Msg } from './message';

function clampZoom(state: State, zoom: number): number {
  const caps = state.camera.kind === 'ready' ? state.camera.zoomCaps : null;
  const min = caps ? caps.min : 1;
  const max = caps ? caps.max : 5;
  return Math.min(max, Math.max(min, zoom));
}

function citiesLength(state: State): number {
  return state.cities.kind === 'ready' ? state.cities.cities.length : 0;
}

export function update(state: State, msg: Msg): State {
  switch (msg.type) {
    case 'settingsHydrated': {
      const p = msg.patch;
      const len = citiesLength(state);
      return {
        ...state,
        cityIndex:
          typeof p.cityIndex === 'number' && p.cityIndex >= 0 && (len === 0 || p.cityIndex < len)
            ? p.cityIndex
            : state.cityIndex,
        color: typeof p.color === 'string' ? p.color : state.color,
        opacity: typeof p.opacity === 'number' ? p.opacity : state.opacity,
        scale: typeof p.scale === 'number' ? p.scale : state.scale,
        strokeWidth: typeof p.strokeWidth === 'number' ? p.strokeWidth : state.strokeWidth,
        facingMode:
          p.facingMode === 'environment' || p.facingMode === 'user' ? p.facingMode : state.facingMode,
        maskMode: p.maskMode === 'translucent' || p.maskMode === 'solid' ? p.maskMode : state.maskMode,
        showLocation: typeof p.showLocation === 'boolean' ? p.showLocation : state.showLocation,
        showLocationPin:
          typeof p.showLocationPin === 'boolean' ? p.showLocationPin : state.showLocationPin,
        silhouetteRotated:
          typeof p.silhouetteRotated === 'boolean' ? p.silhouetteRotated : state.silhouetteRotated,
        islandLevel:
          p.islandLevel === 0 || p.islandLevel === 1 || p.islandLevel === 2
            ? p.islandLevel
            : state.islandLevel,
        settingsLoaded: true,
      };
    }
    case 'prefectureSelected':
      if (msg.prefCode === state.prefCode && state.cities.kind === 'ready') return state;
      return {
        ...state,
        prefCode: msg.prefCode,
        cities: { kind: 'loading' },
        cityIndex: 0,
      };
    case 'citiesLoaded':
      // Race-condition guard: ignore loads for a stale prefCode.
      if (msg.prefCode !== state.prefCode) return state;
      return {
        ...state,
        cities: { kind: 'ready', cities: msg.cities },
        // Keep cityIndex if it still points at a valid entry (e.g., user
        // already navigated). Otherwise clamp to 0.
        cityIndex: state.cityIndex < msg.cities.length ? state.cityIndex : 0,
      };
    case 'citiesFailed':
      if (msg.prefCode !== state.prefCode) return state;
      return { ...state, cities: { kind: 'error', message: msg.message } };
    case 'cameraReady':
      return {
        ...state,
        camera: { kind: 'ready', zoomCaps: msg.zoomCaps },
        zoom: msg.zoomCaps ? msg.zoomCaps.min : 1,
      };
    case 'cameraFailed':
      return { ...state, camera: { kind: 'error', message: msg.message } };
    case 'cameraSwitchToggled':
      return {
        ...state,
        facingMode: state.facingMode === 'environment' ? 'user' : 'environment',
        camera: { kind: 'loading' },
        zoom: 1,
      };
    case 'zoomNudged':
      return { ...state, zoom: +clampZoom(state, state.zoom + msg.delta).toFixed(2) };
    case 'citySelected': {
      const len = citiesLength(state);
      if (len === 0 || msg.index < 0 || msg.index >= len) return state;
      return { ...state, cityIndex: msg.index, cityPickerOpen: false };
    }
    case 'cityStepped': {
      const len = citiesLength(state);
      if (len === 0) return state;
      return { ...state, cityIndex: (state.cityIndex + msg.delta + len) % len };
    }
    case 'colorSet':
      return { ...state, color: msg.color };
    case 'opacitySet':
      return { ...state, opacity: msg.opacity };
    case 'scaleNudged':
      return {
        ...state,
        scale: +Math.min(SCALE_MAX, Math.max(SCALE_MIN, state.scale + msg.delta)).toFixed(2),
      };
    case 'strokeWidthSet':
      return { ...state, strokeWidth: msg.value, activeMenu: null };
    case 'maskModeSet':
      return { ...state, maskMode: msg.mode };
    case 'silhouetteRotateToggled':
      return { ...state, silhouetteRotated: !state.silhouetteRotated };
    case 'islandLevelSet':
      return { ...state, islandLevel: msg.level };
    case 'islandHelpToggled':
      return { ...state, islandHelpOpen: !state.islandHelpOpen };
    case 'coordsReceived':
      return { ...state, userCoords: msg.coords, geoError: null };
    case 'geoFailed':
      return { ...state, geoError: msg.message };
    case 'locationToggled':
      return { ...state, showLocation: !state.showLocation };
    case 'locationPinSet':
      return { ...state, showLocationPin: msg.visible };
    case 'settingsToggled':
      return { ...state, showSettings: !state.showSettings };
    case 'settingsClosed':
      return { ...state, showSettings: false };
    case 'menuToggled':
      return { ...state, activeMenu: state.activeMenu === msg.menu ? null : msg.menu };
    case 'menuClosed':
      return { ...state, activeMenu: null };
    case 'cityPickerOpened':
      return { ...state, cityPickerOpen: true, activeMenu: null, showSettings: false };
    case 'cityPickerClosed':
      return { ...state, cityPickerOpen: false };
    case 'captureCompleted':
      return {
        ...state,
        capture: {
          kind: 'captured',
          raw: msg.raw,
          composed: msg.composed,
          snapshot: msg.snapshot,
          preview: {
            maskMode: state.maskMode,
            strokeWidth: state.strokeWidth,
            showLocation: state.showLocation,
          },
        },
      };
    case 'previewMaskSet':
      if (state.capture.kind !== 'captured') return state;
      return {
        ...state,
        capture: {
          ...state.capture,
          composed: msg.composed,
          preview: { ...state.capture.preview, maskMode: msg.mode },
        },
      };
    case 'previewStrokeSet':
      if (state.capture.kind !== 'captured') return state;
      return {
        ...state,
        capture: {
          ...state.capture,
          composed: msg.composed,
          preview: { ...state.capture.preview, strokeWidth: msg.value },
        },
      };
    case 'previewLocationToggled':
      if (state.capture.kind !== 'captured') return state;
      return {
        ...state,
        capture: {
          ...state.capture,
          composed: msg.composed,
          preview: {
            ...state.capture.preview,
            showLocation: !state.capture.preview.showLocation,
          },
        },
      };
    case 'captureCleared':
      return { ...state, capture: { kind: 'idle' } };
  }
}
