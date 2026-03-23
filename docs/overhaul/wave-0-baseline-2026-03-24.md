# Wave 0 Baseline Snapshot

Date: 2026-03-24
Objective: Establish a clean baseline before infrastructure and domain migration waves.

## Baseline Summary

- Branch target: `main`
- Active architecture before migration:
  - Frontend: Next.js app (`frontend/`)
  - Backend: FastAPI + SQLAlchemy (`backend/`)
  - ML inference: FastAPI service with XGBoost artifacts (`ml-service/`)
  - Shared API contract: `shared/openapi.json`
- Supabase migrations exist in `backend/supabase/migrations`, but runtime app is not yet migrated to Worker/Supabase-first execution.

## Wave 0 Actions

1. Archive assistant WIP context for later rebuild.
2. Remove assistant WIP from active runtime and tests.
3. Tighten repo hygiene for local-only artifacts and scratch ML directory.
4. Re-verify baseline test/lint health.

## Explicit Non-Goals for Wave 0

- No model replacement.
- No Cloudflare runtime migration yet.
- No passkey/auth redesign implementation yet.
- No frontend redesign.
