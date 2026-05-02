# HANSA — Web Deployment Guide

This guide covers shipping the HANSA app as a **production web app + PWA**.
Three artefacts ship in production:

1. **Frontend (static)** — Expo Router web build → static HTML/JS/CSS bundle in `dist/`. Host on any CDN/static host (Vercel, Netlify, Cloudflare Pages, S3, Nginx).
2. **Backend (FastAPI)** — needs Python + MongoDB. Host on Render, Railway, Fly.io, or your own VM/Docker.
3. **MongoDB** — managed via MongoDB Atlas (or self-hosted).

> The native iOS / Android Expo Go app is unaffected by web deployment.

---

## 1. Build the web bundle

```bash
cd /app/frontend
yarn install            # first time only
yarn build:web          # runs `expo export -p web` → outputs to /app/frontend/dist
```

The `dist/` folder is a fully-static site (~10–15 MB) — drop it into any
static host. It already includes:

- All routes pre-rendered as `*.html`
- The PWA service worker at `/sw.js` and manifest at `/manifest.json`
- App icons, splash, fonts, JS bundle

### Local preview

```bash
yarn serve:web          # serves dist/ on http://localhost:3000
```

> **Important:** the frontend reads `EXPO_PUBLIC_BACKEND_URL` **at build time**.
> Set it in `frontend/.env` *before* running `yarn build:web`. For example:
>
> ```
> EXPO_PUBLIC_BACKEND_URL=https://api.hansa.example.com
> ```
>
> If you change the backend host, you must rebuild. Frontend assets are
> immutable after `expo export`.

---

## 2. Deploy the static bundle

### Option A — **Vercel** (recommended, free tier)

1. Push this repo to GitHub.
2. New Project → import the repo → set the *Root Directory* to `frontend`.
3. Framework preset → **Other**.
4. Build command: `yarn build:web`
5. Output directory: `dist`
6. Environment variables: `EXPO_PUBLIC_BACKEND_URL=https://api.hansa.example.com`
7. Deploy. Custom domain → Settings → Domains.

### Option B — **Netlify**

```toml
# netlify.toml at /app/frontend
[build]
  command = "yarn build:web"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Option C — **Cloudflare Pages**

Build command: `yarn build:web` · Build output dir: `dist` · Same env var.

### Option D — **Self-hosted Nginx**

```nginx
server {
  listen 443 ssl http2;
  server_name app.hansa.example.com;

  root /var/www/hansa/dist;
  index index.html;

  # SPA fallback for client-side routing
  location / { try_files $uri $uri.html $uri/ /index.html; }

  # Cache the bundle aggressively, but never the HTML or service worker
  location ~* \.(js|css|woff2?|ttf|eot|png|jpe?g|svg|webp)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
  location = /sw.js          { expires 0; add_header Cache-Control "no-cache"; }
  location = /manifest.json  { expires 0; add_header Cache-Control "no-cache"; }
  location ~* \.html$         { expires 0; add_header Cache-Control "no-cache"; }
}
```

> 🔒 Service workers **only run over HTTPS** (or `localhost`). Make sure
> your domain has TLS — every modern host gives free Let's Encrypt certs.

---

## 3. Deploy the FastAPI backend

### Option A — **Render.com**

`render.yaml`:

```yaml
services:
  - type: web
    name: hansa-api
    runtime: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn server:app --host 0.0.0.0 --port $PORT
    rootDir: backend
    envVars:
      - key: MONGO_URL
        sync: false
      - key: DB_NAME
        sync: false
      - key: TWILIO_ACCOUNT_SID
        sync: false
      - key: TWILIO_AUTH_TOKEN
        sync: false
      - key: TWILIO_FROM
        sync: false
      - key: RAZORPAY_KEY_ID
        sync: false
      - key: RAZORPAY_KEY_SECRET
        sync: false
      - key: JWT_SECRET
        generateValue: true
```

### Option B — **Self-hosted Docker**

`backend/Dockerfile`:

```Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8001
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
```

```bash
cd /app/backend
docker build -t hansa-api .
docker run -d --name hansa-api -p 8001:8001 \
  --env-file .env \
  hansa-api
```

Put it behind Nginx with TLS:

```nginx
server {
  listen 443 ssl http2;
  server_name api.hansa.example.com;

  location /api/ {
    proxy_pass http://localhost:8001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 25M;   # for image / video uploads
  }
}
```

### Option C — **Single-host all-in-one** (Nginx + uvicorn + frontend dist)

Easiest setup if you already own a small VM. Run the FastAPI on `localhost:8001`,
serve `dist/` as the website root, and reverse-proxy `/api` to the backend.

```nginx
server {
  listen 443 ssl http2;
  server_name hansa.example.com;

  root /var/www/hansa/dist;
  location / { try_files $uri $uri.html $uri/ /index.html; }

  location /api/ {
    proxy_pass http://localhost:8001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    client_max_body_size 25M;
  }

  location = /sw.js          { expires 0; add_header Cache-Control "no-cache"; }
  location = /manifest.json  { expires 0; add_header Cache-Control "no-cache"; }
}
```

In this single-host setup you can leave `EXPO_PUBLIC_BACKEND_URL=""` or
unset (the frontend will use the same origin as the page) — confirm by
inspecting `src/api.ts` BASE resolution.

---

## 4. Backend `.env` for production

Required (re-use values from the dev `/app/backend/.env`):

```
MONGO_URL=mongodb+srv://USER:PASS@cluster.mongodb.net
DB_NAME=hansa_prod
JWT_SECRET=<random 64+ char string>

TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM=+1...

RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
```

> CORS is wide-open (`allow_origins=["*"]`) so any web origin can hit the API.
> Tighten to your specific frontend origin in `server.py` if needed for prod.

---

## 5. PWA verification

After deployment, open Chrome DevTools → **Application** → **Manifest** and confirm:

- [ ] Manifest loads (no 404)
- [ ] Theme color = `#F2A900`
- [ ] Service Worker registered & activated
- [ ] "Install" icon visible in the URL bar
- [ ] Lighthouse PWA score ≥ 90

On a phone (Chrome / Safari / Edge):

- Visit the deployed URL → "Add to Home Screen" works.
- Re-open the installed app → loads even with airplane mode (app shell from cache).

---

## 6. CI/CD outline (optional)

`.github/workflows/deploy.yml`:

```yaml
name: Deploy
on: { push: { branches: [main] } }
jobs:
  web:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: frontend } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: yarn install --frozen-lockfile
      - run: yarn build:web
        env:
          EXPO_PUBLIC_BACKEND_URL: ${{ secrets.EXPO_PUBLIC_BACKEND_URL }}
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: frontend
          vercel-args: '--prod'
```

For backend deployment, push to Render via webhook on the same workflow, or
use a separate Docker build + push job.

---

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| Service worker not registering | Must be HTTPS or localhost. Check DevTools → Application → SW. |
| Manifest 404 | Confirm `public/manifest.json` was copied to `dist/`. Check Nginx serves `.json` MIME type. |
| API CORS error in browser | Check the deployed backend URL is reachable from the frontend origin. Look at `Network` tab for OPTIONS pre-flight failures. |
| `Cannot find EXPO_PUBLIC_BACKEND_URL` | It is a build-time variable. You must set it in `.env` (or the host's env vars) BEFORE `yarn build:web`. |
| Old SW serving stale bundle | Bump `SW_VERSION` in `public/sw.js` and rebuild. Users get the new bundle on next visit. |
| Mobile Add to Home doesn't appear | Manifest must be valid + SW active + at least one large icon (≥192px) + start_url 200 OK. Run Lighthouse PWA audit. |

---

That's it — `yarn build:web` and you have a deployable web/PWA app. ☘️
