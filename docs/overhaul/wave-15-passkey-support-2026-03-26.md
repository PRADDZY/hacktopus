# Wave 15: Supabase Passkey Support (Frontend)

Date: 2026-03-26

## Implemented

- Added Supabase WebAuthn passkey client support in frontend auth layer:
  - list enrolled passkeys
  - register new passkey
  - run passkey verification (MFA authenticate)
  - remove passkey factors
  - read current/next assurance level (`aal1`/`aal2`)
- Added passkey management section to profile page:
  - browser capability guardrails
  - passkey list and status rendering
  - register/verify/remove actions
  - inline action and error states
- Updated project docs/runbook to reflect passkey flow in demo.

## Updated Files

- `frontend/lib/authClient.ts`
- `frontend/app/(shop)/profile/page.tsx`
- `frontend/README.md`
- `docs/demo/demo-runbook.md`
- `README.md`

## Verification

- `frontend`: `npm run test -- --run` -> pass
- `frontend`: `npm run lint` -> pass
- `frontend`: `npm run build` -> pass

