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
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
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
- Auth provider priority: Supabase (if `NEXT_PUBLIC_SUPABASE_*` is set), otherwise Auth0 fallback.
- Admin role is validated server-side via Worker auth (`/auth/me` role resolution).
- API calls include `Authorization`, `X-Request-Id`, and `Idempotency-Key` headers when applicable.
- AI assistant widget is available in both shop and dashboard layouts via Worker `POST /v1/assistant/query`.
- Checkout EMI flow is statement-first via Worker `/v1/documents` + `/v1/assessments`.
- Dashboard stats/logs and decision review use Worker `/v1/*` routes.

## Shared Types

Generate API types from the backend OpenAPI schema:

```bash
python ../backend/scripts/export_openapi.py
npm run types:generate
```
