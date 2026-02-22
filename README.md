# Blyss-API

FastAPI backend template for the Blyss flower app.

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
pyproject.toml
.env.example
```

## Quick Start

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

## First Endpoints

- `GET /`
- `GET /api/v1/health`

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
4. Set Build Command:
   - `pip install .`
5. Set Start Command:
   - `alembic -c app/database/alembic.ini upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`

Note:

- If your DB URL starts with `postgres://`, this project auto-normalizes it to SQLAlchemy's `postgresql+psycopg://`.
