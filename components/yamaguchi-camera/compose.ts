// Pure helpers used by the view layer (yamaguchi-camera.tsx).
// No DOM, no React, no I/O — split out so they can be unit tested
// without a browser environment.

import type { CapturedSnapshot, MaskMode, ZoomCaps } from './state';

export type CaptureCropInput = {
  videoWidth: number;
  videoHeight: number;
  containerWidth: number;
  containerHeight: number;
  zoom: number;
  isDigitalZoom: boolean;
};

export type CaptureCrop = {
  destWidth: number;
  destHeight: number;
  srcX: number;
  srcY: number;
  srcWidth: number;
  srcHeight: number;
};

// Match the preview's `object-cover` crop so the captured image and
// the SVG silhouette align with what the user sees on screen. Without
// this, a portrait container + landscape camera (or vice-versa) makes
// the silhouette appear at a different size in the photo.
export function computeCaptureCrop(input: CaptureCropInput): CaptureCrop {
  const { videoWidth: vw, videoHeight: vh, containerWidth: cw, containerHeight: ch, zoom, isDigitalZoom } = input;
  const containerAspect = cw / ch;
  const videoAspect = vw / vh;

  let baseCropW: number;
  let baseCropH: number;
  if (videoAspect > containerAspect) {
    baseCropH = vh;
    baseCropW = vh * containerAspect;
  } else {
    baseCropW = vw;
    baseCropH = vw / containerAspect;
  }

  const useCrop = isDigitalZoom && zoom > 1;
  const srcWidth = useCrop ? baseCropW / zoom : baseCropW;
  const srcHeight = useCrop ? baseCropH / zoom : baseCropH;

  return {
    destWidth: Math.round(baseCropW),
    destHeight: Math.round(baseCropH),
    srcX: (vw - srcWidth) / 2,
    srcY: (vh - srcHeight) / 2,
    srcWidth,
    srcHeight,
  };
}

export type SilhouetteSvgInput = {
  snapshot: CapturedSnapshot;
  maskMode: MaskMode;
  strokeWidth: number;
  locationVisible: boolean;
};

export function buildSilhouetteSvg({ snapshot, maskMode, strokeWidth, locationVisible }: SilhouetteSvgInput): string {
  const fillOpacity = maskMode === 'solid' ? 1 : 0.6;
  const pin = locationVisible && snapshot.dotPosRaw
    ? `<circle cx="${snapshot.dotPosRaw.x}" cy="${snapshot.dotPosRaw.y}" r="3.5" fill="#ef4444" stroke="white" stroke-width="1"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${snapshot.width}" height="${snapshot.height}" preserveAspectRatio="xMidYMid slice">
      <defs>
        <mask id="silhouette-mask">
          <rect x="-500" y="-500" width="1200" height="1200" fill="white" />
          <g transform="${snapshot.silhouetteTransform}">
            <path d="${snapshot.cityPath}" fill="black" />
          </g>
        </mask>
      </defs>
      <rect x="-500" y="-500" width="1200" height="1200" fill="black" fill-opacity="${fillOpacity}" mask="url(#silhouette-mask)" />
      <g transform="${snapshot.silhouetteTransform}">
        <path d="${snapshot.cityPath}" fill="none" stroke="${snapshot.color}" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-linecap="round" opacity="${snapshot.opacity}"/>
        ${pin}
      </g>
    </svg>`;
}

export function captureFilename(cityId: string, timestamp: number = Date.now()): string {
  return `yamaguchi_${cityId}_${timestamp}.png`;
}

export function cameraErrorMessage(error: unknown): string {
  const e = error as { name?: unknown; message?: unknown } | null | undefined;
  if (e?.name === 'NotAllowedError') return 'カメラへのアクセスが拒否されました';
  if (e?.name === 'NotFoundError') return 'カメラが見つかりませんでした';
  if (typeof e?.message === 'string' && e.message.length > 0) return e.message;
  return 'カメラを起動できませんでした';
}

export type RawZoomCaps = { min?: number; max?: number; step?: number } | null | undefined;

export function deriveZoomCaps(raw: RawZoomCaps): ZoomCaps | null {
  if (!raw || typeof raw.max !== 'number') return null;
  const min = raw.min ?? 1;
  if (raw.max <= min) return null;
  const step = typeof raw.step === 'number' && raw.step > 0 ? raw.step : 0.1;
  return { min, max: raw.max, step };
}
