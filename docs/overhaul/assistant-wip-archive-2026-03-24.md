# Assistant WIP Archive (Wave 0)

Date: 2026-03-24
Scope: Archive-only reference before removing assistant from active code paths.

## Why Archived

The current assistant implementation was uncommitted WIP on `main`.  
For overhaul sequencing, assistant is intentionally deferred and will be rebuilt in a later wave.

## WIP Surface Area Observed

Backend:
- `backend/app/api/routes.py` (SSE assistant routes)
- `backend/app/core/auth.py` and `backend/app/core/__init__.py` (optional user dependency)
- `backend/app/core/config.py` (assistant provider config/env)
- `backend/app/main.py` (assistant service boot)
- `backend/app/schemas/assistant.py` and `backend/app/schemas/__init__.py`
- `backend/app/services/assistant_service.py` and `backend/app/services/__init__.py`
- `backend/tests/test_assistant_api.py`
- `backend/README.md` (assistant docs)

Frontend:
- `frontend/components/assistant/AssistantWidget.tsx`
- `frontend/lib/fairlensApi.ts` (assistant SSE client)
- `frontend/types/index.ts` (assistant request/event types)
- `frontend/tests/unit/assistantApi.test.ts`
- `frontend/tests/unit/run.ts` (suite registration)
- `frontend/app/(shop)/layout.tsx` and `frontend/app/(dashboard)/layout.tsx` (widget mount)

## Rebuild Guidance

- Re-implement on top of post-migration architecture (Cloudflare Worker API + Auth0 + Supabase + Modal).
- Keep assistant capability separated from core risk decisioning.
- Add guardrails and role-aware surface behavior as first-class acceptance criteria.
