// Pure helpers used by the view layer (view.tsx).
// No DOM, no React, no I/O — split out so they can be unit tested
// without a browser environment.

import piexif from 'piexifjs';

import type { CapturedSnapshot, Coords, MaskMode, ZoomCaps } from './state';

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
  return `yamaguchi_${cityId}_${timestamp}.jpg`;
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  if (!dataUrl.startsWith('data:') || comma < 0) {
    throw new Error('Invalid data URL');
  }
  const meta = dataUrl.slice(5, comma);
  const isBase64 = meta.endsWith(';base64');
  const mime = (isBase64 ? meta.slice(0, -7) : meta).split(';')[0] || 'application/octet-stream';
  const payload = dataUrl.slice(comma + 1);
  if (!isBase64) {
    return new Blob([decodeURIComponent(payload)], { type: mime });
  }
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// EXIF DateTime format is `YYYY:MM:DD HH:MM:SS` in local time. Note that
// the date separator is `:` (not `-`) — this is the EXIF spec, not a typo.
export function formatExifDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}:${pad(d.getMonth() + 1)}:${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export type ExifInput = {
  userCoords: Coords | null;
  capturedAt: number;
};

export function buildExifBinary({ userCoords, capturedAt }: ExifInput): string {
  const dt = formatExifDateTime(new Date(capturedAt));
  const exifObj: piexif.ExifDict = {
    '0th': {
      [piexif.ImageIFD.DateTime]: dt,
      [piexif.ImageIFD.Software]: 'JP-CAM',
    },
    Exif: {
      [piexif.ExifIFD.DateTimeOriginal]: dt,
      [piexif.ExifIFD.DateTimeDigitized]: dt,
    },
    GPS: {},
  };

  if (userCoords) {
    const { lat, lng } = userCoords;
    exifObj.GPS![piexif.GPSIFD.GPSLatitude] = piexif.GPSHelper.degToDmsRational(Math.abs(lat));
    exifObj.GPS![piexif.GPSIFD.GPSLatitudeRef] = lat >= 0 ? 'N' : 'S';
    exifObj.GPS![piexif.GPSIFD.GPSLongitude] = piexif.GPSHelper.degToDmsRational(Math.abs(lng));
    exifObj.GPS![piexif.GPSIFD.GPSLongitudeRef] = lng >= 0 ? 'E' : 'W';
  }

  return piexif.dump(exifObj);
}

export function attachExif(jpegDataUrl: string, exifBinary: string): string {
  return piexif.insert(exifBinary, jpegDataUrl);
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
