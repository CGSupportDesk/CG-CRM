# Growth Engine Visual QA Checklist

Run this after CRM UI changes before deploying to Vercel.

## Viewports

- Desktop: 1440 x 900
- Tablet: 1024 x 768
- Mobile: 390 x 844

## Core Routes

- `/dashboard`: KPI cards, operation KPIs, charts, and activity cards fit without overlap.
- `/daily-sales`: Today's Calls, Overdue, Hot Leads, and No Response queues show readable cards and actions.
- `/leads`: filters have labels, inline edit controls fit, and action buttons are visible.
- `/follow-ups`: overdue/today/upcoming cards and follow-up history table remain usable.
- `/reports`: charts and report tables render with no clipped labels.
- `/clients`: payment status, project count, renewal date, and actions fit in the table.
- `/clients/[id]`: client profile, package, payment, renewal, notes, projects, and activity timeline render clearly.
- `/poster-calendar`: production workflow board and detailed slot table are both readable.

## Critical Interactions

- CSV/XLSX import preview shows Create New versus Update Existing before import.
- Duplicate phone numbers and Instagram URLs are flagged in the import preview.
- WhatsApp modal auto-selects a sensible template, allows edits, opens WhatsApp, and logs the template opened.
- Follow-up logging recalculates the next working-day follow-up date.
- Poster slots can move through Planned, Designing, Review, Approved, Scheduled, and Posted.
