# Tableau Embed Hub

> 中文版文档：[README.md](./README.md)

An open-source, multi-team admin console for **embedded Tableau analytics**: drop Tableau Cloud or
Tableau Server workbooks and views into your own product, with team-scoped routing, page-level
permissions, i18n, an AI assistant page and a deploy sample already wired up. Built from scratch on
shadcn/ui + Tailwind CSS v4 + Radix UI — not a fork of another template.

**Status**: Phases 0–4 are done — scaffolding and the TS 7 toolchain, multi-team workspace, Tableau
embedding plus site-management pages, page-level permissions, system configuration, the AI starting
point and a deploy sample. UI is English-only for now (i18n keys are ready for more locales).

> [!WARNING]
> **Not an official project.** Not affiliated with, endorsed by, or sponsored by Salesforce, Inc.
> Tableau and Tableau Cloud are trademarks of Salesforce, Inc. See [THIRD-PARTY.md](./THIRD-PARTY.md).
> The software is provided "as is", without warranty of any kind, and with no support commitment —
> you are responsible for complying with Salesforce's terms.

> [!CAUTION]
> **Credential boundary**: this is a front-end only app, so `.env` values and the built-in demo
> credentials are inlined into the build output. Read [SECURITY.md](./SECURITY.md) before deploying.

## Version

Current version: **0.13.0** — see [CHANGELOG.md](./CHANGELOG.md) (Chinese) for changes and known
issues. Checked across `package.json` / the sidebar / `PROGRESS.md`.

## Tech stack

| Layer | Choice | Version |
| --- | --- | --- |
| UI | React | 19.x |
| Language | TypeScript | 7.1.0-dev.20261009.1 (native compiler, `next` channel; lint uses a TS 6 API alias — see below) |
| Build | Vite | 8.x |
| Styling | Tailwind CSS v4 + shadcn/ui (radix-nova preset) | 4.x |
| Primitives | Radix UI | latest |
| Routing | TanStack Router (file-based) | 1.x |
| Data | TanStack Query | 5.x |
| i18n | i18next + react-i18next | 26.x (en-US only for now) |
| Package manager | pnpm | 12.9.1 (pinned via `packageManager`, same in CI) |
| Runtime | Node.js | 24 (`@types/node` tracks the 24 line) |

### Why TypeScript is installed twice

| Package | Actually points at | Used by |
| --- | --- | --- |
| `@typescript/native` | `npm:typescript@7.1.0-dev.20261009.1` (`next` channel) | `tsc` — `pnpm typecheck` / `pnpm build` |
| `typescript` | `npm:@typescript/typescript6@6.0.2` | `tsc6` — **only** typescript-eslint |

typescript-eslint's peer range is still `>=4.8.4 <6.1.0`, so it **does not support TS 7**
([upstream #10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940) is still open).
It is not merely a declaration: the TS 7 package only exports the new `./unstable/*` API and has none
of the classic JS API typescript-eslint needs (`createSourceFile` / `createProgram`), so widening the
peer range alone would not make it work.

**Roadmap (two phases)**

1. **Once TypeScript 7.1 stable ships**: point `@typescript/native` at `npm:typescript@7.1.x` and leave
   the `next` channel — still two installs, only the first moves from dev to stable.
2. **Once upstream supports TS 7**: retire the TS 6 line, leaving a single TypeScript. Three conditions,
   all required: ① typescript-eslint's peer upper bound is ≥ 7; ② #10940 has landed in a stable release;
   ③ verified locally by running `pnpm typecheck` **and** `pnpm lint` on that single TypeScript.

> ⚠️ Until then: **upgrade TS 7 by changing `@typescript/native` only** — touching `typescript` breaks lint.

## Quick start

```bash
pnpm install
pnpm dev
```

No `.env` needed: the app falls back to a built-in **demo Tableau site + demo credentials** and a
local **demo AI provider**, so every page is clickable immediately.

## Configure your own Tableau site

**Only `.env` changes — no code changes.** Full walkthrough (Connected App setup, trusted domains,
troubleshooting table): [`docs/tableau-setup.md`](./docs/tableau-setup.md).

```bash
cp .env.example .env
# fill in the site binding + credentials, then rebuild
```

| You want to change | Where |
| --- | --- |
| Site (URL / site name / site content URL / embed user) | `VITE_TABLEAU_SERVER_URL` / `_SITE_NAME` / `_SITE_CONTENT_URL` / `_EMBED_USER` |
| Connected App credentials | `VITE_TABLEAU_CLIENT_ID` / `_SECRET_ID` / `_SECRET_VALUE` |
| Restrict to one project, or lift the restriction | `VITE_TABLEAU_PROJECT` (empty = no restriction) |
| Fallback view when `/views` is opened without parameters | `VITE_TABLEAU_FALLBACK_VIEW` — a view UUID on **your** site |
| REST proxy path (must match your gateway) | `VITE_TABLEAU_API_BASE` (default `/tableau-proxy`) |
| REST API version | `VITE_TABLEAU_API_VERSION` (default `3.23`) |
| AI provider (proxy path / model / system prompt) | `VITE_AI_PROXY_URL` / `VITE_AI_MODEL` / `VITE_AI_SYSTEM_PROMPT` |
| Brand name / author / website | `src/config/app.ts` (single source — the tests read it too) |

- **See what is actually in effect**: open `/help` → the *Environment check* card shows the resolved
  site, credential source (demo or `.env`), project filter, proxy path and AI provider.
- ⚠️ **Security boundary**: this is a front-end only app, so `.env` values — and the built-in demo
  credentials — are **inlined into the JS bundle at build time**. Obfuscation only defeats naive
  scanners. Real control lives in Tableau Cloud (trusted-domain allowlist, access level, key
  rotation). To truly hide a secret, move JWT signing to a server.

## Deploy

`pnpm build` produces static assets in `dist/`. The only piece you must configure yourself is the
**REST reverse proxy** (Tableau Cloud REST does not send CORS headers):

1. Serve `dist/` from any static host (CDN / nginx / S3+CDN).
2. Reverse-proxy `/tableau-proxy` to your site, following
   [`deploy/nginx.conf.example`](./deploy/nginx.conf.example) — the path must match
   `VITE_TABLEAU_API_BASE`.
3. Add your production domain to the Connected App's trusted sites.

> The embedding iframe connects to Tableau directly and does **not** go through the proxy; the proxy
> only serves REST (lists, thumbnails, `auth/signin`). Routing is history-based, so the static host
> needs an "unmatched → `index.html`" fallback.

## Pages

| Page | Route | Entry | Default roles |
| --- | --- | --- | --- |
| Workspace (Dashboard / Favorites / Recents / Workbooks / Views) | `/t/{slug}/...` | Sidebar → General | Team members (by role) |
| Tableau site users & roles | `/t/{slug}/tableau/users` | Sidebar → General | **System admins only** (fail-closed; it writes site-wide roles) |
| Tableau scheduled tasks | `/t/{slug}/tableau/schedules` | Sidebar → General | Team members (by role, read-only) |
| AI assistant | `/ai` | Sidebar → AI | All members |
| Users / Teams / Permissions | `/users`, `/teams`, `/permissions` | Sidebar → Settings | Members (permissions page: system admins only) |
| Profile | `/profile` | Sidebar footer user menu | All members |
| SMTP | `/config/smtp` | Sidebar → Config | System admins only (fail-closed) |
| Login page | `/login` | Direct / "Open preview" from the config page | **No permission needed** (pre-login, bare layout) |
| Login page config | `/config/login` | Sidebar → Config | System admins only (fail-closed) |
| Components gallery | `/components` | Sidebar → Config | All members (shared-component catalog + live preview) |
| Help / About | `/help` | Sidebar → Config (**last in the group**) | All members (features, version, third-party notices & trademarks) |

> **Where `/t/{slug}/views` lands**: opening the sidebar **Views** entry (or `/t/{slug}/views` with no
> parameters) first resolves to the **last opened view**; if that cannot be resolved it falls back to the
> fixed view in `VITE_TABLEAU_FALLBACK_VIEW` (by default `Superstore/Overview` on the demo site).
> Links carrying `?workbook=` / `?view=` still open that exact view — existing links keep working.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server |
| `pnpm build` | Type check (`tsc -b`) + production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Type check only |
| `pnpm test` | vitest — pure functions (permission semantics, catalog invariants, SMTP rules, env handling) |
| `pnpm check:i18n` | Locale key alignment |
| `pnpm check:i18n:keys` | Reverse key check: every literal key used in code exists in the dictionary |
| `pnpm check:routes` | Route files ↔ permission catalog consistency (catches the fail-open gap) |
| `pnpm check:team-routes` | Team-slug routing (Chrome CDP, 16 cases; needs `pnpm build`) |
| `pnpm check:permissions` | Page permissions (static self-check + browser cases; needs `pnpm build`) |
| `pnpm check:filters` | List filters (static self-check + 7 page cases incl. geometry; needs `pnpm build`) |
| `pnpm check:smtp` | SMTP configuration (rule assertions + 6 page cases; needs `pnpm build`) |
| `pnpm check:login` | Login page (domain assertions + 7 page cases: style switch, provider toggles, validation blocking, reset to defaults; needs `pnpm build`) |
| `pnpm check:versions` | Dependency drift check against the registry `latest` tag (`--md` / `--json` / `--strict`) |

CDP suites locate Chrome automatically (`CHROME_PATH` overrides), so they run on macOS and Linux/CI.
Suites that drive a browser need a recent `pnpm build` first — they run against `dist/`.

## Conventions

Use the shared components instead of inventing layout per page (details in
[`docs/ui-conventions.md`](./docs/ui-conventions.md), Chinese):

| Component | Purpose |
| --- | --- |
| `PageContainer` | Page root; keeps page width consistent (**do not** add `max-w-*` at page level) |
| `FormGrid` / `FormField` | Form grid & fields (label / `aria-invalid` / `aria-describedby` wired once) |
| `useFormTouch` | When validation messages appear (on blur, or all on save) |
| `FilterBar` / `FilterSearch` / `FilterSelect` + `useListFilters` | List filtering: search, select, count, one-click reset |
| `NoteCallout` / `DescriptionList` / `ActionBar` | Callouts, key–value summaries, action buttons |

Two known traps: table cells default to `whitespace-nowrap` (long text needs `whitespace-normal` plus
a column width), and composite controls (`Select`, `InputGroup`) do not forward props to the DOM —
pass `injectProps={false}` to `FormField` and wire `id`/`aria-*` yourself.

## Page permissions

Roles × routes, configured on `/permissions` (system admins only by default). Page permissions
control **visibility** — the sidebar entry and direct URL access — and are **not** an authorisation
boundary; a server must re-check. Add a page by registering one line in
`src/config/permissions.ts`; `pnpm check:routes` fails if you forget, because the route guard is
fail-open. See [`docs/route-permissions.md`](./docs/route-permissions.md).

## AI assistant

`/ai` is a working chat page whose provider is swappable in one place (`src/lib/ai`). With no
configuration it runs a **local demo provider** (streaming, no network); point
`VITE_AI_PROXY_URL` at a same-origin gateway that speaks the OpenAI-compatible
`POST /chat/completions` streaming API (DeepSeek, OpenAI, most gateways) to use a real model.

> ⚠️ **API keys never go to the front end.** Anything in `.env` is published in the bundle. The page
> sends no key at all — your gateway holds it. Contract, nginx sample and a ~20-line Node gateway:
> [`docs/ai-integration.md`](./docs/ai-integration.md).

## System configuration (SMTP)

`/config/smtp` offers provider presets (QQ / 163 / Gmail / Aliyun / Tencent Exmail / Microsoft 365),
7 live preflight checks (errors block saving, warnings do not) and a password that is never written
to disk — only non-sensitive fields are persisted, so the password lives in memory and must be
re-entered after a reload. Preflight validates *shape*, not real connectivity: a browser cannot open
an SMTP socket. See [`SECURITY.md`](./SECURITY.md).

## Roadmap

- [x] Phase 0 — scaffolding, TypeScript 7 toolchain, i18n framework (en-US), CI
- [x] Phase 1 — layout, workspace pages, organisation management, profile, config, help, shared components
- [x] Phase 2 — list-filter bar, dependency/toolchain alignment
- [x] Phase 3 — **generic starting point**: env-driven site binding, deploy sample, environment check, English README
- [x] Phase 4 — **AI starting point**: `src/lib/ai`, streaming client, zero-config demo provider, `/ai` page, proxy contract
- [ ] Phase 5 (optional) — SQLite backend (Drizzle), dual-database CI matrix, server-side JWT signing
- [ ] v1 — bilingual docs, demo site

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) and [`SECURITY.md`](./SECURITY.md). Architecture and
progress notes are kept in Chinese ([`PROGRESS.md`](./PROGRESS.md), [`CHANGELOG.md`](./CHANGELOG.md)).

## License

MIT
