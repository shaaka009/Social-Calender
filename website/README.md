# join-social.com website

Static site deployed via Cloudflare Workers + Static Assets (from repo `website/`).

## Production branch

Use **`main`**. Build settings:

- **Path / root directory:** `/website`
- **Build command:** empty
- **Deploy command:** `npx wrangler deploy`
- **Env:** `SKIP_DEPENDENCY_INSTALL=true` (optional; avoids installing Expo/Django)

Do **not** add a `_redirects` rule that maps `/reset-password/*` → `index.html` — Cloudflare rejects that as an infinite loop.

## Password reset

Emails link to:

`https://join-social.com/reset.html?uid=...&token=...`

That page POSTs to `https://api.join-social.com/api/password-reset/<uid>/<token>/`.
Ensure Render has `FRONTEND_BASE_URL=https://join-social.com` (CORS falls back to this if `CORS_ALLOWED_ORIGINS` is unset).

## Apple App Site Association

`/.well-known/apple-app-site-association` still has placeholder `TEAMID`.
Replace before Universal Links will verify (after Apple Developer account).

## Local preview

```bash
npx --yes serve website
```
