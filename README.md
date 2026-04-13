# Langy

Repo lives in https://github.com/simonfrey/langy

## Prerequisites

- Docker
- Go 1.25+
- Node.js (with npm)

## Quick start

```bash
make dev
```

This starts PostgreSQL via Docker Compose, runs DB migrations, and launches both the Go backend and Vite frontend in parallel.

## Step-by-step setup

1. **Start PostgreSQL**

   ```bash
   docker compose up -d
   ```

2. **Run database migrations**

   ```bash
   make migrate
   ```

3. **Start the backend** (Go server on `:8080`)

   ```bash
   make dev-backend
   ```

4. **Start the frontend** (Vite dev server)

   ```bash
   cd frontend && npm install && npm run dev
   ```

## Environment variables

| Variable         | Default (dev)                                                 | Description                          |
| ---------------- | ------------------------------------------------------------- | ------------------------------------ |
| `DATABASE_URL`   | `postgres://langy:langy@localhost:5432/langy?sslmode=disable` | PostgreSQL connection string         |
| `JWT_SECRET`     | `dev-secret`                                                  | Secret for signing JWTs              |
| `GEMINI_API_KEY` | —                                                             | Optional; enables Gemini AI features |

## Other commands

- `make test` — run backend tests
- `make migrate-down` — roll back migrations
- `make build` — build Docker image
