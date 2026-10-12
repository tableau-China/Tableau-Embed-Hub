# Tableau Embed Hub

[![CI](https://github.com/tableau-China/Tableau-Embed-Hub/actions/workflows/ci.yml/badge.svg)](https://github.com/tableau-China/Tableau-Embed-Hub/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![Version](https://img.shields.io/badge/version-0.13.3-informational.svg)](./CHANGELOG.md)
[![React 19](https://img.shields.io/badge/React-19-087ea4.svg)](https://react.dev)
[![TypeScript 7](https://img.shields.io/badge/TypeScript-7-3178c6.svg)](https://www.typescriptlang.org)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8.svg)](https://tailwindcss.com)
[![Stars](https://img.shields.io/github/stars/tableau-China/Tableau-Embed-Hub?style=flat)](https://github.com/tableau-China/Tableau-Embed-Hub/stargazers)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)
[![Node.js 24](https://img.shields.io/badge/Node.js-24-339933.svg)](https://nodejs.org)

> 中文版文档：[README.md](./README.md) ｜ Repository: <https://github.com/tableau-China/Tableau-Embed-Hub>

## Embed your Tableau analytics in your own product, instead of sending users to Tableau

An open-source **multi-team admin console plus a Tableau embedding starting point**: team-scoped routing
(`/t/{slug}/...`), page-level permissions, a login-page template, SMTP configuration, an AI assistant page
and a deploy sample are all wired up — clone it and make it yours. Built **from scratch** on
shadcn/ui + Tailwind CSS v4 + Radix UI + TanStack — not a fork of another template.

### Core design overview

#### Architecture: in-browser JWT signing + two paths (REST proxy + direct iframe)

This is a **front-end-only architecture**: JWT signing happens entirely in the browser (jose library),
REST API requests are forwarded to Tableau Cloud through an nginx reverse proxy, and view embedding
uses the browser's direct iframe connection to Tableau. This keeps deployment simple (pure static
output + nginx config) while preserving the full Tableau Embedding API surface.

![Architecture: JWT signed in browser, REST API goes through nginx proxy, view embedding uses direct iframe](docs/images/architecture.png)

#### Multi-tenant model: global users × team workspaces × role grants

Users are **global identities** (across teams); teams are **workspace boundaries** (resource
isolation); roles are **attributes of a team-membership relation**. The same person can have
a different role in each team — for example, Alice is admin in Team A but only viewer in Team B.
This mirrors how enterprise delivery usually works.

![Organization model: users can have different roles in different teams; the same person may be admin in Team A and viewer in Team B](docs/images/multi-tenant.png)

#### Permission model: role × route matrix, fail-closed by default

Permissions are a **role × route check matrix**, edited on `/permissions`. Adding a page is one line
in the route catalog — the sidebar, route guard and permissions page all read the same catalog.
**Fail-closed by default**: unlisted pages are blocked, so there are no permission blind spots.

![Permission matrix: system-admin / team-admin / analyst / viewer roles mapped to page access](docs/images/permissions-matrix.png)

#### Tableau embedding flow: JWT sign → REST metadata → iframe view

The full Tableau embedding flow has three steps: sign a Connected App JWT in the browser with jose,
fetch workbooks and thumbnails through the REST proxy (including `auth/signin` for the session
token), then embed the view with the Tableau Embedding API in an iframe. Tokens and thumbnails are
cached in TanStack Query to avoid repeated requests.

![Embedding flow: JWT signed in browser, workbook list fetched through REST proxy, view embedded via direct iframe](docs/images/tableau-flow.png)

### What it looks like

![The multi-team workspace: General / AI / Settings / Config navigation on the left, the current team's dashboard and recent activity on the right](docs/images/dashboard.png)

**Status**: Phases 0–4 are done — scaffolding and the TS 7 toolchain, multi-team workspace, Tableau
embedding plus site-management pages, page-level permissions, system configuration, the AI starting
point and a deploy sample. The UI is **en-US only** for now.

> [!WARNING]
> **Not an official project.** Not affiliated with, endorsed by, or sponsored by Salesforce, Inc.
> Tableau and Tableau Cloud are trademarks of Salesforce, Inc. See [THIRD-PARTY.md](./THIRD-PARTY.md).
> The software is provided "as is", without warranty of any kind, and with no support commitment —
> you are responsible for complying with Salesforce's terms.

> [!CAUTION]
> **Credential boundary**: this is a front-end only app, so `.env` values and the built-in demo
> credentials are inlined into the build output. Read [SECURITY.md](./SECURITY.md) before deploying.

## Quick start (5 minutes)

Three steps, **zero configuration** — nothing to fill in before the whole UI works.

```bash
# 1) Clone and install — Node.js 24 + pnpm 12.9.1 (`packageManager` pins it; CI uses the same)
git clone https://github.com/tableau-China/Tableau-Embed-Hub.git
cd Tableau-Embed-Hub
pnpm install

# 2) Start the dev server — port pinned to 5174, IPv4 loopback only
pnpm dev            # → http://127.0.0.1:5174
```

**3) Open <http://127.0.0.1:5174> — here is what you get**

| What you see | Why |
| --- | --- |
| The workspace, straight in — **no login** | `/` redirects to the current team's `/t/acme_hq` (demo data: the Admin user, default team Acme HQ) |
| Sidebar groups **General / AI / Settings / Config** | Dashboard plus Favorites, Recents, Workbooks and Views all live under General |
| **A real embedded Tableau view** | With no `.env` it uses the built-in **demo site + demo credentials** |
| The AI page **streaming** a reply | Built-in **demo provider**: streams locally, makes no network requests |
| Three demo teams to switch between | `acme_hq` / `acme_analytics` / `acme_data_platform`; team identity lives in the URL (`/t/{slug}`) |

> Want to know whether you are on the demo values or your own? Open **`/help` → environment check**
> inside the app — it reports each one.

**Where to go next**

| I want to… | Read |
| --- | --- |
| Connect my own Tableau Cloud site (`.env` only, no code changes) | [Configure your own Tableau site](#configure-your-own-tableau-site) · [docs/tableau-setup.md](./docs/tableau-setup.md) (Chinese) |
| Add a page / edit the permission matrix | [docs/route-permissions.md](./docs/route-permissions.md) (Chinese) |
| Change the login layout / wire real sign-in | [docs/login-setup.md](./docs/login-setup.md) (Chinese) |
| Point `/ai` at a real model | [docs/ai-integration.md](./docs/ai-integration.md) |
| Deploy to my own domain | [deploy/nginx.conf.example](./deploy/nginx.conf.example) |
| Run the checks before opening a PR | [CONTRIBUTING.md](./CONTRIBUTING.md) |

> ⚠️ **Before deploying**: this is a front-end only app, and everything in `.env` is inlined into the
> build output. [SECURITY.md](./SECURITY.md) covers the credential boundary and what still has to
> happen server-side.

## Is this for you?

| A good fit | Not a good fit |
| --- | --- |
| Teams that want Tableau views inside **their own product UI** (rather than every user logging into Tableau) | People wanting a ready-made **backend + database**: this is a front-end template, data lives in the browser (store + localStorage) |
| Teams needing an admin-console skeleton with a **real permission model** (multi-team / roles / page-level grants) | Anyone needing a **Chinese UI today**: the i18n framework is in place but only the en-US dictionary ships |
| AI-assisted development for **enterprise delivery**, where a forkable starting point beats a blank page | Anyone wanting a Tableau desktop/client replacement: embedding depends on Connected App, and the boundaries are set by Salesforce |
| Learning how a from-scratch React 19 + TS 7 + Tailwind v4 + TanStack app is wired together | Anyone wanting a component library or design system: the primitives are shadcn/ui (Radix) |

## Features & Pages

| Page | Route | Entry | Default roles |
| --- | --- | --- | --- |
| Workspace (Dashboard / Favorites / Recents / Workbooks / Views) | `/t/{slug}/...` | Sidebar → General | Team members (by role) |
| Tableau site users & roles | `/t/{slug}/tableau/users` | Sidebar → General | **System admins only** (fail-closed; it writes site-wide roles) |
| Tableau scheduled tasks | `/t/{slug}/tableau/schedules` | Sidebar → General | Team members (by role, read-only) |
| AI assistant | `/ai` | Sidebar → AI | All members (demo provider when no proxy is configured) |
| Users / Teams / Permissions | `/users`, `/teams`, `/permissions` | Sidebar → Settings | Members (permissions page: system admins only) |
| Profile | `/profile` | Sidebar footer user menu | All members (renamed from `/settings` in v0.7.0) |
| SMTP | `/config/smtp` | Sidebar → Config | System admins only (fail-closed) |
| Login page | `/login` | Direct / "Open preview" from the config page | **No permission needed** (pre-login, bare layout) |
| Login page config | `/config/login` | Sidebar → Config | System admins only (fail-closed) |
| Components gallery | `/components` | Sidebar → Config | All members (shared-component catalog + live preview) |
| Help / About | `/help` | Sidebar → Config (**last in the group**) | All members (features, version, third-party notices & trademarks) |

> **Where `/t/{slug}/views` lands**: opening the sidebar **Views** entry (or `/t/{slug}/views` with no
> parameters) first resolves to the **last opened view**; if that cannot be resolved it falls back to the
> fixed view in `VITE_TABLEAU_FALLBACK_VIEW` (by default `Superstore/Overview` on the demo site).
> Links carrying `?workbook=` / `?view=` still open that exact view — existing links keep working.

## Core capabilities

### Multi-team workspace with global users

Users are global identities; teams are workspaces. The same person can hold a different **role** in each
team, and permissions are evaluated against the role in the *current* team — which is how enterprise
delivery usually works (one analyst is an admin in team A and a viewer in team B).

![User list: status, system-admin flag, and each user's role and default team across teams](docs/images/users.png)

- A user must belong to at least one team; the last system admin and the current user cannot be deleted;
  exactly one default team per member (v0.4.0 / v0.9.0).
- A team slug is typed once at creation and **never changes when the team is renamed** (letters, digits
  and underscores only) — so external mappings keyed by slug cannot silently break.
- Full rules: [`docs/org-rules.md`](./docs/org-rules.md) (Chinese).

### Page-level permissions (roles × routes)

Grant pages per role on `/permissions`; a new page enters the system by registering **one line**, and the
sidebar order comes from the same catalog. That catalog is the single source of truth — the sidebar, the
route guard and the permissions page all read it — so a page cannot be added yet forgotten. A static
check script backs that up (`pnpm check:routes`).

![Permissions page: the role × page matrix, with team-scoped and global identities and per-role defaults](docs/images/permissions.png)

- **Fail-closed**: a page that is not registered is blocked, not allowed. Pages with no sidebar entry
  (Profile, for example) are registered too, so moving an entry cannot create a permission blind spot.
- Button-level permissions ship only as the reserved `action.*` namespace — not implemented yet.
- Details: [`docs/route-permissions.md`](./docs/route-permissions.md) (Chinese).

> ⚠️ Front-end permissions control visibility and direct access only — they are **not** an authorisation
> boundary. A backend must re-check every request once you connect one.

### Tableau embedding

A Connected App JWT is signed in the browser, then workbooks and views are embedded. REST calls
(workbook lists, thumbnails, `auth/signin`) go through a **same-origin proxy**, because Tableau Cloud's
REST API does not send CORS headers.

- **`.env` only, no code changes**: site URL, site name, site content URL, embed user, Connected App
  credentials, project filter and API version are all configurable.
- **In-app self-check**: `/help` → the *Environment check* card shows the resolved site, credential
  source (demo or `.env`), project filter and proxy path.
- Pitfalls, trusted-domain allowlisting and a troubleshooting table:
  [`docs/tableau-setup.md`](./docs/tableau-setup.md) (Chinese).

> ⚠️ Credentials in the build output are **readable in plain text**; obfuscation only defeats naive
> scanners and is **not encryption**. Real control lives in Tableau Cloud (Connected App trusted-domain
> allowlist, access-level restrictions, key rotation). To truly hide a secret, move JWT signing to a server.

### Login-page template

`/config/login` picks the layout (`centered-card` / `split-hero` / `fullscreen-card`), sets a hero image
and manages the **public** parameters of the GitHub / Google entries; `/login` renders from that config
and can be opened or previewed directly. The form uses a hand-built "paper" language: mono small-caps
labels, underline inputs, a mint accent line that grows on focus, and square mint primary buttons.

![Login page: third-party entries between two hairlines, underline inputs and a square mint primary button](docs/images/login.png)

> ⚠️ **This login page is a UI template**: `/login` blocks **nothing** and creates no session (faking a
> front-end session is security theatre); the captcha is a placeholder; **no Client Secret is collected**
> (storing a secret in the front end is publishing it). The full contract for wiring a backend
> (session / captcha / OAuth callback): [`docs/login-setup.md`](./docs/login-setup.md) (Chinese).

### AI assistant

`/ai` is a working chat page whose provider is swappable in one place (`src/lib/ai`). With no
configuration it runs a **local demo provider**; point `VITE_AI_PROXY_URL` at a same-origin gateway that
speaks the OpenAI-compatible `POST /chat/completions` streaming API (DeepSeek, OpenAI, most gateways) to
use a real model.

> ⚠️ **API keys never go to the front end.** Anything in `.env` is published in the bundle, so the page
> sends no key at all — your gateway holds it. Contract, nginx sample and a ~20-line Node gateway:
> [`docs/ai-integration.md`](./docs/ai-integration.md) (Chinese).

### System configuration (SMTP)

`/config/smtp` offers provider presets (QQ / 163 / Gmail / Aliyun / Tencent Exmail / Microsoft 365) and
**7 live preflight checks — errors block saving, warnings do not**. Leaving the password blank keeps the
existing one; resetting asks for confirmation.

> ⚠️ **The password is never persisted.** "Encrypt it and put it in localStorage" is security theatre in a
> front-end app — the key ships in the bundle. So only non-sensitive fields are persisted and the password
> lives in memory (re-enter it after a reload). With a backend, store it server-side and return only
> `hasPassword`.
>
> ⚠️ **Preflight ≠ real connectivity**: a browser cannot open an SMTP socket, so the real handshake
> (EHLO → STARTTLS → AUTH) must run server-side (`nodemailer`'s `transporter.verify()`).

### Shared components and the component gallery

Use the shared components instead of inventing layout per page (details in
[`docs/ui-conventions.md`](./docs/ui-conventions.md), Chinese):

| Component | Purpose |
| --- | --- |
| `PageContainer` | Page root; keeps page width consistent (**do not** add `max-w-*` at page level) |
| `FormGrid` / `FormField` | Form grid & fields (label / `aria-invalid` / `aria-describedby` / hint row wired once; put a narrow column on the form, not the page) |
| `useFormTouch` | When validation messages appear (on blur, or all on save; **do not disable the primary action** while invalid) |
| `FilterBar` / `FilterSearch` / `FilterSelect` + `useListFilters` | List filtering: search, select, result count, one-click reset (**reset appears only when something is filtered**; empty state distinguishes "no data" from "filtered out") |
| `NoteCallout` | Info / warning callouts |
| `DescriptionList` | Label + value summaries |
| `ActionBar` / `ActionButtons` | Action buttons (primary always rightmost, stacked on narrow screens) |

`/components` lists all 37 shared pieces in 8 groups, each with its **real import path, a one-line
purpose and a live preview**. The catalog's single source is `src/config/component-catalog.ts` — adding a
shared piece is adding one line.

Two known traps: table cells default to `whitespace-nowrap`, so long text needs `whitespace-normal` plus
a column width (`SidebarInset` / `main` already apply `min-w-0`, so over-wide content should scroll inside
a card instead); and composite controls (`Select` / `InputGroup`) do not forward props to the DOM — pass
`injectProps={false}` to `FormField` and wire `id` / `aria-*` yourself.

### Check scripts

The easiest thing for a template to rot is having the catalog and the code disagree. So the invariants
here are executable, repeatable commands, and they run in CI:

```bash
pnpm test           # 113 pure-function tests: permission semantics, catalog invariants, SMTP rules, env handling
pnpm check:routes   # route files ↔ permission catalog consistency (static, blocking CI step)
pnpm check:i18n:keys # reverse key check: every key used in code exists in the dictionary
pnpm build && pnpm check:permissions   # page permissions, driven through real Chrome over CDP
```

CI runs two jobs: `ci` (path guard, i18n, route catalog, unit tests, lint, build — blocking) and
`ui-checks` (five browser suites: `check:team-routes` / `smtp` / `login` / `filters` / `permissions`),
which is still advisory — the reason is written in the workflow comments (geometry assertions depend on
font rendering and have not been measured on Linux yet).

## Tech stack

| Layer | Choice | Version |
| --- | --- | --- |
| UI | React | 19.x |
| Language | TypeScript | 7.1.0-dev.20261009.1 (native compiler, `next` channel; lint uses a TS 6 API alias — see below) |
| Build | Vite | 8.x |
| Styling | Tailwind CSS v4 + shadcn/ui (radix-nova preset) | 4.x |
| Primitives | Radix UI | latest |
| Routing | TanStack Router (file-based, per-route code splitting) | 1.x |
| Data | TanStack Query | 5.x |
| i18n | i18next + react-i18next | 26.x (en-US only for now) |
| State | zustand (locally persisted) | 5.x |
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

## Configure your own Tableau site

**Only `.env` changes — no code changes.** Full walkthrough (Connected App setup, trusted domains,
troubleshooting table): [`docs/tableau-setup.md`](./docs/tableau-setup.md) (Chinese).

```bash
cp .env.example .env      # .env is gitignored
# fill in the three site-binding values + the three credential values, then rebuild
```

| You want to change | Where |
| --- | --- |
| Site (URL / site name / site content URL / embed user) | `VITE_TABLEAU_SERVER_URL` / `_SITE_NAME` / `_SITE_CONTENT_URL` / `_EMBED_USER` |
| Connected App credentials | `VITE_TABLEAU_CLIENT_ID` / `_SECRET_ID` / `_SECRET_VALUE` |
| Restrict to one project, or lift the restriction | `VITE_TABLEAU_PROJECT` (empty = no restriction) |
| REST proxy path (must match your gateway) | `VITE_TABLEAU_API_BASE` (default `/tableau-proxy`) |
| REST API version | `VITE_TABLEAU_API_VERSION` (default `3.23`) |
| Brand name / author / website | `src/config/app.ts` (single source — the tests read it too) |

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

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server (`http://127.0.0.1:5174`; port pinned, IPv4 loopback only) |
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
| `node scripts/capture-readme-shots.mjs` | Regenerate this README's four screenshots (needs `pnpm build`; writes to `docs/images/`) |

CDP suites locate Chrome automatically (`CHROME_PATH` overrides), so they run on macOS and Linux/CI.
Suites that drive a browser need a recent `pnpm build` first — they run against `dist/`.

## Documentation map

| Document | Read it when |
| --- | --- |
| [`docs/tableau-setup.md`](./docs/tableau-setup.md) | Switching from the demo site to your own Tableau Cloud site |
| [`docs/route-permissions.md`](./docs/route-permissions.md) | Adding a page, editing the permission matrix, or understanding `ROUTE_CATALOG` |
| [`docs/org-rules.md`](./docs/org-rules.md) | Changing the organisation model: users, teams, membership, freezing |
| [`docs/ui-conventions.md`](./docs/ui-conventions.md) | Adding a page / form / list, or wondering why not to hand-roll layout |
| [`docs/ai-integration.md`](./docs/ai-integration.md) | Moving `/ai` from the demo provider to a real model (with a gateway sample) |
| [`docs/login-setup.md`](./docs/login-setup.md) | Login layouts, hero image, third-party entries, and the backend contract |
| [`SECURITY.md`](./SECURITY.md) | Before deploying: credential boundary and vulnerability reporting |
| [`THIRD-PARTY.md`](./THIRD-PARTY.md) | Third-party components, trademarks and notices |
| [`CHANGELOG.md`](./CHANGELOG.md) | What changed in each version, plus known issues (Chinese) |
| [`PROGRESS.md`](./PROGRESS.md) | Progress, key decisions, environment pitfalls and workarounds (Chinese) |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md) | Local setup, commit conventions and the PR flow |
| [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) | Community standards and the private channel for reporting unacceptable behaviour |

## Roadmap

- [x] Phase 0 — scaffolding, TypeScript 7 toolchain, i18n framework (en-US), CI
- [x] Phase 1 — layout, workspace pages, organisation management, profile, config, help, shared components
- [x] Phase 2 — list-filter bar, dependency/toolchain alignment
- [x] Phase 3 — **generic starting point**: env-driven site binding, deploy sample, environment check, English README
- [x] Phase 4 — **AI starting point**: `src/lib/ai`, streaming client, zero-config demo provider, `/ai` page, proxy contract
- [ ] Phase 5 (optional) — SQLite backend (Drizzle), dual-database CI matrix, server-side JWT signing
- [ ] v1 — pure front-end runnable template, bilingual docs, demo site

## License

[MIT License](./LICENSE) — commercial use, modification and closed-source distribution are all fine;
keep the copyright and licence notice.

> Tableau and Tableau Cloud are trademarks of Salesforce, Inc. This project is not affiliated with,
> endorsed by, or sponsored by Salesforce, Inc.

## Contributors

Thanks to everyone who filed an issue, opened a PR, or took the template for a spin.

<a href="https://github.com/tableau-China/Tableau-Embed-Hub/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=tableau-China/Tableau-Embed-Hub" alt="Contributor avatars" />
</a>

## Star history

[![Star History Chart](https://api.star-history.com/svg?repos=tableau-China/Tableau-Embed-Hub&type=Date)](https://star-history.com/#tableau-China/Tableau-Embed-Hub&Date)
