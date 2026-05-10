# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

This project uses **pnpm** (see `packageManager` in package.json).

- `pnpm dev` — start Next.js dev server
- `pnpm build` — production build
- `pnpm start` — run production server
- `pnpm lint` — `eslint .`
- `pnpm test` — run Vitest once (CI mode); `pnpm test:watch` for watch mode
- `pnpm build:cities` — regenerate `public/data/{prefectures,cities/*}.json` from niiyz/JapanCityGeoJson

Tests cover the pure modules in `components/jp-cam/` (`update.ts`, `presenter.ts`, `compose.ts`). The view component (`view.tsx`) is not unit-tested — all I/O is funneled through `dispatch`, so reducer/derivation tests are sufficient.

`next.config.mjs` sets `typescript.ignoreBuildErrors: true`, so `pnpm build` will not catch type errors. To type-check, run `pnpm exec tsc --noEmit` directly.

## Architecture

This is a Next.js 16 (App Router) + React 19 + Tailwind v4 app covering all 1,747 Japanese municipalities.

### What the app does
A mobile-first webcam app for the entire country: from the top page the user picks a prefecture, then the camera page overlays the SVG silhouette of one of that prefecture's cities/wards/towns/villages onto the live feed. The silhouette is rendered as a transparent "window" cut out of a black mask. Captured photos are saved as JPEG with EXIF (capture time + GPS).

### Routing

- `app/page.tsx` (server component) — prefecture picker grid. Reads `public/data/prefectures.json` via Node `fs`.
- `app/[code]/page.tsx` (server component) — validates the prefecture code, looks up its display name, then renders `CameraClient`.
- `app/[code]/camera-client.tsx` (`'use client'`) — wires `useRouter().push('/')` as the `onBack` callback into `<JpCamera />`.

### Module layout (Elm-style split)

- **`lib/cities-data.ts`** — async loaders + types (`Prefecture`, `City`, `CityBounds`).
- **`components/jp-cam/state.ts`** — types (`State`, `Msg` payloads, `CapturedSnapshot`, `CitiesStatus`, …), `init(prefCode)`, and domain bounds (`SCALE_MIN/MAX`).
- **`components/jp-cam/message.ts`** — `Msg` discriminated union.
- **`components/jp-cam/update.ts`** — pure reducer `(State, Msg) → State`.
- **`components/jp-cam/presenter.ts`** — pure derivations (`currentCity` is nullable while cities are loading).
- **`components/jp-cam/compose.ts`** — pure helpers used by the view's effects (`computeCaptureCrop`, `buildSilhouetteSvg`, `captureFilename`, `cameraErrorMessage`, `deriveZoomCaps`, `formatExifDateTime`, `buildExifBinary`, `attachExif`).
- **`components/jp-cam/view.tsx`** — the React view; owns refs, dispatches `Msg`s, and runs the I/O (camera, geolocation, canvas, localStorage). Accepts `prefCode`, `prefName`, `onBack` props.

### Data pipeline

- **Source**: [niiyz/JapanCityGeoJson](https://github.com/niiyz/JapanCityGeoJson) (N03 administrative boundary data, all 1,902 entries).
- **Build script**: `scripts/build-cities.mjs` fetches each prefecture's JSON, projects each polygon into a 0-200 SVG viewBox per municipality, runs Douglas-Peucker simplification (tolerance 0.5), and writes per-prefecture JSON to `public/data/cities/{code}.json`. Designated-city wards (e.g., 横浜市西区) are merged into their parent city; Tokyo's 23 special wards are kept as standalone entries.
- **Output**: `public/data/prefectures.json` (~2.5 KB index) + `public/data/cities/01..47.json` (~12 MB total). All committed.
- **Runtime**: `loadCities(prefCode)` fetches the per-prefecture JSON when the user opens that prefecture's camera page.

### Key concepts

- **`silhouetteTransform`** — a single SVG transform string (`translate(100,100) rotate? scale translate(-100,-100)`) shared between the live preview and the captured JPEG. Both the on-screen `<svg>` and the JPEG composer must apply the *same* transform — keep them in sync.
- **Two-stage capture pipeline:**
  1. `handleCapture` draws the raw `<video>` frame to a canvas (`capturedRaw`), applying the `object-cover` crop math so the saved image matches what the user actually sees on screen, plus mirror flip for front camera and digital-zoom crop when `zoomCaps` is null.
  2. `composeFinal` re-runs whenever the user toggles mask mode / stroke / location pin in the post-capture editor. It rasterizes the silhouette SVG via `Blob` → `URL.createObjectURL` → `<img>` and composites it onto `capturedRaw`, then draws the watermark (city name, reading, mini-logo with optional location pin). Final output is JPEG (q=0.92) with EXIF injected via `piexifjs` (`buildExifBinary` + `attachExif`).
- **Persistence:** user preferences (`PersistedSettings`) are saved to `localStorage` under `jp-cam-settings`. The save effect is gated by `state.settingsLoaded` so the initial render doesn't overwrite saved values with defaults.
- **Camera/zoom:** uses `navigator.mediaDevices.getUserMedia` with `facingMode` toggle. Hardware zoom is preferred via `MediaTrackCapabilities.zoom` + `applyConstraints({ advanced: [{ zoom }] })`; if unavailable (`zoomCaps === null`), it falls back to CSS `transform: scale()` digital zoom and crops the source rect during capture to match.
- **Geolocation:** `navigator.geolocation.getCurrentPosition` is called once on mount. The pin is drawn only when the user is inside the current city's bbox; the location toggle independently controls the live preview (`dotPos`) and the saved image (`previewShowLocation`). GPS is also embedded in EXIF when `showLocation` was true at capture time.
- **Cities lifecycle:** `state.cities` is a discriminated union (`loading` / `ready` / `error`). `currentCity` from the presenter is nullable until cities resolve; the view shows "都市データ読込中…" in the picker until then.

### shadcn/ui
`components/ui/` contains a large catalog of generated shadcn components (new-york style, configured in `components.json`). The main camera component does **not** use any of them — it ships its own raw Tailwind UI. Do not assume shadcn is the convention here; match the surrounding style of `view.tsx` when extending it.

### Tailwind v4
Styles live in `app/globals.css` using the v4 `@import 'tailwindcss'` and `@custom-variant` syntax. There is no `tailwind.config.js`. Theme tokens are defined as CSS variables (`oklch(...)`) in `:root` / `.dark`.

### Path alias
`@/*` resolves from the repo root (see `tsconfig.json`).
