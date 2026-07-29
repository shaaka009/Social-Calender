# TODO for MVP Launch (App Store / TestFlight)

This file is a **single source of truth** for what's left before shipping an MVP, based on an audit of the repo (frontend Expo + backend Django) and the gaps we identified.

---

## Domains & architecture (decided)

Owned domains: **join-social.com** and **join-social.net**.

- **Primary:** `join-social.com`. Redirect `join-social.net` → `join-social.com` (301).
- **Landing / legal:** `https://join-social.com` — host `/privacy` and `/support` (or `support@join-social.com`).
- **Backend API:** `https://api.join-social.com` (Render Web Service custom domain).
- **Deep links + password reset:** `https://join-social.com` — hosts `.well-known/apple-app-site-association` and `.well-known/assetlinks.json`; this is the value for `FRONTEND_BASE_URL`.

Concrete env values to use:

| Var | Value |
|-----|-------|
| `DJANGO_ALLOWED_HOSTS` | `api.join-social.com,<service>.onrender.com` |
| `CORS_ALLOWED_ORIGINS` | `https://join-social.com` |
| `FRONTEND_BASE_URL` | `https://join-social.com` |
| `EXPO_PUBLIC_API_URL` | `https://api.join-social.com` |
| `PASSWORD_RESET_APP_SCHEME` | `socialcalendar` (already the default; leave as-is) |

**Branding note (decision, not a blocker):** app name is "Social Calendar", URL scheme is `socialcalendar`, bundle id is `com.socialcalendar.app`, but the domain is "join-social". The scheme/bundle do NOT need to match the domain, and changing the bundle id later is painful — leave them. Just decide intentionally what the App Store display name and landing-page branding should be.

---

## ✅ Completed

- [x] **Switch auth from sessions to JWT** — `djangorestframework-simplejwt` added, signin/signup return tokens, all API views use `JWTAuthentication`, token refresh endpoint at `/api/token/refresh/`
- [x] **Frontend JWT integration** — `helpers/auth.js` (expo-secure-store), `helpers/api.js` with `Authorization: Bearer` header, auto-refresh on 401, env-based `EXPO_PUBLIC_API_URL`
- [x] **Backend production settings** — `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, CORS, email, and database all driven by env vars; `DATABASE_URL` auto-switches to Postgres
- [x] **Fix dashboard notification generation** — scoped to current user only, throttled to 1 refresh/hour/user (no more full-table scan on every request)
- [x] **Password reset deep link** — reset URL built from `FRONTEND_BASE_URL` env var; reset link only exposed in response when `DEBUG=True`
- [x] **Expo / App Store config** — `app.json` now has `bundleIdentifier`, `android.package`, real `scheme`, iOS permission strings, `eas.json` with build profiles
- [x] **In-app account deletion** — `DELETE /api/account/delete/` endpoint + confirmation UI on profile screen (Apple requirement)
- [x] **Sign Out** — added to profile screen with token clearing
- [x] **Remove TODO placeholders** — events tab notification button now navigates to home (notification center)
- [x] **Removed `CsrfExemptSessionAuthentication`** — cleaned up unused session auth code

### ✅ Completed in the pre-launch cleanup session

- [x] **Code cleanup (Phase 0)** — deleted dead `components/home/QuickActions.jsx`; built out `app/profile/settings/about.jsx` (name/version + Privacy/Terms/Support links to `join-social.com`); removed redundant contacts filter stub modal (tag chips already filter inline); renamed npm package `kitcal` → `social-calendar`, README + Makefile now say "Social Calendar"; removed broken `reset-project` npm script; `make test-frontend` now runs `expo lint`.
- [x] **Backend made production-serve-ready** — pinned `Django>=4.2,<5.0`; added `gunicorn` + `whitenoise`; WhiteNoise middleware + `CompressedManifestStaticFilesStorage`; `SECURE_PROXY_SSL_HEADER`, HSTS, SSL redirect, secure cookies, and `CSRF_TRUSTED_ORIGINS` (all env-gated / prod-only); Postgres now uses `CONN_MAX_AGE` + `sslmode=require` for remote DBs.
- [x] **Render config committed** — `render.yaml` blueprint (web service + free Postgres, gunicorn start command, `/admin/login/` health check, all env vars scaffolded) and executable `build.sh` (installs deps, `collectstatic`, `migrate`).
- [x] **Verified** — `manage.py check --deploy` clean with a real key; `collectstatic` OK (469 files post-processed); 56/56 backend tests pass; frontend lint has 0 errors.

---

## The plan (sequenced)

### Phase 0 — Pre-flight code cleanup — ✅ DONE (see above)

### Phase 1 — Backend deployment on Render

Code/config is ready (`render.yaml`, `build.sh`, gunicorn, whitenoise). Remaining is the actual Render setup:

- [ ] In Render: **New + → Blueprint**, point at this repo (it reads `render.yaml`) → creates web service + Postgres
- [ ] Fill the `sync: false` env vars in the Render dashboard:
  - [ ] `DJANGO_ALLOWED_HOSTS=api.join-social.com,<service>.onrender.com` (**must include the onrender.com host or health checks 400**)
  - [ ] `CORS_ALLOWED_ORIGINS=https://join-social.com`
  - [ ] `CSRF_TRUSTED_ORIGINS=https://api.join-social.com`
  - [ ] `FRONTEND_BASE_URL=https://join-social.com`
  - [ ] Email: `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USE_TLS`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL` (e.g. `noreply@join-social.com`)
  - [ ] (`DJANGO_SECRET_KEY` auto-generated, `DATABASE_URL` auto-wired, `DJANGO_DEBUG=False` preset by the blueprint)
- [ ] First deploy runs `build.sh` (migrate + collectstatic) automatically — watch the logs
- [ ] Smoke-test the API against the `.onrender.com` URL (e.g. `/admin/login/`, a signup/signin round-trip)

#### Media storage — ✅ code done (Cloudflare R2, private + signed URLs)

Decided: private S3-compatible bucket via `django-storages` + `boto3`, served
through short-lived signed URLs, with resize-on-upload for profile pics (chosen
to also support the future "photos attached to connections" feature). Env-gated
in `settings.py` — local dev still uses the filesystem. Remaining setup:

- [ ] Create a **Cloudflare R2 bucket** (private) + an **R2 API token** (Object Read & Write, scoped to the bucket)
- [ ] Note the account's S3 endpoint: `https://<account_id>.r2.cloudflarestorage.com`
- [ ] Set these env vars on Render (already scaffolded in `render.yaml`):
  - [ ] `AWS_STORAGE_BUCKET_NAME`
  - [ ] `AWS_S3_ENDPOINT_URL` = the R2 endpoint above
  - [ ] `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` = the R2 token's Access Key ID / Secret
  - [ ] `AWS_S3_REGION_NAME=auto` (preset in `render.yaml`)
- [ ] Upload a profile picture end-to-end against R2 and confirm the signed URL renders in the app
- [ ] (Future) `ConnectionPhoto` model + gallery UI — foundation is ready (private bucket, signed URLs, resize helper reusable for thumbnails)

### Phase 2 — DNS / domain wiring

- [ ] Point `api.join-social.com` (CNAME) at the Render service; add it as a custom domain in Render (TLS auto-provisions)
- [ ] Set up the `join-social.com` landing site (even a single static page works) — needed for App Store URLs and `.well-known` hosting
- [ ] 301-redirect `join-social.net` → `join-social.com`
- [ ] Set `EXPO_PUBLIC_API_URL=https://api.join-social.com` in the frontend `.env`

### Phase 3 — Deep links (password-reset emails open the app)

- [ ] Host `https://join-social.com/.well-known/apple-app-site-association` (JSON, `appID` = `<TeamID>.com.socialcalendar.app`, served as `application/json`, no extension)
- [ ] Host `https://join-social.com/.well-known/assetlinks.json` (Android, package `com.socialcalendar.app` + SHA-256 cert fingerprint from EAS)
- [ ] Add to `app.json` iOS: `"associatedDomains": ["applinks:join-social.com"]`
- [ ] Add to `app.json` Android `intentFilters`: an `autoVerify` https filter for `join-social.com` (in addition to the existing `socialcalendar` scheme)
- [ ] Verify reset flow end-to-end: request reset → email link (`https://join-social.com/reset-password/<uid>/<token>`) opens the app

### Phase 4 — Privacy / legal / store prerequisites

- [ ] Write + host **privacy policy** at `https://join-social.com/privacy`
- [ ] Create **support** page/email at `https://join-social.com/support` (or `support@join-social.com`)
- [ ] Create Apple Developer account + App Store Connect app record (get Team ID + ASC App ID)
- [ ] Fill `eas.json` submit section with real `appleId`, `ascAppId`, `appleTeamId`

### Phase 5 — Build, test, submit

- [ ] `eas build -p ios --profile production` → first TestFlight build
- [ ] Real-device smoke test (auth, onboarding, contacts, events, password reset deep link, account deletion)
- [ ] App Store metadata: screenshots, description, keywords, privacy questionnaire, review notes
- [ ] Submit to TestFlight, then App Store review
- [ ] (Optional) Android/Play Store follow-up with the same backend
