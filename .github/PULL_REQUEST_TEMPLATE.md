## What does this change?

<!-- One or two sentences. Link the issue if there is one. -->

## Why

<!-- The problem it solves. If it is a fix, describe the bug's impact, not just the symptom. -->

## How was it verified?

<!-- Paste the commands you ran. "It should work" is not verification. -->

- [ ] `pnpm typecheck`
- [ ] `pnpm lint` (0 errors)
- [ ] `pnpm test`
- [ ] `pnpm check:i18n`
- [ ] `pnpm check:routes`
- [ ] `pnpm build`
- [ ] Browser checks, if behaviour changed: `pnpm build && pnpm check:team-routes / check:permissions / check:smtp / check:filters`

## Checklist

- [ ] No secret added to `VITE_*` (anything in `.env` is published in the bundle)
- [ ] New pages are registered in `src/config/permissions.ts` (`pnpm check:routes` passes)
- [ ] New UI text goes through i18n (`pnpm check:i18n` passes)
- [ ] Shared components used instead of per-page layout (`PageContainer`, `FormGrid`, `ActionBar`, `FilterBar`, …)
- [ ] Docs updated when behaviour or configuration changed (`README.md`, `docs/`, `CHANGELOG.md`, `PROGRESS.md`)
- [ ] Version numbers still agree across `package.json` / `src/config/app.ts` / `README.md` / `PROGRESS.md` / `CHANGELOG.md`

## Screenshots (if the UI changed)

<!-- Before / after, wide and narrow viewport. -->
