# Blyss Monorepo

Monorepo for Blyss services and clients.

## Tech Baseline

- Python 3.11+
- FastAPI
- PostgreSQL
- SQLAlchemy 2.x
- Alembic
- Uvicorn
- Pytest + Ruff (dev)

## Project Structure

```
apps/
  mobile/                 # React Native + Expo app
app/
  api/
    client/
    router/
      v1/
        health.py
      api.py
    service/
  database/
    alembic/
      versions/
      env.py
    models/
      user.py
    base.py
    session.py
    setup.py
    alembic.ini
  config.py
  main.py
tests/
packages/
  shared/                 # Shared TypeScript types/constants
package.json              # npm workspaces config
pyproject.toml
.env.example
```

## Quick Start (Backend API)

1. Create and activate a virtual environment.
2. Install dependencies:

```bash
pip install -e '.[dev]'
```

3. Copy env template:

```bash
cp .env.example .env
```

4. Run DB migrations:

```bash
alembic -c app/database/alembic.ini upgrade head
```

5. Run the API:

```bash
python -m uvicorn app.main:app --reload --port 9001
```

6. Run tests:

```bash
pytest
```

## Quick Start (Mobile App - Expo)

1. Install Node.js `20+`.
2. Install workspace dependencies from repo root:

```bash
npm install
```

3. Start Expo dev server:

```bash
npm run mobile:start
```

Environment variable (recommended):

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

- `EXPO_PUBLIC_API_BASE_URL` controls the backend URL used by the mobile app.
- Typical values:
  - iOS Simulator: `http://127.0.0.1:9001`
  - Android Emulator: `http://10.0.2.2:9001`
  - Physical device: `http://<your-laptop-lan-ip>:9001`

Optional:

```bash
npm run mobile:android
npm run mobile:ios
npm run mobile:web
npm run mobile:test
```

Note:

- The starter mobile flow supports OTP sign-in:
  - `POST /api/v1/auth/request-otp`
  - `POST /api/v1/auth/verify-otp`
  - `POST /api/v1/auth/refresh`
  - `GET /api/v1/me`
  - `GET /api/v1/flowers/{flower_id}` (owner detail + delivery metadata)
- Navigation uses separate Auth/App stacks (`@react-navigation/native` + native stack):
  - Auth: `RequestOtp`, `VerifyOtp`
  - App: `FlowersList`, `CreateFlower`, `FlowerDetail`, `Profile`
- Auth/session state is centralized in `apps/mobile/src/auth/AuthContext.tsx`.
- Flower list/create state is centralized in `apps/mobile/src/flowers/FlowersContext.tsx`.
- Flower creation is optimistic and flower list supports pull-to-refresh.
- Flower detail supports:
  - watering (`POST /api/v1/flowers/{flower_id}/water`)
  - instant sending (`POST /api/v1/flowers/{flower_id}/send`)
- Flower detail now includes local persistent share-token history and copy action.
- Flower detail now shows delivery status, recipient info, and a simple created/sent timeline row.
- Tokens are stored with Expo SecureStore.
- On app startup, the client auto-refreshes expired access tokens using the stored refresh token.
- Global banner surfaces status/errors across screens.
- Lightweight analytics logs are emitted in mobile (`apps/mobile/src/lib/analytics.ts`) and API route logs (`app/api/router/v1/*`).
- User-facing error mapping for common API failures (401/409/422/429) is centralized in `apps/mobile/src/lib/errorMessages.ts`.

Shared package tests:

```bash
npm run shared:test
```

CI:

- GitHub Actions workflow at `.github/workflows/ci.yml` runs:
  - backend tests
  - shared/mobile typechecks
  - shared/mobile tests

## First Endpoints

- `GET /`
- `GET /api/v1/health`
- `POST /api/v1/auth/request-otp` (rate limited)
- `POST /api/v1/auth/verify-otp`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/me` (requires `Authorization: Bearer <access_token>`)

## Database Basics (Beginner Friendly)

- `SQLAlchemy` is how Python code talks to PostgreSQL.
- `Alembic` tracks schema changes (tables/columns) in versioned migration files.
- First migration file is:
  - `app/database/alembic/versions/20260222_0001_create_users_table.py`

Useful commands:

```bash
# Apply all migrations
alembic -c app/database/alembic.ini upgrade head

# Create a new migration from model changes
alembic -c app/database/alembic.ini revision --autogenerate -m "describe change"

# Roll back one migration
alembic -c app/database/alembic.ini downgrade -1
```

## Render Deployment Notes

### Option A: One-click-ish with `render.yaml` (recommended)

This repo includes `/Users/salamhaider/26projects/blyss/Blyss-API/render.yaml` that defines:

- a managed Postgres database (`blyss-db`)
- a web service (`blyss-api`)
- `DATABASE_URL` wired from that database
- migration + API startup command

Steps:

1. Push this repo to GitHub.
2. In Render, choose Blueprint deploy and select this repo.
3. Render will create both services and connect env vars.
4. After deploy, open:
   - `https://<your-render-url>/api/v1/health`

### Option B: Manual setup in Render dashboard

1. Create PostgreSQL service in Render.
2. Create Web Service from this repo.
3. Set Web Service environment variables:
   - `DATABASE_URL` = Postgres internal connection string
   - `ENVIRONMENT` = `production`
   - `APP_NAME` = `Blyss API`
   - `API_V1_PREFIX` = `/api/v1`
   - `SQLALCHEMY_ECHO` = `false`
   - `AUTH_JWT_SECRET` = long random secret
   - `AUTH_OTP_SECRET` = long random secret
   - `RESEND_API_KEY` = your Resend API key
   - `EMAIL_FROM` = verified sender, e.g. `Blyss <auth@your-domain.com>`
4. Set Build Command:
   - `pip install .`
5. Set Start Command:
   - `alembic -c app/database/alembic.ini upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`

Note:

- If your DB URL starts with `postgres://`, this project auto-normalizes it to SQLAlchemy's `postgresql+psycopg://`.

## Basic Security (Current)

- CORS allowlist via `CORS_ALLOWED_ORIGINS` (comma-separated origins)
- OTP-based email login (`/api/v1/auth/request-otp` + `/api/v1/auth/verify-otp`)
- JWT access/refresh tokens for protected endpoints
- In-memory fixed-window rate limit on `/api/v1/auth/*` and `/api/v1/upload/*`

Production env vars to set:

- `CORS_ALLOWED_ORIGINS`: your app domains (comma-separated)
- `RATE_LIMIT_WINDOW_SECONDS`: default `60`
- `RATE_LIMIT_AUTH_REQUESTS_PER_WINDOW`: default `30`
- `AUTH_JWT_SECRET`: long random secret for signing JWTs
- `AUTH_OTP_SECRET`: long random secret for hashing OTPs
- `RESEND_API_KEY`: API key for sending OTP emails via Resend
- `EMAIL_FROM`: verified sender address used by Resend
