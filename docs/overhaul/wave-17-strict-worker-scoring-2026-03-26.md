# Wave 17: Strict Worker Scoring Mode (No Silent Heuristic Fallback)

Date: 2026-03-26

## Implemented

- Added strict scoring behavior to Worker scoring pipeline:
  - Worker now requires `MODEL_SCORING_ENDPOINT` unless fallback is explicitly enabled.
  - Added `WORKER_SCORING_FALLBACK_ENABLED` env switch (default `false`).
  - When strict mode is active and scoring service is unavailable, Worker returns `503 model_unavailable`.
- Preserved optional heuristic scoring fallback only when explicitly enabled.
- Added explicit scoring error handling in both:
  - `POST /v1/applications`
  - `POST /v1/assessments`
- Updated runtime config docs:
  - `.dev.vars.example`
  - `wrangler.toml`
  - Worker README + root README
- Extended tests with strict-mode coverage for missing model endpoint.

## Updated Files

- `worker-api/src/routes/domain.ts`
- `worker-api/src/types.ts`
- `worker-api/tests/domain-routes.test.ts`
- `worker-api/.dev.vars.example`
- `worker-api/wrangler.toml`
- `worker-api/README.md`
- `README.md`

## Verification

- `worker-api`: `npm test -- --run` -> pass
- `worker-api`: `npx tsc --noEmit` -> pass
