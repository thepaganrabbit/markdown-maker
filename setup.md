# Doc-u-maker Setup Guide

This guide documents how to recreate the app from a fresh Next.js project to the current product state.

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
npm install mongodb bcryptjs bootstrap sass
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
JWT_ACCESS_SECRET=replace-with-a-long-random-string
JWT_REFRESH_SECRET=replace-with-a-different-long-random-string
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=30
```

Copy it for local runtime:

```bash
cp .env.example .env.local
```

## 5. Add MongoDB Docker setup

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

## 6. Configure global layout and styles

### `app/layout.tsx`
- Import `@/styles/globals.scss`
- Set metadata title/description
- Render children inside `<body>`

### `styles/globals.scss`
- Import Bootstrap SCSS:
  - `@import 'bootstrap/scss/bootstrap';`
- Add app theme variables and custom UI styles for:
  - auth card/pages
  - workspace cards
  - drag/drop canvas and grid rows
  - draggable canvas items
  - table editor controls
  - markdown preview panel
  - saved document list

## 7. Create app pages

Create these route files:
- `app/page.tsx` → home shell rendering `HomeClient`
- `app/login/page.tsx` → renders `AuthForm mode="login"`
- `app/signup/page.tsx` → renders `AuthForm mode="signup"`
- `app/users/page.tsx` → renders `UserWorkspace`

## 8. Add shared backend libraries

### `lib/mongodb.ts`
- Create reusable MongoDB connection helper (`getDb`)
- Use global promise caching in development
- Throw if `MONGODB_URI` is missing

### `lib/models.ts`
Define TypeScript models:
- `User`
- `Session`
- `MarkdownDoc`

### `lib/auth.ts`
Implement:
- custom HS256 JWT signing/verification using Node `crypto`
- access + refresh token creation
- access + refresh token verification
- bcrypt password hashing/comparison
- refresh cookie options
- refresh expiry date helper

### `lib/authCookies.ts`
- Access-token cookie options (`HttpOnly`, `sameSite=lax`, `maxAge=15m`)

### `lib/session.ts`
Session storage helpers in `sessions` collection:
- `createSession`
- `findSession`
- `replaceSession`
- `deleteSession`

### `lib/requestAuth.ts`
- Resolve access token from bearer header or `accessToken` cookie
- Verify token and return payload

### `lib/authEdge.ts`
- Edge-compatible access-token verification using `crypto.subtle`
- Used by middleware

## 9. Add auth API routes

Create these files:
- `app/api/auth/signup/route.ts`
- `app/api/auth/login/route.ts`
- `app/api/auth/refresh/route.ts`
- `app/api/auth/logout/route.ts`
- `app/api/auth/me/route.ts`

Behavior:
- Signup:
  - validate email/password (min password length 6)
  - reject duplicate email
  - hash password
  - create user
  - mint access + refresh JWTs
  - store refresh session
  - set `refreshToken` and `accessToken` HttpOnly cookies
- Login:
  - verify credentials
  - create tokens + session
  - set cookies
- Refresh:
  - verify refresh token
  - verify active session + expiration
  - rotate refresh token
  - issue new access token
  - set updated cookies
- Logout:
  - delete session
  - clear both cookies
- Me:
  - read bearer/cookie token
  - verify access token
  - return current user

## 10. Add docs API routes (CRUD)

Create:
- `app/api/docs/route.ts`
- `app/api/docs/[id]/route.ts`

Behavior:
- All endpoints require authenticated user via `getUserFromRequest`
- Collection: `markdown_docs`
- `GET /api/docs`: list user docs sorted by `updatedAt` desc
- `POST /api/docs`: create doc with `title`, `content`, timestamps
- `GET /api/docs/:id`: fetch one doc owned by user
- `PUT /api/docs/:id`: update title/content and `updatedAt`
- `DELETE /api/docs/:id`: delete owned doc
- Validate `ObjectId` for `:id` routes

## 11. Add route protection middleware

Create `middleware.ts`:
- Match `/users/:path*`
- Read `accessToken` cookie
- Verify using `verifyAccessTokenEdge`
- Redirect unauthenticated users to `/login?next=/users...`

## 12. Build client components

### `app/components/AuthForm.tsx`
- Reusable login/signup form
- Posts to `/api/auth/login` or `/api/auth/signup`
- Stores returned `accessToken` and `userEmail` in localStorage
- Redirects to `next` query param or `/users`

### `app/components/HomeClient.tsx`
- On load, call `/api/auth/me`
- If unauthorized, call `/api/auth/refresh`
- Maintain local logged-in state
- Show `Open Workspace` + `Logout` when authenticated
- Show login/signup buttons when unauthenticated

### `app/components/users/UserWorkspace.tsx`
- Main protected canvas editor
- Element types:
  - heading
  - text
  - horizontal line
  - table
- Drag from toolbox into row-based canvas
- Drag existing items to reorder/swap rows
- Render markdown preview from canvas state
- Support markdown parsing back into canvas (`fromMarkdown`)
- Table editing:
  - editable headers/cells
  - resize columns (1-8)
  - resize rows (1-10)
- Document operations:
  - create doc
  - update selected doc
  - load doc from list
  - delete doc
- Auth retry logic:
  - `authFetch` refreshes session on 401 and retries
- Draft persistence:
  - localStorage key: `doc-u-maker:workspace-draft:v1`
  - manual Save Progress
  - auto-save every 60 seconds
  - draft restore on load

## 13. Verify TypeScript/Next config

Keep project-level files aligned with App Router + TS:
- `tsconfig.json` with `"@/*": ["./*"]`
- `next.config.mjs` minimal default config is fine
- `next-env.d.ts` generated by Next.js

## 14. Run the app

```bash
docker compose up -d
npm install
npm run dev
```

Open `http://localhost:3000`.

## 15. End-to-end smoke test checklist

1. Create account at `/signup`.
2. Confirm redirect to `/users`.
3. Add heading/text/line/table blocks and edit content.
4. Save new markdown doc.
5. Reload app and verify docs list loads.
6. Load saved doc and confirm canvas rehydrates.
7. Update and delete doc.
8. Logout and verify `/users` redirects to `/login`.
9. Re-login and confirm access is restored.

## 16. Current route inventory

Pages:
- `/`
- `/login`
- `/signup`
- `/users`

Auth API:
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Docs API:
- `GET /api/docs`
- `POST /api/docs`
- `GET /api/docs/:id`
- `PUT /api/docs/:id`
- `DELETE /api/docs/:id`

## 17. Notes on production hardening

To ship beyond local/dev usage, add:
- stronger JWT secret management via deployment secrets
- rate limiting on auth endpoints
- input schema validation (e.g. zod)
- CSRF strategy for cookie-authenticated mutation routes
- indexes for `users.email`, `sessions.refreshToken`, `markdown_docs.userId + updatedAt`
- optional refresh token hashing in DB
