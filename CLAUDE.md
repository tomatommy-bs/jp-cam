# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

This project uses **pnpm** (see `packageManager` in package.json). There is no test suite.

- `pnpm dev` — start Next.js dev server
- `pnpm build` — production build
- `pnpm start` — run production server
- `pnpm lint` — `eslint .`

`next.config.mjs` sets `typescript.ignoreBuildErrors: true`, so `pnpm build` will not catch type errors. To type-check, run `pnpm exec tsc --noEmit` directly.

## Architecture

This is a Next.js 16 (App Router) + React 19 + Tailwind v4 single-page app. **Almost the entire application lives in one file:** `components/yamaguchi-camera.tsx` (~1100 lines). `app/page.tsx` is a thin shell that just renders `<YamaguchiCamera />`.

### What the app does
A mobile-first webcam app for Yamaguchi Prefecture: it overlays an SVG silhouette of one of 13 cities onto the live camera feed, lets the user adjust framing, and exports a composed PNG. The silhouette is rendered as a transparent "window" cut out of a black mask so the user can frame the camera shot to match the city's geographic outline.

### Key modules inside `yamaguchi-camera.tsx`

- **`CITIES`** — the 13 city silhouettes as raw SVG path strings on a `0–200` viewBox. Adding/editing a city means editing this array.
- **`CITY_BOUNDS`** — lat/lng bounding boxes per city, used to project the user's GPS coordinates into the same `0–200` SVG space (`dotPosRaw`). If the user is outside a city's bbox, no pin is shown.
- **`silhouetteTransform`** — a single SVG transform string (`translate(100,100) rotate? scale translate(-100,-100)`) shared between the live preview and the captured PNG. Both the on-screen `<svg>` and the PNG composer must apply the *same* transform — keep them in sync.
- **Two-stage capture pipeline:**
  1. `handleCapture` draws the raw `<video>` frame to a canvas (`capturedRaw`), applying the `object-cover` crop math so the saved image matches what the user actually sees on screen, plus mirror flip for front camera and digital-zoom crop when `zoomCaps` is null.
  2. `composeFinal` re-runs whenever the user toggles mask mode / stroke / location pin in the post-capture editor. It rasterizes the silhouette SVG via `Blob` → `URL.createObjectURL` → `<img>` and composites it onto `capturedRaw`, then draws the watermark (city name, reading, mini-logo with optional location pin). Re-composing avoids re-capturing the camera frame.
- **Persistence:** user preferences (`PersistedSettings`) are saved to `localStorage` under `yamaguchi-camera-settings`. The save effect is gated by `settingsLoadedRef` so the initial render doesn't overwrite saved values with defaults.
- **Camera/zoom:** uses `navigator.mediaDevices.getUserMedia` with `facingMode` toggle. Hardware zoom is preferred via `MediaTrackCapabilities.zoom` + `applyConstraints({ advanced: [{ zoom }] })`; if unavailable (`zoomCaps === null`), it falls back to CSS `transform: scale()` digital zoom and crops the source rect during capture to match.
- **Geolocation:** `navigator.geolocation.watchPosition` runs continuously. The pin is drawn only when the user is inside the current city's bbox; the location toggle independently controls the live preview (`dotPos`) and the saved image (`previewShowLocation`).

### shadcn/ui
`components/ui/` contains a large catalog of generated shadcn components (new-york style, configured in `components.json`). The main camera component does **not** use any of them — it ships its own raw Tailwind UI. Do not assume shadcn is the convention here; match the surrounding style of `yamaguchi-camera.tsx` when extending it.

### Tailwind v4
Styles live in `app/globals.css` using the v4 `@import 'tailwindcss'` and `@custom-variant` syntax. There is no `tailwind.config.js`. Theme tokens are defined as CSS variables (`oklch(...)`) in `:root` / `.dark`.

### Path alias
`@/*` resolves from the repo root (see `tsconfig.json`).
