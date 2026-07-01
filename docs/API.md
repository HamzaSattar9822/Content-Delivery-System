# Content Delivery System — API Reference

Base URL: `http://<host>:4000/api/v1`

## Conventions

- All responses are JSON with the envelope `{ "success": boolean, "data"?: T, "error"?: { code, message, details } }`.
- Authentication uses an HTTP-only access-token cookie (`cds_access_token`) set on login, or an `Authorization: Bearer <token>` header.
- A refresh-token cookie (`cds_refresh_token`) is used to silently renew the access token via `POST /auth/refresh`.
- List endpoints accept pagination/sort query params: `page`, `pageSize` (max 100), `search`, `sortBy`, `sortDir` (`asc`|`desc`).
- Paginated responses: `{ data: T[], pagination: { page, pageSize, total, totalPages } }`.

## Roles & permissions

| Role | Permissions |
|------|-------------|
| `SUPER_ADMIN` | all |
| `CONTENT_MANAGER` | content:*, link:*, drive:browse, analytics:view, report:export, notification:* |
| `READ_ONLY` | content:view, link:view, analytics:view, report:export, notification:view, audit:view |

Permission keys: `user:view`, `user:manage`, `content:view`, `content:manage`, `link:view`, `link:manage`, `drive:browse`, `analytics:view`, `report:export`, `notification:view`, `notification:manage`, `audit:view`, `settings:view`, `settings:manage`.

---

## Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/auth/config` | none | Which providers are configured. |
| GET | `/auth/google` | none | Returns the Google OAuth consent URL. |
| GET | `/auth/google/callback?code=` | none | OAuth callback; sets cookies and redirects to the dashboard. |
| POST | `/auth/dev-login` | none (non-prod) | Local login. Body: `{ email }`. |
| POST | `/auth/refresh` | refresh cookie | Rotates tokens. |
| POST | `/auth/logout` | cookie | Revokes the refresh token. |
| GET | `/auth/me` | required | Current user + permissions. |

## Content (`content:view` / `content:manage`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/content` | List/search/filter. Query: `search,status,fileType,categoryId,tag,sortBy,sortDir`. |
| GET | `/content/:id` | Get one. |
| POST | `/content` | Create. Body: `{ title, googleDriveFileId, description?, categoryId?, fileType?, tags?, syncFromDrive? }`. |
| PATCH | `/content/:id` | Update. |
| POST | `/content/:id/archive` | Archive. |
| POST | `/content/:id/restore` | Restore. |
| DELETE | `/content/:id` | Delete. |
| GET | `/content/categories` | List categories. |
| POST | `/content/categories` | Create category. |
| PATCH/DELETE | `/content/categories/:id` | Update/delete. |
| GET | `/content/tags` | List tags. |

## Google Drive (`drive:browse`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/drive/status` | Whether Drive is configured. |
| GET | `/drive/files?folderId=` | Browse a folder. |
| GET | `/drive/files/:fileId` | File metadata. |

## Delivery links (`link:view` / `link:manage`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/links` | List links. |
| GET | `/links/:id` | Get one. |
| POST | `/links` | Create. Returns the raw token **once**. Body: `{ contentId, label?, neverExpire?, expiresAt?, maxViews?, maxSessions?, maxDevices?, maxConcurrent?, password?, ipAllowlist?, domainAllowlist? }`. |
| PATCH | `/links/:id` | Update controls. |
| POST | `/links/:id/disable` | Disable. |
| POST | `/links/:id/enable` | Enable. |
| POST | `/links/:id/revoke` | Revoke (permanent). |
| POST | `/links/:id/extend` | Body `{ expiresAt }`. |
| POST | `/links/:id/increase-views` | Body `{ maxViews }` (null = unlimited). |
| DELETE | `/links/:id` | Delete. |

## Public delivery (no auth, rate-limited)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/public/links/:token` | Resolve metadata (does not consume a view). |
| POST | `/public/links/:token/access` | Enforce controls, record a view, return a signed `streamUrl` + `sessionKey`. Body `{ password? }`. |
| GET | `/public/stream?grant=` | Streaming proxy with HTTP `Range` support. Google Drive URLs are never exposed. |
| POST | `/public/links/:token/heartbeat` | Body `{ sessionKey, watchSeconds?, completed? }`. |
| POST | `/public/links/:token/end` | Body `{ sessionKey }`. |

Access-denied codes: `LINK_REVOKED`, `LINK_DISABLED`, `LINK_EXPIRED`, `PASSWORD_REQUIRED`, `IP_NOT_ALLOWED`, `DOMAIN_NOT_ALLOWED`, `VIEW_LIMIT_REACHED`, `DEVICE_LIMIT_REACHED`, `SESSION_LIMIT_REACHED`, `CONCURRENCY_LIMIT_REACHED`, `GRANT_INVALID`.

## Analytics (`analytics:view`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/analytics/dashboard` | Dashboard metrics. |
| GET | `/analytics/detailed?linkId=&contentId=&from=&to=` | Detailed metrics. |
| GET | `/analytics/timeseries?days=30` | Daily view counts. |

## Users (`user:view` / `user:manage`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/users` | List users. |
| GET | `/users/roles` | List roles + permissions. |
| GET | `/users/:id` | Get one. |
| POST | `/users` | Body `{ email, name?, roleName }`. |
| PATCH | `/users/:id` | Body `{ name?, roleName?, status? }`. |
| DELETE | `/users/:id` | Delete. |

## Notifications (`notification:view` / `notification:manage`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/notifications` | History. |
| GET | `/notifications/rules` | List alert rules. |
| POST | `/notifications/rules` | Body `{ type, threshold?, linkId?, recipient?, enabled? }`. |
| PATCH | `/notifications/rules/:id` | Update. |
| DELETE | `/notifications/rules/:id` | Delete. |

## Audit logs (`audit:view`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/audit-logs?search=&action=&userId=&entityType=&from=&to=` | Searchable audit trail. |

## Reports (`report:export`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/reports/:type?format=csv\|xlsx\|pdf` | `type` ∈ `content-usage`, `link-usage`, `viewer-activity`, `security-events`, `expired-links`. |

## Settings (`settings:view` / `settings:manage`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/settings` | List settings. |
| GET | `/settings/:key` | Get one. |
| PUT | `/settings/:key` | Body `{ value, description? }`. |

## Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness probe (no `/api/v1` prefix). |
