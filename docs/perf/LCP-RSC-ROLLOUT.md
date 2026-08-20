# LCP-RSC rollout — close-out (Phase 3c, 2026-08-20)

## Context / why

The dashboard pages were `'use client'` shells: they server-rendered a shimmer
skeleton, then fetched their data from the browser and painted it. That pushed
the Largest Contentful Paint (LCP) — the main content — behind a client-side
round-trip. This rollout converts each page to a **React Server Component (RSC)**
that seeds its initial data on the server via `serverFetchJson`, so the LCP
content ships in the first HTML response.

An earlier rollout had already converted ~16 simple GET pages. This phase
finished the remaining seven, ending with the largest/riskiest one (settings).

## What shipped — 7 pages, one PR each (squash-merged)

| Page | PR | Notes |
|---|---|---|
| milestones | #149 | list |
| notifications | #150 | now-relative (serverNow) |
| gantt | #152 | now-relative timeline |
| reports | #153 | overview metrics computed server-side (`metrics.ts`) |
| analytics | #154 | dashboard (POST-for-read) |
| calendar | #151 | month grid, now-relative |
| **settings** | **#155** | general tab only; other 6 tabs stay client-loaded |

### The recipe (proven across all 7)

- `git mv page.tsx → X-client.tsx`; keep `'use client'`; `export` the data types.
- New `page.tsx` = `async` RSC, `export const dynamic = 'force-dynamic'`, calls
  `serverFetchJson('/api/…')` and passes `initial*` props.
- Client seeds state from `initial*`, tracks `const [hadInitialData] = useState(() => initial !== null)`,
  skips the first mount fetch when seeded (later filter/period refetches still run),
  and gates the root entrance animation `initial={hadInitialData ? false : 'hidden'}`.
- **Helpers the RSC calls server-side must live in a non-`'use client'` module**
  (e.g. `reports/metrics.ts`) or Next throws "called from the server but … is on
  the client" at runtime (typecheck won't catch it — the authed smoke does).
- now-relative pages pass `serverNow={Date.now()}` and initialise all
  `new Date()`-derived values from it so SSR == first client render, then advance
  to the real clock after mount — prevents hydration mismatch.

## Results — LCP before → after (same harness)

`scripts/measure-lcp.mjs`, production build (`next build` + standalone server),
authenticated, cold cache, CPU ×4 throttle, n=4, median. Audit DB (4 projects /
60 tasks; milestones + notifications render empty state).

| Route | Before (client-fetch) | After (RSC) | Δ |
|---|---|---|---|
| /notifications | 1566 ms | 164 ms | **−89%** |
| /reports | 1238 ms | 218 ms | **−82%** |
| /milestones | 798 ms | 184 ms | −77% |
| /gantt | 686 ms | 180 ms | −74% |
| /calendar | 946 ms | 258 ms | −73% |
| /analytics | 842 ms | 228 ms | −73% |
| /settings | 838 ms | 756 ms | −10% |

Six of seven routes dropped to ~160–260 ms LCP. **Settings improved least (−10%)**
by design: only the small general-tab org form is server-seeded, and that form is
not the page's LCP element (the heavier tab content / EOD-schedule block stays
client-loaded). Seeding more of settings server-side is a possible follow-up.

## What broke and was fixed (during this session)

1. **Settings hydration mismatch** — the browser applies a client-only
   `caret-color: transparent` to disabled inputs; once the general-tab form was
   server-rendered, React flagged it (non-deterministically). Fixed with
   `suppressHydrationWarning` on the three read-only display inputs (the value is
   server-authoritative; only the cosmetic caret differs). Verified 0 console /
   0 page errors across repeated authed runs.
2. **Two unit tests failed in CI** (`settings-page.test.tsx`,
   `notification-preferences.test.tsx`) — they imported the default export from
   `settings/page` and `render()`-ed it, but that path is now the async RSC
   (uses `next/headers`) and can't render in jsdom. Fixed by pointing both at the
   extracted `SettingsClient` named export (matches the `DashboardClient` /
   `SnapshotDetailClient` pattern); rendering it with no `initialOrg` reproduces
   the client-fetch-on-mount path the tests already mock.

## Verification gate (final `main`, 5006a09)

- Typecheck clean; unit suite **89 files / 1609 tests green**; production build
  clean (all 7 routes flip `○ → ƒ`).
- Authed multi-page live smoke (prod build, real login): **0 console / 0 page
  errors, no blank renders** across dashboard, tasks, projects, teams + the 7
  converted routes + all 7 settings tabs.
- Integration harness, chromium/firefox/mobile E2E, and full `eslint .` are
  CI-covered and green on every PR.

## Gotchas worth keeping

- **Prod standalone auth:** `NODE_ENV=production` + better-auth's default secret
  → `BetterAuthError` (dev is lenient, prod is strict). `next start` also warns
  it doesn't support `output: standalone`. To measure/smoke the prod build:
  `node .next/standalone/apps/web/server.js` with `.next/static` + `public`
  copied in, and a stable `BETTER_AUTH_SECRET` set — otherwise every request
  500s and you silently measure the login page.
- **`serverFetchJson` returns `null`** (no cookie / not-ok / parse fail) so the
  client falls back to fetching on mount — this is why the E2E specs (fake
  `mock-session-token`) still exercise the old client path unchanged.

## Deliberately skipped / deferred

- `search` and `timer` pages (kept client-rendered on purpose).
- Deeper settings server-seeding (would move the −10% closer to the others).
- Same-harness "before" numbers use the audit DB's limited dataset; they are
  directional, not a production benchmark.
