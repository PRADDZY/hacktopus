# Wave 8: Supabase Auth Foundation (Worker + Frontend)

Date: 2026-03-26

## Implemented

- Added Supabase-first JWT auth mode in Worker middleware with Auth0 fallback retained.
- Worker now resolves admin/user role from `public.user_roles` in Supabase for authenticated subjects.
- Added new auth bindings for Worker:
  - `SUPABASE_JWT_SECRET`
  - `SUPABASE_AUTH_ISSUER` (optional override)
- Frontend auth client now supports provider selection:
  - Supabase (primary if `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set)
  - Auth0 fallback (existing redirect flow retained)
- Added Supabase credential flows in frontend:
  - email/password sign-in
  - email/password sign-up
  - phone OTP verification hook (`verifyOtp`) for configured SMS setups
- Updated Store auth refresh to read server-resolved roles from Worker `/auth/me`, improving admin/user route gating alignment.

## Updated Files

- `worker-api/src/auth.ts`
- `worker-api/src/types.ts`
- `worker-api/tests/auth-middleware.test.ts`
- `worker-api/.dev.vars.example`
- `worker-api/wrangler.toml`
- `worker-api/README.md`
- `frontend/lib/authClient.ts`
- `frontend/store/StoreContext.tsx`
- `frontend/app/(shop)/login/page.tsx`
- `frontend/app/(shop)/admin/login/page.tsx`
- `frontend/app/(shop)/signup/page.tsx`
- `frontend/package.json`
- `frontend/package-lock.json`
- `frontend/README.md`
- `README.md`

## Verification

- `worker-api`: `npm test -- --run` -> pass (`30 passed`)
- `frontend`: `npm run test -- --run` -> pass
- `frontend`: `npm run lint` -> pass
- `frontend`: `npm run build` -> pass
- `backend`: `python -m pytest -q` -> pass
- `ml-service`: `python -m pytest -q` -> pass

