# AWSsbg

Static site for AWS Students Builder Group ADYPSOE.

## Vercel Config

The browser code reads runtime config from `/api/config`, so set these environment variables in Vercel:

- `WEB3FORMS_ACCESS_KEY`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `MAX_SEATS` (defaults to `100`)
- `STORAGE_BUCKET` (defaults to `payment-screenshots`)

Use `.env.example` as the local reference when setting values in Vercel or during local development with the Vercel CLI.
