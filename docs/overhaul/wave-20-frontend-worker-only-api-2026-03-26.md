# Wave 20: Frontend Worker-Only API Cleanup

Date: 2026-03-26

## Implemented

- Removed remaining frontend direct ML `/predict` client path.
- Frontend now uses Worker domain APIs only for runtime app flows.
- Removed unused legacy prediction request/response types from frontend type surface.
- Updated frontend and root docs to remove `NEXT_PUBLIC_RISK_API_URL` from required frontend envs.

## Updated Files

- `frontend/lib/fairlensApi.ts`
- `frontend/types/index.ts`
- `frontend/tests/unit/fairlensApi.test.ts`
- `frontend/README.md`
- `README.md`

## Verification

- `frontend`: `npm run lint` -> pass
- `frontend`: `npm run test -- --run` -> pass
- `frontend`: `npm run build` -> pass

