# FairLens Frontend

Single Next.js app containing both:
- Shop experience (customer flow)
- Bank risk dashboard (admin flow)

## Development

```bash
cd frontend
npm install
npm run dev
```

Set environment variables:

```
NEXT_PUBLIC_API_URL=http://localhost:8787
NEXT_PUBLIC_BACKEND_URL=http://localhost:10000
NEXT_PUBLIC_RISK_API_URL=http://localhost:10000
NEXT_PUBLIC_AUTH0_DOMAIN=<tenant>.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=<client-id>
NEXT_PUBLIC_AUTH0_AUDIENCE=<api-audience>
NEXT_PUBLIC_APP_BASE_URL=http://localhost:3000
```

## Routes

Shop:
- `/` (home)
- `/product/[id]`
- `/cart`
- `/checkout`
- `/orders`
- `/wishlist`
- `/profile`
- `/support`
- `/login`
- `/signup`
- `/admin/login`
- `/auth/callback`

Dashboard:
- `/dashboard`
- `/dashboard/emi-requests`
- `/dashboard/analytics`
- `/dashboard/audit-logs`

## Notes

- Dashboard uses live Worker API data for applications, stats, and audit flows.
- When Auth0 env vars are configured, dashboard routes require admin role from token claims.
- API calls include `Authorization`, `X-Request-Id`, and `Idempotency-Key` headers when applicable.
- Checkout EMI flow creates Worker-owned application records via `/v1/applications`.
- Dashboard stats/logs and decision review use Worker `/v1/*` routes.

## Shared Types

Generate API types from the backend OpenAPI schema:

```bash
python ../backend/scripts/export_openapi.py
npm run types:generate
```
