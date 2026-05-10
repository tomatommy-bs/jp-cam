// State types and domain data for the camera module.
//
// Pure: no React, no DOM, no I/O. The view component owns all
// side effects and dispatches Msgs (./message) into update
// (./update) to transition between states defined here.

import type { City } from '@/lib/cities-data';

export type Coords = { lat: number; lng: number };
export type ZoomCaps = { min: number; max: number; step: number };
export type MaskMode = 'translucent' | 'solid';
export type Menu = 'stroke' | 'size' | 'zoom';
export type FacingMode = 'environment' | 'user';

export type CapturedSnapshot = {
  width: number;
  height: number;
  prefName: string;
  cityId: string;
  cityName: string;
  cityReading: string;
  cityPath: string;
  silhouetteTransform: string;
  silhouetteRotated: boolean;
  color: string;
  opacity: number;
  strokeWidth: number;
  dotPos: { x: number; y: number } | null;
  dotPosRaw: { x: number; y: number } | null;
  showLocationPin: boolean;
  userCoords: Coords | null;
  capturedAt: number;
};

export type CameraStatus =
  | { kind: 'loading' }
  | { kind: 'ready'; zoomCaps: ZoomCaps | null }
  | { kind: 'error'; message: string };

export type CitiesStatus =
  | { kind: 'loading' }
  | { kind: 'ready'; cities: City[] }
  | { kind: 'error'; message: string };

export type Capture =
  | { kind: 'idle' }
  | {
      kind: 'captured';
      raw: string;            // PNG of the camera frame only
      composed: string;       // PNG with silhouette + watermark applied
      snapshot: CapturedSnapshot;
      preview: { maskMode: MaskMode; strokeWidth: number; showLocation: boolean };
    };

export type State = {
  // Camera
  camera: CameraStatus;
  facingMode: FacingMode;
  zoom: number;
  // Prefecture / city catalog
  prefCode: string;
  cities: CitiesStatus;
  // Silhouette settings
  cityIndex: number;
  color: string;
  opacity: number;
  scale: number;
  strokeWidth: number;
  maskMode: MaskMode;
  silhouetteRotated: boolean;
  // Geolocation
  userCoords: Coords | null;
  geoError: string | null;
  showLocation: boolean;
  showLocationPin: boolean;
  // UI
  showSettings: boolean;
  activeMenu: Menu | null;
  // Capture / preview-edit flow
  capture: Capture;
  // Persistence
  settingsLoaded: boolean;
};

export type PersistedSettings = {
  cityIndex: number;
  color: string;
  opacity: number;
  scale: number;
  strokeWidth: number;
  facingMode: string;
  maskMode: 'translucent' | 'solid';
  showLocation: boolean;
  showLocationPin: boolean;
  silhouetteRotated: boolean;
};

// Domain bounds used by update for clamping silhouette scale.
export const SCALE_MIN = 0.3;
export const SCALE_MAX = 2;

export function init(prefCode: string = '35'): State {
  return {
    camera: { kind: 'loading' },
    facingMode: 'environment',
    zoom: 1,
    prefCode,
    cities: { kind: 'loading' },
    cityIndex: 0,
    color: '#ffffff',
    opacity: 0.9,
    scale: 1,
    strokeWidth: 1.65,
    maskMode: 'translucent',
    silhouetteRotated: false,
    userCoords: null,
    geoError: null,
    showLocation: true,
    showLocationPin: true,
    showSettings: false,
    activeMenu: null,
    capture: { kind: 'idle' },
    settingsLoaded: false,
  };
}
