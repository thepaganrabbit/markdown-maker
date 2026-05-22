# Doc-u-maker Setup Guide

This guide documents how to recreate the app and configure authentication in three deployment modes:
- `jwt` only
- `oauth2` only
- `both` (JWT + OAuth2)

## 1. Create the Next.js app

```bash
npx create-next-app@latest doc-u-maker --typescript --app --eslint --src-dir false --import-alias "@/*"
cd doc-u-maker
```

Target stack used in this project:
- Next.js `14.2.5`
- React `18.3.1`
- TypeScript
- App Router

## 2. Install dependencies

```bash
npm install mongodb bcryptjs bootstrap sass zod
npm install -D @types/node @types/react @types/react-dom typescript
```

## 3. Add scripts and package config

Ensure `package.json` has:

```json
{
  "name": "doc-u-maker",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```

## 4. Add environment variables

Create `.env.example`:

```env
MONGODB_URI=mongodb://root:root@localhost:27021/documaker?authSource=admin
JWT_ACCESS_SECRET=replace-with-a-long-random-string-at-least-32-bytes
JWT_REFRESH_SECRET=replace-with-a-different-long-random-string-at-least-32-bytes
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=30

AUTH_MODE=both
HASH_REFRESH_TOKENS=false

OAUTH2_AUTHORIZATION_ENDPOINT=
OAUTH2_TOKEN_ENDPOINT=
OAUTH2_USERINFO_ENDPOINT=
OAUTH2_CLIENT_ID=
OAUTH2_CLIENT_SECRET=
OAUTH2_CALLBACK_URL=http://localhost:3000/api/auth/oauth2/callback
OAUTH2_SCOPE=openid email profile
```

Copy it for local runtime:

```bash
cp .env.example .env.local
```

## 5. Secret management in deployment

Use your deployment platform’s encrypted secret store (for example: Vercel Environment Variables, GitHub Actions Secrets, Render Secrets, Kubernetes Secrets).

Required secrets:
- `MONGODB_URI`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`

Rules:
- In production, `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` must be at least 32 bytes.
- Never commit real secrets to git.
- Rotate JWT secrets with a rollout window and force refresh/logout when needed.

Generate strong secrets:

```bash
openssl rand -base64 48
```

## 6. Configure JWT vs OAuth2 modes

### Mode A: JWT only

Use this when you want app-native signup/login with email+password.

```env
AUTH_MODE=jwt
```

Behavior:
- `/api/auth/signup` and `/api/auth/login` enabled.
- OAuth2 routes return `403`.
- Access/refresh cookies are issued by local auth flow.

### Mode B: OAuth2 only

Use this when authentication is delegated to an external IdP.

```env
AUTH_MODE=oauth2
OAUTH2_AUTHORIZATION_ENDPOINT=https://idp.example.com/oauth2/authorize
OAUTH2_TOKEN_ENDPOINT=https://idp.example.com/oauth2/token
OAUTH2_USERINFO_ENDPOINT=https://idp.example.com/oauth2/userinfo
OAUTH2_CLIENT_ID=your-client-id
OAUTH2_CLIENT_SECRET=your-client-secret
OAUTH2_CALLBACK_URL=https://your-app.example.com/api/auth/oauth2/callback
OAUTH2_SCOPE=openid email profile
```

Behavior:
- `/api/auth/signup` and `/api/auth/login` return `403`.
- User starts login at `/api/auth/oauth2/login`.
- Callback route exchanges `code` at token endpoint.
- User profile is resolved from userinfo endpoint.
- App issues local access/refresh cookies and creates/updates local user record.

### Mode C: Both JWT and OAuth2

Use this when you want local login plus external IdP login.

```env
AUTH_MODE=both
# JWT vars required
# OAuth2 vars required if OAuth button/flow is used
```

Behavior:
- Local auth + OAuth2 auth are both available.
- UI login/signup form includes an OAuth2 button.

## 7. Add MongoDB Docker setup

Create `docker-compose.yml`:

```yaml
services:
  mongo:
    image: mongo:7
    container_name: documaker-mongo
    restart: unless-stopped
    ports:
      - "27021:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: root
      MONGO_INITDB_ROOT_PASSWORD: root
      MONGO_INITDB_DATABASE: documaker
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
```

Start Mongo:

```bash
docker compose up -d
```

## 8. Backend libraries and security modules

### `lib/env.ts`
- Centralized env loading and validation.
- Enforces strong JWT secrets in production.
- Controls auth mode via `AUTH_MODE`.

### `lib/mongodb.ts`
- Shared Mongo connection helper (`getDb`).
- Creates indexes on startup:
  - `users.email` unique
  - `sessions.refreshToken` unique sparse
  - `sessions.refreshTokenHash` unique sparse
  - `markdown_docs.userId + updatedAt(desc)`
- Bootstraps default admin user if missing:
  - email: `master@master.com`
  - password: `skittles123`
  - role: `admin`

### `lib/models.ts`
Defines:
- `User`
- `Session` (supports `refreshToken` or `refreshTokenHash`)
- `MarkdownDoc`

### `lib/auth.ts`
- HS256 JWT sign/verify.
- Access + refresh token issue/verify.
- Password hashing with `bcryptjs`.
- Cookie options + refresh expiry helper.

### `lib/session.ts`
- Session CRUD in `sessions` collection.
- Optional hashed refresh storage controlled by `HASH_REFRESH_TOKENS`.

### `lib/validation.ts`
- Zod schemas for auth and doc payloads.
- Shared JSON parse helper returning consistent `400` errors.

### `lib/security.ts`
- In-memory IP-based rate limiting helper.
- Applied to auth endpoints.

### `lib/csrf.ts`
- Double-submit CSRF strategy.
- Sets `csrfToken` cookie.
- Requires `x-csrf-token` header for cookie-authenticated mutation requests.

### `lib/theme.ts`
- Shared light/dark theme helpers:
  - read stored theme from localStorage
  - apply theme via `html[data-theme]`
  - save and persist theme choice
- Theme selection is user-driven from Settings and applies across admin/user screens.

### `lib/oauth2.ts`
- OAuth2 auth URL builder.
- State cookie management.
- Authorization-code token exchange.
- Userinfo fetch for user identity.

### `lib/requestAuth.ts`
- Resolves auth from bearer header or `accessToken` cookie.
- Accepts local JWT access tokens.
- If bearer JWT fails and OAuth2 is enabled, can resolve user via OAuth2 userinfo endpoint.

### `lib/authEdge.ts`
- Edge-safe access token verification for middleware.

## 9. Auth API routes

### Local JWT routes
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### OAuth2 routes
- `GET /api/auth/oauth2/login`
- `GET /api/auth/oauth2/callback`

Key behavior:
- Rate limiting on `signup`, `login`, `refresh`.
- Zod payload validation on auth JSON bodies.
- CSRF cookie is set on successful auth/refresh.
- Logout requires CSRF header when using cookie auth.
- OAuth2 callback verifies `state`, exchanges `code`, resolves user, creates local session cookies.

## 10. Docs API routes (CRUD)

- `GET /api/docs`
- `POST /api/docs`
- `GET /api/docs/:id`
- `PUT /api/docs/:id`
- `DELETE /api/docs/:id`

Security behavior:
- Auth required for all docs routes.
- Mutation routes (`POST`, `PUT`, `DELETE`) enforce CSRF for cookie-authenticated requests.
- Payload validation via Zod.
- `ObjectId` validation for `:id` routes.

## 11. Admin panel and admin APIs

Admin UI:
- `/admin` (protected page)
- Capabilities:
  - create users
  - update user role/email/password
  - delete users
  - see online/offline presence with a status dot (green/red)
  - search users by email (`q`)
  - filter users by role (`all|user|admin`)
  - sort users by `createdAt`, `email`, or `role` (`asc|desc`)
  - paginate users (`page`, `pageSize`)
  - force logout users (session invalidation)

Admin APIs (all require admin auth):
- `GET /api/admin/users`
  - query params:
    - `q` (email search)
    - `role` (`all`, `user`, `admin`)
    - `sortBy` (`createdAt`, `email`, `role`)
    - `sortDir` (`asc`, `desc`)
    - `page` (default `1`)
    - `pageSize` (default `10`, max `50`)
  - returns `users[]` plus `pagination` metadata
  - each user includes `isOnline`:
    - `true` when at least one non-expired session exists in `sessions`
    - `false` when no active session exists
- `POST /api/admin/users` (create user)
- `PUT /api/admin/users/:id` (update user)
- `DELETE /api/admin/users/:id` (delete user)
- `POST /api/admin/users/:id/force-logout`
  - deletes all `sessions` rows for that user
  - current access token remains valid until expiry; refresh is invalidated immediately

Safety rules implemented:
- Admin cannot delete self.
- Admin cannot demote current session’s own role from `admin` to `user`.
- Duplicate email conflicts return `409`.

## 12. Middleware protection

`middleware.ts` protects `/users/:path*`:
- Reads `accessToken` cookie.
- Verifies with `verifyAccessTokenEdge`.
- Redirects unauthenticated users to `/login`.
- `/admin/:path*` is also protected by the same middleware gate.
- `/settings/:path*` is also protected by the same middleware gate.

## 13. Frontend auth behavior

### `app/components/nav/AppNavbar.tsx`
- Global top navbar rendered in `app/layout.tsx`.
- For authenticated users, account actions are grouped in a far-right dropdown:
  - `Workspace`
  - `Admin` (admin role only)
  - `User Settings`
  - `Logout`
- For unauthenticated users, shows `Login` and `Sign up`.

### `app/components/AuthForm.tsx`
- Email/password login + signup form.
- OAuth2 login button linking to `/api/auth/oauth2/login`.

### `app/components/HomeClient.tsx`
- Loads user with `/api/auth/me`.
- Attempts `/api/auth/refresh` on 401.
- Sends CSRF header for logout mutation.

### `app/components/users/UserWorkspace.tsx`
- Uses `authFetch` wrapper.
- On non-GET mutations, sends `x-csrf-token` from `csrfToken` cookie.
- Refreshes session on 401 and retries once.
- Includes a Logout button that:
  - calls `POST /api/auth/logout` with CSRF header
  - clears local client auth storage keys
  - redirects to `/login`
- Markdown preview panel supports two modes:
  - code view (raw markdown text)
  - rendered view (true markdown rendering)
- Includes a toggle button under/with preview controls to switch modes.

### `app/components/admin/AdminPanel.tsx`
- Admin-only user management UI.
- Includes search, role filter, sort controls, page size selector, pagination controls.
- Includes sortable headers for Email, Role, and Created columns.
- Includes a Status column with:
  - green dot for online users
  - red dot for offline users
- Includes “Force Logout” action per user (session invalidation API).
- Includes an Admin Logout button that:
  - calls `POST /api/auth/logout` with CSRF header
  - clears local client auth storage keys
  - redirects to `/login`

### `app/components/settings/SettingsClient.tsx`
- User self-service settings page (`/settings`).
- Theme preferences:
  - toggles light/dark theme
  - persists in localStorage
  - applies globally to the app shell
- Account profile updates:
  - change email
  - change password (requires current password)
- Markdown file management:
  - list current files
  - rename title
  - delete file
- Uses CSRF header for mutation requests and auth refresh retry on `401`.

## 14. Refresh-token hashing option

`HASH_REFRESH_TOKENS` controls session storage shape:
- `false` (default): stores raw `refreshToken` in DB.
- `true`: stores `sha256(refreshToken)` in `refreshTokenHash`.

When enabled:
- Session lookup, rotation, and deletion are hash-based.
- Raw refresh token is not persisted.

## 15. Run the app

```bash
docker compose up -d
npm install
npm run dev
```

Open `http://localhost:3000`.

## 16. End-to-end test checklist

1. Configure `.env.local` for your chosen `AUTH_MODE`.
2. Start app and open `/`.
3. If `jwt` or `both`: test signup/login.
4. If `oauth2` or `both`: test OAuth2 login and callback.
5. Confirm redirect to `/users`.
6. Open navbar dropdown (far right) and verify links for `Workspace`, `User Settings`, and `Logout` (plus `Admin` for admins).
7. Create/update/delete docs and verify no CSRF failures.
8. Open `/settings` and verify:
   - light/dark theme toggle updates app appearance
   - email/password update flow
   - markdown rename/delete
9. Confirm logout clears session and `/users` redirects to `/login`.
10. Confirm rate limiting returns `429` after repeated auth calls.
11. Login with `master@master.com` / `skittles123` and open `/admin`.
12. Verify user search/filter/sort/pagination and force-logout actions.
13. Verify logout buttons on `/users` and `/admin` end session and redirect to `/login`.

## 17. Route inventory

Pages:
- `/`
- `/login`
- `/signup`
- `/users`
- `/settings`

Auth API:
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/auth/oauth2/login`
- `GET /api/auth/oauth2/callback`

Docs API:
- `GET /api/docs`
- `POST /api/docs`
- `GET /api/docs/:id`
- `PUT /api/docs/:id`
- `DELETE /api/docs/:id`

User Settings API:
- `GET /api/user/settings`
- `PATCH /api/user/settings`
- `GET /api/user/settings/docs`
- `PATCH /api/user/settings/docs/:id`
- `DELETE /api/user/settings/docs/:id`

Admin API:
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PUT /api/admin/users/:id`
- `DELETE /api/admin/users/:id`
- `POST /api/admin/users/:id/force-logout`

UI/UX features:
- Global navbar with right-aligned account dropdown.
- Light/dark theme toggle (in Settings) for both admins and normal users.
- Workspace markdown preview mode toggle: raw code vs rendered markdown.

## 18. Production notes

- In-memory rate limiting works for a single process only; for multi-instance deployments, move to a shared backend (Redis/Upstash/etc).
- Ensure OAuth2 callback URL exactly matches provider configuration.
- Run with HTTPS in production so secure cookies are always enforced.
- Keep JWT and OAuth2 client secrets in deployment secret storage only.

## 19. Provider-specific OAuth2 examples

Use these as templates for `.env.local` or deployment secrets.

### Auth0 example

Auth0 app setup:
- Application type: `Regular Web Application`
- Allowed Callback URLs: `http://localhost:3000/api/auth/oauth2/callback` (dev) and your prod callback URL
- OIDC Conformant should be enabled (default for new tenants)

```env
AUTH_MODE=oauth2
OAUTH2_AUTHORIZATION_ENDPOINT=https://YOUR_TENANT.auth0.com/authorize
OAUTH2_TOKEN_ENDPOINT=https://YOUR_TENANT.auth0.com/oauth/token
OAUTH2_USERINFO_ENDPOINT=https://YOUR_TENANT.auth0.com/userinfo
OAUTH2_CLIENT_ID=YOUR_AUTH0_CLIENT_ID
OAUTH2_CLIENT_SECRET=YOUR_AUTH0_CLIENT_SECRET
OAUTH2_CALLBACK_URL=http://localhost:3000/api/auth/oauth2/callback
OAUTH2_SCOPE=openid email profile
```

### Okta example

Okta app setup:
- App integration type: `OIDC - Web Application`
- Sign-in redirect URIs: `http://localhost:3000/api/auth/oauth2/callback` (dev) and your prod callback URL
- Use your Okta domain and Authorization Server (often `default`)

```env
AUTH_MODE=oauth2
OAUTH2_AUTHORIZATION_ENDPOINT=https://YOUR_OKTA_DOMAIN/oauth2/default/v1/authorize
OAUTH2_TOKEN_ENDPOINT=https://YOUR_OKTA_DOMAIN/oauth2/default/v1/token
OAUTH2_USERINFO_ENDPOINT=https://YOUR_OKTA_DOMAIN/oauth2/default/v1/userinfo
OAUTH2_CLIENT_ID=YOUR_OKTA_CLIENT_ID
OAUTH2_CLIENT_SECRET=YOUR_OKTA_CLIENT_SECRET
OAUTH2_CALLBACK_URL=http://localhost:3000/api/auth/oauth2/callback
OAUTH2_SCOPE=openid email profile
```

### Google example

Google Cloud setup:
- Create an OAuth client ID with application type `Web application`
- Authorized redirect URI: `http://localhost:3000/api/auth/oauth2/callback` (dev) and your prod callback URL
- Ensure your consent screen is configured for required test/prod users

```env
AUTH_MODE=oauth2
OAUTH2_AUTHORIZATION_ENDPOINT=https://accounts.google.com/o/oauth2/v2/auth
OAUTH2_TOKEN_ENDPOINT=https://oauth2.googleapis.com/token
OAUTH2_USERINFO_ENDPOINT=https://openidconnect.googleapis.com/v1/userinfo
OAUTH2_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
OAUTH2_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
OAUTH2_CALLBACK_URL=http://localhost:3000/api/auth/oauth2/callback
OAUTH2_SCOPE=openid email profile
```

### Callback and URI matching checklist (all providers)

1. The URI in provider config must exactly equal `OAUTH2_CALLBACK_URL` (scheme, host, path, trailing slash).
2. For local development, use `http://localhost:3000/api/auth/oauth2/callback`.
3. For production, use your HTTPS domain callback and update both provider config and deployment env.
4. If you see `invalid_redirect_uri` or `redirect_uri_mismatch`, verify exact string equality first.
