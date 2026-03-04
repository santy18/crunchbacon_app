# AGENTS.md

This file provides guidance for autonomous coding agents operating in this repository.
It covers project structure, build/test commands, and code style conventions for both backend and frontend.

## Project Overview

- `backend/` – FastAPI application, async SQLAlchemy, Pydantic models, ML/audio integrations.
- `frontend/` – React 18 + Vite SPA, React Router, ESLint (flat config).
- `requirements.txt` – Python dependencies.
- No formal test suite is currently present, but pytest is recommended for new tests.

---

## Backend (FastAPI)

### Environment Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

If adding dev tooling (e.g., pytest, black), install locally and document it here.

### Run Development Server

From `backend/` directory:

```bash
python run.py
```

Equivalent explicit command:

```bash
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

Assumes `backend/app/__init__.py` exposes `app`.

### Database

- Uses `sqlalchemy[asyncio]` with `aiosqlite`.
- Database configuration is defined in `backend/app/config.py` and `backend/app/database.py`.
- Prefer async sessions and dependency-injected DB access in routes.

---

## Frontend (React + Vite)

All frontend commands are run from `frontend/`.

### Install

```bash
npm install
```

### Development Server

```bash
npm run dev
```

### Production Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

### Lint

```bash
npm run lint
```

ESLint uses the flat config in `frontend/eslint.config.js`.

---

## Testing

There is currently no committed test suite.

When adding backend tests:

- Use `pytest`.
- Place tests under `backend/tests/`.
- Name files `test_*.py`.

Run all tests:

```bash
pytest
```

Run a single file:

```bash
pytest backend/tests/test_example.py
```

Run a single test function:

```bash
pytest backend/tests/test_example.py::test_function_name
```

Use `-k` to filter by substring:

```bash
pytest -k "keyword"
```

If frontend tests are added in the future, prefer Vitest for Vite compatibility.

---

## Code Style – Backend (Python)

### General

- Target Python 3.10+.
- Follow PEP 8.
- 4 spaces per indentation level.
- Max line length: 100–120 characters (be consistent within file).

### Imports

Order imports in three groups separated by a blank line:

1. Standard library
2. Third-party packages
3. Local application imports (`app.*`)

Avoid wildcard imports.

### Typing

- Use type hints on all public functions.
- Prefer explicit return types.
- Use `pydantic` models for request/response schemas (`schemas.py`).
- Avoid untyped `dict` when a schema is appropriate.

### FastAPI Conventions

- Define routes in `backend/app/routes/`.
- Group related endpoints in the same module.
- Use APIRouter and include it in `app/__init__.py`.
- Validate input via Pydantic models, not manual parsing.
- Use dependency injection for DB sessions.

### Database

- Use async SQLAlchemy sessions.
- Keep ORM models in `models.py`.
- Avoid raw SQL unless necessary.
- Keep transaction scope explicit.

### Error Handling

- Raise `HTTPException` for API-level errors.
- Do not leak internal exceptions to clients.
- Log unexpected exceptions before returning 500.
- Validate external inputs strictly.

### Security

- Never commit secrets.
- Use `.env.example` as template.
- Encrypt sensitive tokens via `encryption.py`.

---

## Code Style – Frontend (React)

### General

- Use functional components only.
- Use hooks (`useState`, `useEffect`, etc.).
- Keep components small and focused.

### File Structure

- Pages: `frontend/src/pages/`
- Reusable components: `frontend/src/components/`
- Editor-specific logic: `frontend/src/editor/`

### Naming

- Components: PascalCase (`Settings.jsx`).
- Hooks: `useSomething`.
- Variables/functions: camelCase.
- Constants: UPPER_SNAKE_CASE.

### Imports

- React and third-party imports first.
- Local imports next.
- Avoid deep relative paths when possible.

### State & Side Effects

- Keep side effects inside `useEffect`.
- Avoid unnecessary re-renders.
- Memoize expensive calculations when needed.

### Linting

- Follow rules defined in `eslint.config.js`.
- Do not disable rules unless justified.
- `react-refresh/only-export-components` warnings should be respected.

---

## Architecture Guidelines

- Keep backend business logic in `services/`, not route handlers.
- Keep ML/audio logic isolated in `ml.py` or service modules.
- Routes should orchestrate, not implement heavy logic.
- Frontend should not duplicate backend validation logic.

---

## Agent Behavior Guidelines

- Prefer minimal, surgical changes.
- Do not refactor unrelated code.
- Preserve async patterns in backend.
- Preserve ESLint compliance in frontend.
- Add types and schemas rather than weakening validation.
- When introducing new dependencies, update documentation.

---

## Git & Hygiene

- Do not commit `.env` files.
- Do not modify unrelated files.
- Avoid destructive git commands.
- Keep commits focused and descriptive.

---

No Cursor rules or Copilot instruction files were found in this repository at the time of writing.

Agents should treat this document as the source of truth for conventions unless explicitly instructed otherwise.
