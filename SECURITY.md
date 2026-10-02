# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for a security problem. Report it privately via
GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
("Security" tab → "Report a vulnerability"), or contact the maintainer listed in
[`src/config/app.ts`](./src/config/app.ts).

Please include: what you did, what happened, what you expected, and the commit you tested.

## What this project is (and is not)

This is a **front-end only** template. Understanding the boundary saves everyone time:

| Area | Design decision |
| --- | --- |
| **Credentials** | Anything in `.env` is **inlined into the JS bundle at build time**. That is not a bug but the physics of a static app. Tableau access uses a Connected App, which is *designed* for browser-issued JWTs; the real control lives in Tableau Cloud (trusted-domain allowlist, access level, key rotation). |
| **Demo credentials** | The repository intentionally ships **demo** Tableau credentials and a demo site so `git clone` shows a working dashboard. They are for an isolated demo site — do not reuse them, and rotate them if that site ever holds anything real. |
| **Permissions** | Page permissions (`/permissions`) and the route guard control **visibility**, not authorisation. Switching the demo user or editing `localStorage` bypasses them by design. Authorisation belongs to a server. |
| **SMTP** | The SMTP password is never persisted (excluded via `partialize`); it lives in memory only. Preflight checks validate *shape*, not real connectivity — a browser cannot open an SMTP socket. |
| **AI** | The AI page talks only to a **same-origin proxy** (`VITE_AI_PROXY_URL`) and never sends an API key. Any PR that moves a model key (or any secret) into `VITE_*` will be rejected: it would be published in the bundle. |

If you deploy this template, the security work that remains on your side is:

1. Put a server in front of it: authenticate users, and re-check permissions per request.
2. Keep every secret server-side (Tableau JWT signing, SMTP sending, AI provider keys).
3. Configure TLS, `Content-Security-Policy`/`frame-ancestors` and the Tableau trusted-domain list.

## Supported versions

The template tracks its own `main` branch; fixes land there. There are no maintained release
branches — pin a commit if you need stability.
