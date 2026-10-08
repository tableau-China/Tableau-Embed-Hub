# Contributing

Thanks for taking a look. This repository is a **template**: it is meant to be cloned, renamed and
reshaped, so the bar for changes is "does this help someone start faster?" rather than "does this
feature ship?".

## Getting started

```bash
pnpm install          # pnpm 12.9.1 is pinned via packageManager
pnpm dev              # http://127.0.0.1:5174
```

No environment variables are required: without a `.env` the app runs against a built-in **demo**
Tableau site and a local **demo** AI provider, so every page is clickable out of the box.

## Before you open a PR

Run the same checks CI runs:

```bash
pnpm typecheck        # tsc -b (TypeScript 7 native compiler)
pnpm lint             # eslint (0 errors expected; 16 known fast-refresh warnings)
pnpm test             # vitest — pure functions, <1s
pnpm check:i18n       # locale key alignment
pnpm check:routes     # route files ↔ permission catalog consistency
pnpm build            # production build
```

If your change touches behaviour that only exists in a browser, also run the CDP suites
(they build `dist/`, start `vite preview`, drive real Chrome):

```bash
pnpm build
pnpm check:team-routes
pnpm check:permissions
pnpm check:smtp
pnpm check:filters
```

`CHROME_PATH=/path/to/chrome` overrides Chrome autodetection.

## Project conventions

Longer-form conventions live in the docs (written in Chinese — the code and comments are bilingual):

| Document | Covers |
| --- | --- |
| [`docs/tableau-setup.md`](./docs/tableau-setup.md) | Connecting your own Tableau Cloud site, reverse proxy, troubleshooting |
| [`docs/ai-integration.md`](./docs/ai-integration.md) | The AI proxy contract; **API keys stay server-side** |
| [`docs/route-permissions.md`](./docs/route-permissions.md) | Permission model and how to add a page |
| [`docs/ui-conventions.md`](./docs/ui-conventions.md) | Page/form layout, shared components |

A few rules that are easy to trip over:

1. **Adding a page takes one line.** Register it in `src/config/permissions.ts` (`ROUTE_CATALOG`);
   the sidebar entry, the URL guard and the permission matrix all read that one place.
   `pnpm check:routes` fails if you forget — the route guard is fail-open by design.
2. **No secrets in the front end.** Anything in `.env` is inlined into the bundle at build time.
   That is why Tableau uses a Connected App (designed for browser-issued JWTs) and AI keys are
   required to live behind a proxy. Never add a `VITE_*` variable that holds a real secret.
3. **Shared components first.** Use `PageContainer`, `FormGrid`, `ActionBar`, `FilterBar`,
   `NoteCallout`, `DescriptionList` instead of inventing layout per page.
4. **Comments explain why, not what.** The codebase leans on comments to record trade-offs and
   past incidents — please keep that style.
5. **Version numbers are cross-checked.** `package.json`, `src/config/app.ts`, `README.md`,
   `PROGRESS.md` and `CHANGELOG.md` must agree.

## Commit messages

`<type>: <summary in Chinese>`, e.g. `fix: 修正退格键行为 — 顺带补用例`. Types in use:
`feat`, `fix`, `docs`, `chore`, `ci`, `release`, `security`.

## Reporting bugs and security issues

- Functional bugs: open an issue using the template.
- Security issues: **do not** open a public issue — see [`SECURITY.md`](./SECURITY.md).
