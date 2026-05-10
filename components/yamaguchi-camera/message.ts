// Discriminated-union of every transition the view can request.
// Pure data — no behavior here. See ./update for transitions.

import type { City } from '@/lib/cities-data';

import type { CapturedSnapshot, Coords, MaskMode, Menu, PersistedSettings, ZoomCaps } from './state';

export type Msg =
  // Persistence
  | { type: 'settingsHydrated'; patch: Partial<PersistedSettings> }
  // Prefecture / cities catalog
  | { type: 'prefectureSelected'; prefCode: string }
  | { type: 'citiesLoaded'; prefCode: string; cities: City[] }
  | { type: 'citiesFailed'; prefCode: string; message: string }
  // Camera
  | { type: 'cameraReady'; zoomCaps: ZoomCaps | null }
  | { type: 'cameraFailed'; message: string }
  | { type: 'cameraSwitchToggled' }
  | { type: 'zoomNudged'; delta: number }
  // Silhouette
  | { type: 'citySelected'; index: number }
  | { type: 'cityStepped'; delta: number }
  | { type: 'colorSet'; color: string }
  | { type: 'opacitySet'; opacity: number }
  | { type: 'scaleNudged'; delta: number }
  | { type: 'strokeWidthSet'; value: number }
  | { type: 'maskModeSet'; mode: MaskMode }
  | { type: 'silhouetteRotateToggled' }
  // Geolocation
  | { type: 'coordsReceived'; coords: Coords }
  | { type: 'geoFailed'; message: string }
  | { type: 'locationToggled' }
  | { type: 'locationPinSet'; visible: boolean }
  // UI
  | { type: 'settingsToggled' }
  | { type: 'settingsClosed' }
  | { type: 'menuToggled'; menu: Menu }
  | { type: 'menuClosed' }
  // Capture flow
  | { type: 'captureCompleted'; raw: string; composed: string; snapshot: CapturedSnapshot }
  | { type: 'previewMaskSet'; mode: MaskMode; composed: string }
  | { type: 'previewStrokeSet'; value: number; composed: string }
  | { type: 'previewLocationToggled'; composed: string }
  | { type: 'captureCleared' };
