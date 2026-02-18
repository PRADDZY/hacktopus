# Shared API Types

This folder is the contract boundary between the FastAPI backend and the Next.js frontend.

## Workflow

1. Export the backend OpenAPI schema:

```bash
python backend/scripts/export_openapi.py
```

2. Generate TypeScript types in the frontend:

```bash
cd frontend
npm run types:generate
```

The generated types will be written to `frontend/types/api.ts`.

## Notes

- `openapi.json` should be committed so contracts stay in sync.
- Regenerate types whenever backend schemas change.
