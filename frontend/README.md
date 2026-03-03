# MFA Frontend (Next.js)

This is the UI for Mutual Fund Analyzer. It renders portfolio dashboards and calls backend APIs under `/api/*`.

## Prerequisites

- Node.js 20+
- npm 10+

## Local Run

```bash
npm install
npm run dev
```

App starts on `http://localhost:3001`.

## Build and Production Run

```bash
npm run build
npm run start
```

## Environment and API Routing

The app uses `next.config.mjs` rewrites so frontend requests to `/api/*` are forwarded to backend.

Typical local backend URL:
- `http://localhost:8001`

If you need to debug rewrite behavior, check:
1. Browser network tab (`/api/...` request path)
2. Next.js server logs in terminal
3. Backend logs to confirm matching route hits

## Useful Scripts

- `npm run dev` — start dev server with hot reload.
- `npm run build` — create production build.
- `npm run start` — run production build.
- `npm run lint` — run ESLint checks.

## Debug Tips

- If API calls fail in UI but backend works directly, validate rewrite target and container networking.
- In prod compose, backend is internal-only; test API via frontend URL, not direct host backend port.
- Keep backend `CORS_ORIGINS` aligned with frontend origin when running services separately.

## Backend Contract Note: Enrichment Performance History

`GET /api/scheme/{amfi_code}/enrichment` returns `performance` fields below as JSON-serialized strings:

- `quarterly_performance`
- `best_periods`
- `worst_periods`
- `sip_returns`
- `cagr_cat_avg`

Parse them before rendering:

```ts
const quarterly = JSON.parse(performance.quarterly_performance ?? "[]");
```
