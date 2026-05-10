# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

This project uses **pnpm** (see `packageManager` in package.json).

- `pnpm dev` — start Next.js dev server
- `pnpm build` — production build
- `pnpm start` — run production server
- `pnpm lint` — `eslint .`
- `pnpm test` — run Vitest once (CI mode); `pnpm test:watch` for watch mode

Tests cover the pure modules in `components/yamaguchi-camera/` (`update.ts`, `presenter.ts`). The view component (`yamaguchi-camera.tsx`) is not unit-tested — all I/O is funneled through `dispatch`, so reducer/derivation tests are sufficient.

`next.config.mjs` sets `typescript.ignoreBuildErrors: true`, so `pnpm build` will not catch type errors. To type-check, run `pnpm exec tsc --noEmit` directly.

## Architecture

This is a Next.js 16 (App Router) + React 19 + Tailwind v4 single-page app. **Almost the entire application lives in one file:** `components/yamaguchi-camera.tsx` (~1100 lines). `app/page.tsx` is a thin shell that just renders `<YamaguchiCamera />`.

### What the app does
A mobile-first webcam app for Yamaguchi Prefecture: it overlays an SVG silhouette of one of 13 cities onto the live camera feed, lets the user adjust framing, and exports a composed PNG. The silhouette is rendered as a transparent "window" cut out of a black mask so the user can frame the camera shot to match the city's geographic outline.

### Module layout (Elm-style split)

- **`lib/city-database.ts`** — `CITIES` (13 SVG silhouettes on a `0–200` viewBox) and `CITY_BOUNDS` (lat/lng bbox per city, used to project GPS into that same SVG space). Adding/editing a city means editing this file.
- **`components/yamaguchi-camera/state.ts`** — types (`State`, `Msg` payloads, `CapturedSnapshot`, …), `init()`, and domain bounds (`SCALE_MIN/MAX`).
- **`components/yamaguchi-camera/message.ts`** — `Msg` discriminated union.
- **`components/yamaguchi-camera/update.ts`** — pure reducer `(State, Msg) → State`.
- **`components/yamaguchi-camera/presenter.ts`** — pure derivations from `State` to view-side values (`currentCity`, `silhouetteTransform`, `dotPos`, `zoomMin`, …).
- **`components/yamaguchi-camera/compose.ts`** — pure helpers used by the view's effects (`computeCaptureCrop`, `buildSilhouetteSvg`, `captureFilename`, `cameraErrorMessage`, `deriveZoomCaps`).
- **`components/yamaguchi-camera/yamaguchi-camera.tsx`** — the React view; owns refs, dispatches `Msg`s, and runs the I/O (camera, geolocation, canvas, localStorage). Should stay thin.

### Key concepts

- **`silhouetteTransform`** — a single SVG transform string (`translate(100,100) rotate? scale translate(-100,-100)`) shared between the live preview and the captured PNG. Both the on-screen `<svg>` and the PNG composer must apply the *same* transform — keep them in sync.
- **Two-stage capture pipeline:**
  1. `handleCapture` draws the raw `<video>` frame to a canvas (`capturedRaw`), applying the `object-cover` crop math so the saved image matches what the user actually sees on screen, plus mirror flip for front camera and digital-zoom crop when `zoomCaps` is null.
  2. `composeFinal` re-runs whenever the user toggles mask mode / stroke / location pin in the post-capture editor. It rasterizes the silhouette SVG via `Blob` → `URL.createObjectURL` → `<img>` and composites it onto `capturedRaw`, then draws the watermark (city name, reading, mini-logo with optional location pin). Re-composing avoids re-capturing the camera frame.
- **Persistence:** user preferences (`PersistedSettings`) are saved to `localStorage` under `yamaguchi-camera-settings`. The save effect is gated by `settingsLoadedRef` so the initial render doesn't overwrite saved values with defaults.
- **Camera/zoom:** uses `navigator.mediaDevices.getUserMedia` with `facingMode` toggle. Hardware zoom is preferred via `MediaTrackCapabilities.zoom` + `applyConstraints({ advanced: [{ zoom }] })`; if unavailable (`zoomCaps === null`), it falls back to CSS `transform: scale()` digital zoom and crops the source rect during capture to match.
- **Geolocation:** `navigator.geolocation.getCurrentPosition` is called once on mount. The pin is drawn only when the user is inside the current city's bbox; the location toggle independently controls the live preview (`dotPos`) and the saved image (`previewShowLocation`).

### shadcn/ui
`components/ui/` contains a large catalog of generated shadcn components (new-york style, configured in `components.json`). The main camera component does **not** use any of them — it ships its own raw Tailwind UI. Do not assume shadcn is the convention here; match the surrounding style of `yamaguchi-camera.tsx` when extending it.

### Tailwind v4
Styles live in `app/globals.css` using the v4 `@import 'tailwindcss'` and `@custom-variant` syntax. There is no `tailwind.config.js`. Theme tokens are defined as CSS variables (`oklch(...)`) in `:root` / `.dark`.

### Path alias
`@/*` resolves from the repo root (see `tsconfig.json`).
