# Growth Engine

Growth Engine is Closing Gap's internal CRM for CG Studio lead tracking, follow-ups, reports, and legacy CSV import.

Phase 1 is intentionally focused on replacing the Excel Sales Lead Tracker:

- Landing page
- Login
- Dashboard
- Leads CRUD
- Lead detail page
- Follow-ups
- Lead reports
- CSV import preview and import

Phase 2 modules and future wings are visible as polished coming-soon pages only.

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Default Phase 1 login:

- Username: `captain`
- Password: configure `GROWTH_ENGINE_PASSWORD`

For Vercel, set the variables below so the fixed Phase 1 login stays server-side.

## Vercel Environment Variables

Create these in Vercel Project Settings:

```bash
GROWTH_ENGINE_USERNAME=captain
GROWTH_ENGINE_PASSWORD=<private-password>
GROWTH_ENGINE_SESSION_TOKEN=<long-random-token>
GROWTH_ENGINE_SEED_TSV_BASE64=<private-base64-encoded-tracker-tsv>
```

The password is checked only by the server route at `/api/auth/login`; it is not placed in frontend client code.
The seed tracker is also server-side. Keep `GROWTH_ENGINE_SEED_TSV_BASE64` in Vercel/project env only because it contains campaign contact details.

## Data

The current build uses browser local storage for Phase 1 campaign persistence so the CRM works immediately after deploy without provisioning a database. If `GROWTH_ENGINE_SEED_TSV_BASE64` is configured, authenticated users start with the active 30 Poster Package sales campaign tracker instead of dummy sample leads. The SQL schema for a future Postgres-backed version is in `database/schema.sql`.

Tables covered:

- `leads`
- `followups`
- `activity_logs`

## CSV Import

The Leads page includes a CSV Import panel for the old tracker fields:

- Lead Url
- Lead Name
- Contact Number
- Status
- Contact Date
- Followup 1
- Followup 2
- Followup 3
- Followup 4
- Remarks

The importer previews rows before import, maps HOT/WARM/REJECTED/NO RESPONSE statuses, creates unlimited follow-up records from Followup 1-4 dates, and allows missing phone numbers.

## Scripts

```bash
npm run dev
npm run lint
npm run build
```
