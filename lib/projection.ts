// Projection from lat/lng to a 0-200 SVG viewBox per municipality.
//
// Two corrections vs. the naive linear "stretch bbox to 0-200" mapping:
//
// 1. cos(lat) on the longitude axis. At Japan's latitudes, 1° of longitude
//    is ~91 km while 1° of latitude is ~111 km. Without compensation, an
//    e.g. circular city renders ~22% too wide. We multiply lng-spans by
//    cos(centerLat) so degrees collapse onto a common metric scale.
// 2. Aspect-ratio preserving fit. The longer (post-cosLat) side fills 200;
//    the shorter side is centered with padding so the rendered silhouette
//    matches the city's real proportions.
//
// Used by:
// - scripts/build-cities.mjs (projects polygon coordinates at build time)
// - components/jp-cam/presenter.ts (projects user GPS at runtime so the
//   pin lands at the geographically correct spot inside the silhouette)
//
// Both callers MUST use this exact formula or the pin will drift relative
// to the silhouette outline.

import type { CityBounds } from './cities-data';

export type ProjectionParams = {
  cosLat: number;
  scale: number;
  offsetX: number;
  offsetY: number;
};

export function projectionFor(bounds: CityBounds): ProjectionParams {
  const centerLat = (bounds.north + bounds.south) / 2;
  const cosLat = Math.cos((centerLat * Math.PI) / 180);
  const dxScaled = (bounds.east - bounds.west) * cosLat;
  const dyScaled = bounds.north - bounds.south;
  const span = Math.max(dxScaled, dyScaled) || 1;
  const scale = 200 / span;
  return {
    cosLat,
    scale,
    offsetX: (200 - dxScaled * scale) / 2,
    offsetY: (200 - dyScaled * scale) / 2,
  };
}

export function projectPoint(
  bounds: CityBounds,
  proj: ProjectionParams,
  lng: number,
  lat: number,
): { x: number; y: number } {
  return {
    x: (lng - bounds.west) * proj.cosLat * proj.scale + proj.offsetX,
    y: (bounds.north - lat) * proj.scale + proj.offsetY,
  };
}
