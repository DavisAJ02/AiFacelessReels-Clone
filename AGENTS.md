# AGENTS.md

## Cursor Cloud specific instructions

### Architecture

- **Frontend**: React 19 + Vite + Tailwind CSS (port 5173)
- **Backend**: Express.js + Mongoose (port 3000)
- **Database**: MongoDB (auto-uses `mongodb-memory-server` in-memory when `MONGODB_URI` is unset)
- **Video pipeline**: FFmpeg (must be on `PATH`)

### Running the dev environment

```bash
npm run dev          # starts both backend and frontend via concurrently
```

- Backend: http://localhost:3000 (health check: `GET /health`)
- Frontend: http://localhost:5173 (Vite proxies `/api` and `/uploads` to backend)

### Environment file

Copy `app/server/.env.example` to `app/server/.env`. Clear `MONGODB_URI` to use in-memory MongoDB (no Docker needed). All external API keys (OpenAI, ElevenLabs, Pexels, Stripe, etc.) are optional — the app has placeholder/fallback behavior for each.

### Linting

```bash
npm run lint --prefix app/client    # ESLint for the React client
```

The server has no separate lint script.

### Building

```bash
npm run build --prefix app/client   # Vite production build
```

### Key API routes

All authenticated routes require `Authorization: Bearer <jwt>`. Registration: `POST /api/auth/register` with `{email, password, name}`. Script generation: `POST /api/script`. Full video generation: `POST /api/video` with `{niche, topic}`. Videos list: `GET /api/videos`.

### Gotchas

- The `punycode` deprecation warning from Node is expected and harmless.
- Video files are stored at `app/server/uploads/videos/` and served via the static middleware at `/api/uploads/`.
- Without Redis (`REDIS_URL` unset), video generation runs synchronously (inline) instead of via BullMQ worker queue. This is fine for development.
- The `mongodb-memory-server` downloads a MongoDB binary on first run; subsequent runs use the cached binary.
