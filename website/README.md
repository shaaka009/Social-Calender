# join-social.com website

Static site for Cloudflare Pages: landing, privacy, terms, support, and
deep-link `.well-known` files.

## Deploy (Cloudflare Pages)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git** (this repo) **or** **Upload assets**.
2. If Git-connected:
   - Project name: `join-social`
   - Production branch: your main/working branch
   - **Build command:** leave empty
   - **Build output directory:** `website`
3. After the first deploy succeeds: **Custom domains** → add `join-social.com`
   and `www.join-social.com` (Cloudflare will offer to create DNS records).
4. In DNS for `join-social.com`, ensure:
   - Apex / `www` point at the Pages project (Cloudflare usually sets these)
   - Do **not** put the API on this project — `api` is a separate CNAME to Render

## Apple App Site Association

`/.well-known/apple-app-site-association` currently has placeholder `TEAMID`.
Replace `TEAMID` with your Apple Team ID before Universal Links will verify
(after you have an Apple Developer account). Custom scheme
`socialcalendar://` still works without this.

## Local preview

```bash
npx --yes serve website
```
