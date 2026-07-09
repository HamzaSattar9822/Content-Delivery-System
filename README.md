# Content Delivery System (CDS)

A production-ready platform for distributing videos and other digital content through secure, client-specific links. Content stays in Google Drive; CDS manages **delivery, access control, analytics, notifications and security**.

The architecture is generic (CMS-ready) — videos, PDFs, DOCX, PPTX, images, audio and ZIP are all first-class content types.

## Features

- **Secure delivery links** with cryptographically random tokens (only the SHA-256 hash is stored).
- **Access enforcement engine**: expiration (date/time or never), max views, max sessions, max devices, max concurrent users, optional password, IP allowlist and domain allowlist.
- **Embed codes**: each delivery link returns a unique iframe embed snippet plus the watch URL — paste into any course site for in-page playback with full CDS player controls. Optional domain allowlist locks embeds to approved hostnames.
- **RBAC**: `SUPER_ADMIN`, `CONTENT_MANAGER`, `READ_ONLY`, enforced by permission middleware.
- **Google integration**: Google OAuth login + Google Drive browsing/metadata sync.
- **Analytics**: views, unique/repeat viewers, sessions, watch duration, completion rate, device/browser/country breakdowns.
- **Notifications**: configurable view-threshold alerts plus link-expired, view-limit-exceeded and security-event emails over SMTP.
- **Audit logging** of all significant actions, with a searchable UI.
- **Reporting**: CSV, Excel (XLSX) and PDF exports.
- **Dockerised** deployment with PostgreSQL, Prisma migrations and seed data.

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Auth | Google OAuth + JWT (HTTP-only cookies) |
| Storage | Google Drive API |
| Email | SMTP (nodemailer) |
| Deploy | Docker + Docker Compose |

## Architecture

Clean architecture with clear separation of concerns and a dependency-injection composition root (`backend/src/container.ts`):

```
Controllers  -> HTTP layer (request/response only)
Services     -> business logic (access enforcement, analytics, notifications...)
Repositories -> data access (Prisma)
Middleware   -> auth, RBAC, validation, error handling
Validation   -> Zod schemas
DB layer     -> Prisma client + schema/migrations
```

```
.
├── backend/        Express API (clean architecture)
│   ├── prisma/     schema, migrations, seed
│   └── src/        config, controllers, services, repositories, middleware, routes, utils
├── frontend/       Next.js dashboard + public watch page
├── docs/API.md     full API reference
└── docker-compose.yml
```

## Quick start (Docker)

```bash
cp .env.example .env
# Edit .env: set strong JWT/LINK secrets, Google credentials, SMTP, and
# BOOTSTRAP_SUPER_ADMIN_EMAIL (the first Google login matching it becomes super admin).

docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- The backend container runs `prisma migrate deploy` on start.

### Seed the database

```bash
docker compose exec backend npx prisma db seed
```

This creates roles + permissions, the bootstrap super admin, default view-threshold rules (100/250/500/1000), a sample category/content/link and baseline settings.

## Local development

Requirements: Node 20+, a PostgreSQL instance.

```bash
# Install all workspaces
npm install

# Backend
cp .env.example backend/.env   # or export the vars
cd backend
npx prisma migrate deploy      # or: npx prisma migrate dev
npm run seed
npm run dev                    # http://localhost:4000

# Frontend (new terminal)
cd frontend
NEXT_PUBLIC_API_URL=http://localhost:4000 npm run dev   # http://localhost:3000
```

When Google OAuth is not configured, a development email login is available on the login page (disabled automatically in production).

## Configuration

See `.env.example` for the full list. Key variables:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string. |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | JWT signing secrets. |
| `LINK_SIGNING_SECRET` | HMAC secret for signed stream grants. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_OAUTH_REDIRECT_URI` | Google OAuth login. |
| `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64` **or** `GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN` | Drive access for the dedicated Drive account. |
| `SMTP_*` / `ALERT_DEFAULT_RECIPIENT` | Email notifications. |
| `BOOTSTRAP_SUPER_ADMIN_EMAIL` | First login with this email is granted `SUPER_ADMIN`. |
| `COOKIE_SECURE` | `true` in production (HTTPS). |

### Google Drive setup

The client owns a dedicated Drive account. Either:

1. **Service account (recommended):** create a service account, share the Drive folder(s) with its email, download the JSON key and set `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64=$(base64 -w0 key.json)`.
2. **OAuth refresh token:** obtain a refresh token for the Drive account and set `GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN`.

## Testing

```bash
cd backend && npm test
```

Covers the access-enforcement engine (expiration, view/device/session/concurrency limits, password, IP/domain allowlists), notification thresholds, token/grant cryptography, RBAC mapping, pagination and the API surface (auth, validation, error handling).

### Embed handoff

1. Create a delivery link for the video in **Links → Create**.
2. Set **Domain allowlist** to the site's hostname (e.g. `courses.example.com`) if you want playback restricted to that site.
3. Copy the **embed code** (iframe HTML) from the success screen and send it to the recipient.
4. Paste the embed code into the course page or website — the video plays in-page with CDS player controls.
5. The **watch URL** is for direct browser access; the embed URL uses `?embed=1` for a player-only view inside iframes.

Production embeds require HTTPS on your deployed frontend (`FRONTEND_URL`).

## Production deployment (VPS)

1. Provision a VPS with Docker + a domain pointing to it.
2. Put the frontend/backend behind a reverse proxy (e.g. nginx) terminating TLS.
3. Set `COOKIE_SECURE=true`, real `CORS_ORIGINS`, `APP_URL`/`FRONTEND_URL` to your HTTPS domains, and the production secrets.
4. `docker compose up -d --build`, then seed once.

## Security notes

- Raw Drive URLs are never returned to clients — all access flows through the signed streaming proxy.
- Link tokens are random 256-bit values; only their SHA-256 hash is persisted.
- Stream grants are short-lived HMAC-signed tokens tied to a session.
- All denied access attempts and security-relevant events are audit-logged and can trigger email alerts.
- A background scheduler expires overdue links and emits expiry notifications.
