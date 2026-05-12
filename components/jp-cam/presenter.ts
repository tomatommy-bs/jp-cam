// Pure derivations from State to view-side data.
// No side effects, no DOM, no React. Each function maps State (or
// State-fragments) to values the view renders. Keeping them here
// makes the view file thin and the projections testable.

import type {
  CapturedSnapshot,
  MaskMode,
  State,
  ZoomCaps,
} from './state';
import type { City, CityBounds } from '@/lib/cities-data';
import { resolveSilhouette } from '@/lib/cities-data';
import { projectPoint, projectionFor } from '@/lib/projection';

export type Point = { x: number; y: number };

export function cities(state: State): City[] {
  return state.cities.kind === 'ready' ? state.cities.cities : [];
}

export function currentCity(state: State): City | null {
  if (state.cities.kind !== 'ready') return null;
  return state.cities.cities[state.cityIndex] ?? null;
}

// Silhouette path + bounds for the current city under the user-selected
// island-trim level. Returns null while cities are loading or the index is
// out of range. Both the on-screen render and the GPS-pin projection must
// agree on these values — see `dotPosRaw` below.
export function currentSilhouette(state: State): { path: string; bounds: CityBounds } | null {
  const city = currentCity(state);
  if (!city) return null;
  return resolveSilhouette(city, state.islandLevel);
}

export function citiesLoading(state: State): boolean {
  return state.cities.kind === 'loading';
}

export function citiesError(state: State): string | null {
  return state.cities.kind === 'error' ? state.cities.message : null;
}

// SVG transform applied to both the live silhouette and the captured PNG.
// The two callers MUST share this string so the saved image lines up
// exactly with what the user previewed on screen.
export function silhouetteTransform(state: State): string {
  const rotate = state.silhouetteRotated ? 'rotate(90)' : '';
  return `translate(100,100) ${rotate} scale(${state.scale}) translate(-100,-100)`;
}

// Project user GPS into the silhouette's 0-200 SVG space using the same
// cosLat-corrected, aspect-preserving fit that lib/projection.ts feeds
// scripts/build-cities.mjs. Returns null when coords are missing or fall
// outside the current city's bbox.
export function dotPosRaw(state: State): Point | null {
  if (!state.userCoords) return null;
  const sil = currentSilhouette(state);
  if (!sil) return null;
  const b = sil.bounds;
  const { lat, lng } = state.userCoords;
  if (lat < b.south || lat > b.north || lng < b.west || lng > b.east) return null;
  return projectPoint(b, projectionFor(b), lng, lat);
}

// Live-preview pin: respects the showLocation toggle. The watermark drawn
// onto the saved PNG uses dotPosRaw directly so the toggle and the pin can
// be controlled independently.
export function dotPos(state: State): Point | null {
  return state.showLocation ? dotPosRaw(state) : null;
}

export function errorMessage(state: State): string | null {
  return state.camera.kind === 'error' ? state.camera.message : null;
}

export function isLoading(state: State): boolean {
  return state.camera.kind === 'loading';
}

export function zoomCaps(state: State): ZoomCaps | null {
  return state.camera.kind === 'ready' ? state.camera.zoomCaps : null;
}

export function isDigitalZoom(state: State): boolean {
  return zoomCaps(state) === null;
}

export function zoomMin(state: State): number {
  const caps = zoomCaps(state);
  return caps ? caps.min : 1;
}

export function zoomMax(state: State): number {
  const caps = zoomCaps(state);
  return caps ? caps.max : 5;
}

export function capturedImage(state: State): string | null {
  return state.capture.kind === 'captured' ? state.capture.composed : null;
}

export function capturedSnapshot(state: State): CapturedSnapshot | null {
  return state.capture.kind === 'captured' ? state.capture.snapshot : null;
}

export function previewMaskMode(state: State): MaskMode {
  return state.capture.kind === 'captured' ? state.capture.preview.maskMode : 'translucent';
}

export function previewStrokeWidth(state: State): number {
  return state.capture.kind === 'captured' ? state.capture.preview.strokeWidth : 1.65;
}

export function previewShowLocation(state: State): boolean {
  return state.capture.kind === 'captured' ? state.capture.preview.showLocation : true;
}
