# Doc-u-maker

Next.js app with MongoDB (Docker), Bootstrap + SCSS, JWT auth, and a protected markdown canvas workspace.

## Run MongoDB (Docker)

```bash
docker compose up -d
```

## App Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Auth and Protection

- `users` collection stores account records.
- `sessions` collection stores refresh-token sessions.
- Access token and refresh token are set in HttpOnly cookies.
- `/users` is protected by middleware and redirects to `/login` when unauthenticated.

## Markdown Workspace

- Go to `/users` after login.
- Drag and drop `Main heading`, `Text block`, and `Horizontal line` elements into the canvas.
- Canvas rows snap to a grid and stack by row occupancy.
- Exported markdown is saved to MongoDB with create/read/update/delete support.

## Routes

- `/` Home page
- `/login` Login page
- `/signup` Signup page
- `/users` Protected user workspace
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/docs`
- `POST /api/docs`
- `GET /api/docs/:id`
- `PUT /api/docs/:id`
- `DELETE /api/docs/:id`
