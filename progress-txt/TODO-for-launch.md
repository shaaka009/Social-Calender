# TODO for MVP Launch (App Store / TestFlight)

This file is a **single source of truth** for what's left before shipping an MVP, based on an audit of the repo (frontend Expo + backend Django) and the gaps we identified.

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

---

## Still to do (before first TestFlight)

### Infrastructure / deployment

- [ ] **Set up Render** (or chosen host) for Django
  - [ ] Create Render Web Service + Render Postgres
  - [ ] Set env vars: `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=False`, `DJANGO_ALLOWED_HOSTS`, `DATABASE_URL` (auto-set by Render), `CORS_ALLOWED_ORIGINS`, `FRONTEND_BASE_URL`
  - [ ] Configure email env vars (`EMAIL_HOST`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`)
  - [ ] Run `python manage.py migrate` and `python manage.py collectstatic`
- [ ] **Set `EXPO_PUBLIC_API_URL`** in `.env` to point at the Render deployment URL
- [ ] **Media storage** — decide on Render persistent disk vs S3 for profile pictures

### Deep link setup (for password reset emails opening the app)

- [ ] Choose + register domain (e.g. `app.socialcalendar.com`)
- [ ] Host `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json`
- [ ] Add `associatedDomains` to `app.json` `ios` section
- [ ] Add `intentFilters` to `app.json` `android` section
- [ ] Set `FRONTEND_BASE_URL` env var to `https://app.socialcalendar.com`

### Privacy / legal

- [ ] **Privacy policy** — write and host at a URL
- [ ] **Support URL** — create a support page or email address
- [ ] Fill in `eas.json` submit section with real Apple credentials (`appleId`, `ascAppId`, `appleTeamId`)

### Build & submission

- [ ] Create Apple Developer account + App Store Connect app record
- [ ] Update `app.json` bundle identifier if different from `com.socialcalendar.app`
- [ ] `eas build -p ios` → first TestFlight build
- [ ] Real-device smoke test
- [ ] App Store submission metadata: screenshots, description, keywords, privacy questionnaire, review notes
