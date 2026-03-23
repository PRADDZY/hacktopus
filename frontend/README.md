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
NEXT_PUBLIC_BACKEND_URL=http://localhost:10000
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

Dashboard:
- `/dashboard`
- `/dashboard/emi-requests`
- `/dashboard/analytics`
- `/dashboard/audit-logs`

## Notes

Dashboard uses live backend data only.

## Shared Types

Generate API types from the backend OpenAPI schema:

```bash
python ../backend/scripts/export_openapi.py
npm run types:generate
```
