# Wave 14: Deterministic Demo Seed Data

Date: 2026-03-26

## Implemented

- Added Supabase demo seed utility script:
  - `worker-api/scripts/demo-seed.mjs`
  - Seeds deterministic application records for dashboard stats/logs.
  - Seeds deterministic audit log entries.
  - Optional role mapping support for known Supabase auth user UUIDs.
  - Supports `--no-reset`, `--dry-run`, and `--help`.
- Added worker npm command:
  - `npm run seed:demo`
- Updated demo docs and readmes with seed workflow:
  - `docs/demo/demo-runbook.md`
  - `worker-api/README.md`
  - root `README.md`

## Updated Files

- `worker-api/scripts/demo-seed.mjs`
- `worker-api/package.json`
- `worker-api/README.md`
- `docs/demo/demo-runbook.md`
- `README.md`

## Verification

- `worker-api`: `node scripts/demo-seed.mjs --help` -> pass
- `worker-api`: `npm test -- --run` -> pass

