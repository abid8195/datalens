# DataLens

DataLens is a privacy-first, local-first data health checker for CSV and JSON files. Import a file to inspect its shape, inferred column types, basic statistics, likely quality issues, distributions, filters, and a locally generated CSV export.

## Key features

- CSV parsing with quoted fields, embedded commas, empty values, and import warnings for uneven rows
- JSON parsing for arrays of objects and common wrapper-object structures
- Local column profiling: inferred types, missingness, unique values, number statistics, date ranges, boolean counts, and common values
- A transparent Data Health score that reports duplicate rows and potential quality issues
- Dataset-wide search, type-aware filters, stable sorting, pagination, column visibility, and filtered CSV export
- Lightweight responsive charts for categorical, numeric, and date columns
- System-preference dark mode, keyboard focus states, semantic controls, and mobile-safe table scrolling
- Offline-capable PWA after the first successful load

## Privacy model

Dataset parsing, profiling, filtering, sorting, and export are performed entirely in the browser. DataLens has no backend, accounts, analytics, telemetry, cookies, tracking pixels, advertising SDKs, or dataset uploads.

The only local persistence is `datalens.table-preferences.v1` in `localStorage`. It stores the chosen table page size and visible-column preference; it never stores the imported dataset. The application requests Google-hosted Manrope and Fraunces font files when online, as permitted by the FreeAppStore Guidelines Summary's CDN-font exception; no dataset data is included in those requests. System font fallbacks are used when offline.

## Architecture

```text
File → parser → normalized Dataset → profiler → Data Health → React dashboard
                                                     ↓
                                      search / filter / sort → CSV export
```

`web/src/services/` contains pure parsing, inference, profiling, statistics, filtering, export, and storage functions. React components render those results without embedding business logic. The service worker is not hand-written: `vite-plugin-pwa` generates `web/dist/sw.js` (Workbox, precache + `index.html` navigation fallback) during production builds only.

## Technology stack

- TypeScript 5.7 (strict)
- React 19
- Vite 6
- Tailwind CSS 4.1, plus application-specific CSS tokens
- pnpm 10 workspace

No charting, state-management, parsing, or UI framework is used.

## Local development

Prerequisites: Node.js 20.19+ and pnpm 10.30+.

```sh
pnpm install
pnpm dev
```

Open the local URL Vite prints (http://localhost:5173). Upload a CSV or JSON file; the data remains in your browser.

### Sample data

The empty state has **Try a sample CSV** and **Try a sample JSON** buttons that load a bundled dataset in one click, so a first-time visitor can see the dashboard without having a file to hand.

The files live in `web/public/samples/`, so they ship with the app and are precached by the service worker (which is why `csv` is in the Workbox `globPatterns`). Both deliberately include quality problems so the Data Health report has something to find:

| File | Contents | Seeded issues |
| --- | --- | --- |
| `web/public/samples/employees.csv` | 20 rows, 8 columns, all five inferred types | Missing salaries, `not available` in a number column, `canada`/`Canada` case mismatch, quoted fields with commas and escaped quotes |
| `web/public/samples/orders.json` | 15 records nested under an `orders` key | A `null` total, `emea`/`EMEA` case mismatch |

## Verification commands

```sh
pnpm test
pnpm typecheck
pnpm build
```

To verify offline behavior, build, then run a production preview. The service worker is registered only in production builds.

```sh
pnpm build && pnpm preview
```

Load http://localhost:4173 once so the service worker precaches the shell, then either stop the preview server or switch DevTools to Offline and refresh. The app should still render and analyse files. Fonts fall back to Georgia/system while offline, because they are fetched from the Google Fonts CDN.

## PWA

`web/public/manifest.json` contains standalone metadata, theme/background colours, and an SVG app icon. The Vite PWA build plugin generates and registers a Workbox service worker during production builds, precaching the emitted HTML, JavaScript, CSS, manifest, and icon assets for offline use after the first successful load.

## FreeAppStore implementation notes

Implemented locally: pnpm workspace layout, strict TypeScript, required visual tokens/fonts/shell behavior, system dark mode, safe-area support, MIT license, manifest, Apple web-app metadata, registered service worker, local-only data handling, and no tracking/cookies.

The repository intentionally does not include Cloudflare deployment configuration because this standalone app has no backend and the supplied requirements do not specify a deployment binding or worker entry point. Confirm final storefront approval, hosted offline behavior, Lighthouse performance, and Cloudflare deployment details in the FreeAppStore review environment.

## Known limitations

- Very large files are parsed on the main browser thread; DataLens warns for files larger than 10 MB but does not claim unlimited input size.
- Date inference intentionally uses conservative ISO-style date patterns to avoid presenting ambiguous text as a date.
- The health score is a deterministic heuristic and should guide review, not certify data correctness.
