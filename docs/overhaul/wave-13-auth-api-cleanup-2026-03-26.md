# Wave 13: Frontend Auth + API Cleanup (No Local Fake Modes)

Date: 2026-03-26

## Implemented

- Removed frontend API fallback to legacy backend URL for primary domain calls.
- Standardized frontend API defaults to Worker (`NEXT_PUBLIC_API_URL`) and ML risk endpoint (`NEXT_PUBLIC_RISK_API_URL`).
- Removed local fake authentication behavior from store context:
  - no synthetic login user creation
  - no OTP `123456` bypass path
  - no persisted auth state reuse when provider is missing
- Hardened login/signup/admin UX for unconfigured auth:
  - explicit "auth not configured" messaging
  - disabled auth action buttons when provider configuration is absent
- Updated environment documentation to Supabase + Worker defaults.
- Normalized dashboard product category formatting (`EMI - <bank>`).

## Updated Files

- `frontend/lib/fairlensApi.ts`
- `frontend/store/StoreContext.tsx`
- `frontend/app/(shop)/login/page.tsx`
- `frontend/app/(shop)/signup/page.tsx`
- `frontend/app/(shop)/admin/login/page.tsx`
- `frontend/.env.example`
- `frontend/README.md`
- `README.md`

## Verification

- `frontend`: `npm run test -- --run` -> pass
- `frontend`: `npm run lint` -> pass
- `frontend`: `npm run build` -> pass

