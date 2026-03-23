# Supabase Baseline

This folder tracks Supabase-first database setup for FairLens.

## Apply migrations

```bash
cd backend
supabase db push
```

## Required backend environment variables

```bash
DATABASE_URL=postgresql://...
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

## Notes

- `0001_core_schema.sql` creates `transactions`, `audit_logs`, and `user_roles`.
- `0002_application_domain.sql` adds server-owned EMI application fields and indexes.
- RLS is enabled by default and write access is restricted to `service_role`.
- `user_roles` supports app-side role mapping for user/admin segmentation.
