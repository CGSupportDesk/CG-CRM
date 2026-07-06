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
DATABASE_URL=<vercel-neon-database-url>
POSTGRES_URL=<vercel-neon-postgres-url>
```

The password is checked only by the server route at `/api/auth/login`; it is not placed in frontend client code.
The seed tracker is also server-side. Keep `GROWTH_ENGINE_SEED_TSV_BASE64` in Vercel/project env only because it contains campaign contact details.
`DATABASE_URL` and `POSTGRES_URL` are created automatically when the Neon Marketplace integration is connected to the Vercel project.

## Data

The current build uses Neon Postgres through Vercel Marketplace for Phase 1 campaign persistence. On the first authenticated CRM load, the app creates the `leads`, `followups`, and `activity_logs` tables if needed. If the database is empty and `GROWTH_ENGINE_SEED_TSV_BASE64` is configured, it seeds the active 30 Poster Package sales campaign tracker instead of dummy sample leads.

The source schema is in `database/schema.sql`.

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

## Automated Follow-up Schedule

Growth Engine automatically generates next follow-up dates using working days only:

- 2nd contact: next working day after first contact
- 3rd contact: 2 working days after 2nd contact
- 4th contact: 2 working days after 3rd contact
- 5th contact: 3 working days after 4th contact

Saturday and Sunday are skipped. If a calculated date lands on a weekend, it moves to the next Monday.

## Scripts

```bash
npm run dev
npm run lint
npm run build
```
