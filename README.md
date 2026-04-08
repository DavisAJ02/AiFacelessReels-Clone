# Hermiora AI

Faceless vertical video SaaS: script (OpenAI), voice (ElevenLabs), scenes (DALL·E / Pexels / placeholder), FFmpeg render, optional auto-post and Stripe billing.

## Run locally

```bash
npm install
# Optional: copy app/server/.env.example to app/server/.env and set keys.
# Without MONGODB_URI, the server uses an in-memory MongoDB in development.
npm run dev
```

- Frontend: http://localhost:5173 (proxies `/api` and `/uploads` to the server)
- API: http://localhost:3000

Requires **FFmpeg** on `PATH` for video output.

Optional: set `REDIS_URL` (e.g. `redis://127.0.0.1:6379`) to process video generation in a **BullMQ** background queue (`docker compose up -d redis`).
