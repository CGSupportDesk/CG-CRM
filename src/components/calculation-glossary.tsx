import { Calculator } from "lucide-react";
import { Badge, Panel } from "@/components/ui";

type GlossaryScope = "dashboard" | "reports";

interface GlossaryItem {
  term: string;
  formula: string;
  note: string;
}

interface GlossaryGroup {
  title: string;
  items: GlossaryItem[];
}

const dashboardGroups: GlossaryGroup[] = [
  {
    title: "Lead KPIs",
    items: [
      {
        term: "Total Leads",
        formula: "Count of leads where is_archived is false.",
        note: "Archived leads are excluded from dashboard totals.",
      },
      {
        term: "Hot, Warm, Cold Leads",
        formula: "Active leads grouped by lead_temperature.",
        note: "A lead is counted once, based on its current temperature.",
      },
      {
        term: "Follow-ups Due Today",
        formula: "Active leads where next_followup_date equals today's local date.",
        note: "Dates are evaluated in the app's India time zone.",
      },
      {
        term: "Overdue Follow-ups",
        formula: "Active leads where next_followup_date is before today's local date.",
        note: "Blank follow-up dates are not counted as overdue.",
      },
      {
        term: "Expected Revenue",
        formula: "Sum of expected_value for active leads except Lost and Rejected.",
        note: "Won leads remain included unless they are archived.",
      },
    ],
  },
  {
    title: "Dashboard Queues",
    items: [
      {
        term: "Today Calls",
        formula: "Open active leads with next_followup_date equal to today.",
        note: "Won, Lost, and Rejected leads are treated as closed and excluded.",
      },
      {
        term: "Hot Action",
        formula: "Open Hot leads with overdue, today, or missing next follow-up dates.",
        note: "This is meant to surface leads that need immediate movement.",
      },
      {
        term: "No Date",
        formula: "Open active leads where next_followup_date is blank.",
        note: "Closed leads are excluded.",
      },
    ],
  },
  {
    title: "CG Studio Operations",
    items: [
      {
        term: "Active Clients",
        formula: "Clients where status is not Closed.",
        note: "This includes renewal due clients unless they are closed.",
      },
      {
        term: "Active Projects",
        formula: "Projects where status is not Delivered or On Hold.",
        note: "Planning, Designing, Review, and similar active states are included.",
      },
      {
        term: "Poster Slots This Month",
        formula: "Poster slots where slot_date is in the current month.",
        note: "The current month is based on today's local date.",
      },
      {
        term: "Monthly Value",
        formula: "Sum of monthly_value for active clients.",
        note: "Closed clients are excluded from the recurring value calculation.",
      },
    ],
  },
];

const reportsGroups: GlossaryGroup[] = [
  ...dashboardGroups,
  {
    title: "Lead Reports",
    items: [
      {
        term: "Conversion Rate",
        formula: "Won active leads / active leads x 100, rounded to the nearest whole number.",
        note: "Archived leads are not included in either side of the formula.",
      },
      {
        term: "Lead Status, Temperature, Industry",
        formula: "Active leads grouped by the selected field.",
        note: "Blank values are shown as Not Set where applicable.",
      },
      {
        term: "Rejection Reason",
        formula: "Active leads with an objection_reason, grouped by reason.",
        note: "Only rows that have an objection reason are counted.",
      },
      {
        term: "Follow-up Due Chart",
        formula: "Open leads split into Overdue, Today, Upcoming, and No Date, plus a Closed bucket.",
        note: "Closed means Won, Lost, or Rejected.",
      },
      {
        term: "Monthly Conversion",
        formula: "Active leads grouped by created_at month; Won is counted by lead_stage.",
        note: "Monthly expected revenue includes open leads and Won leads, excluding Lost and Rejected.",
      },
    ],
  },
  {
    title: "Daily Reports",
    items: [
      {
        term: "Daily Calls",
        formula: "Follow-up records or activity-log follow-ups on the selected date where type is Call.",
        note: "If activity-log follow-up entries exist for the day, they are preferred for the report.",
      },
      {
        term: "WhatsApp / Messages",
        formula: "WhatsApp opened activity logs plus WhatsApp or Instagram DM follow-up records.",
        note: "This tracks opened WhatsApp links/templates, not delivered, read, or sent status.",
      },
      {
        term: "Hourly Charts",
        formula: "Activities grouped by created_at or marked_at hour in Asia/Kolkata time.",
        note: "Each chart uses the timestamp attached to that activity type.",
      },
      {
        term: "Leads Created",
        formula: "Leads where created_at falls on the selected report date.",
        note: "Lead source counts use the lead's current source value.",
      },
      {
        term: "Activity Log Report",
        formula: "Activity logs filtered by selected date, then grouped by action, hour, user, and lead.",
        note: "This section reads directly from activity_logs.",
      },
    ],
  },
  {
    title: "Sales Intelligence",
    items: [
      {
        term: "Lead Score",
        formula: "Base 20 plus temperature, stage, follow-up urgency, sample, value, age, and touch modifiers.",
        note: "Scores are capped between 0 and 100. Won leads score 100; Lost and Rejected leads score 0.",
      },
      {
        term: "Lead Score Bands",
        formula: "Priority >= 75, Healthy >= 50, Nurture < 50, Closed for Won/Lost/Rejected.",
        note: "The pipeline uses these bands to highlight priority leads.",
      },
      {
        term: "Lead Aging",
        formula: "Days from lead created_at to today, grouped into 0-2, 3-7, 8-14, 15-30, and 31+ days.",
        note: "Only open active leads are included.",
      },
      {
        term: "Follow-up Audit",
        formula: "Scheduled follow-up date compared with actual marked follow-up date.",
        note: "Completed Late, Early, or On Time is based on working-day delay.",
      },
      {
        term: "Data Quality Score",
        formula: "100 - round(total issue count / max(active leads x 5, 1) x 100).",
        note: "Issues include duplicates, missing phone, URL, dates, remarks, industry, source, and stale leads.",
      },
    ],
  },
  {
    title: "Samples and WhatsApp",
    items: [
      {
        term: "Sample Conversion",
        formula: "Sample-sent leads that became Won / sample-sent leads x 100.",
        note: "A sample-sent lead is one where sample_poster_sent is true.",
      },
      {
        term: "Follow-up Conversion",
        formula: "Followed-up leads that became Won / followed-up leads x 100.",
        note: "A followed-up lead is any lead with at least one follow-up record.",
      },
      {
        term: "Sample Follow-up Conversion",
        formula: "Sample-sent leads with follow-ups that became Won / sample-sent leads with follow-ups x 100.",
        note: "This shows whether samples plus follow-up are helping conversion.",
      },
      {
        term: "WhatsApp Template Performance",
        formula: "WhatsApp opened logs grouped by template; open-to-won = unique opened leads that are Won / unique opened leads x 100.",
        note: "This is template-open tracking only, not WhatsApp delivery analytics.",
      },
    ],
  },
  {
    title: "Operation Reports",
    items: [
      {
        term: "Client Report",
        formula: "Clients grouped by client status.",
        note: "All client rows are included unless another filter is added later.",
      },
      {
        term: "Project Report",
        formula: "Projects grouped by project status.",
        note: "Used to understand delivery flow.",
      },
      {
        term: "Poster Report",
        formula: "Poster slots grouped by poster slot status.",
        note: "Calendar status colors use the same poster slot status values.",
      },
      {
        term: "Designer Workload",
        formula: "Projects plus poster slots grouped by designer.",
        note: "Blank designer names are counted as Unassigned.",
      },
      {
        term: "Renewal Report",
        formula: "Non-closed clients with a renewal_date, sorted by renewal_date.",
        note: "This helps identify upcoming client renewals.",
      },
    ],
  },
];

export function CalculationGlossary({ scope }: { scope: GlossaryScope }) {
  const groups = scope === "dashboard" ? dashboardGroups : reportsGroups;
  const subtitle =
    scope === "dashboard"
      ? "How the main dashboard numbers are calculated."
      : "How Growth Engine calculates report, dashboard, sales, and operations metrics.";

  return (
    <Panel id="calculation-glossary" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-accent-dark" />
            <h2 className="text-xl font-semibold">Calculation Glossary</h2>
          </div>
          <p className="mt-1 text-sm leading-6 text-muted">{subtitle}</p>
        </div>
        <Badge tone="info">No separate module</Badge>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        {groups.map((group, index) => (
          <details
            key={group.title}
            className="group rounded-[18px] border border-border bg-surface-soft p-4"
            open={index === 0}
          >
            <summary className="cursor-pointer list-none text-sm font-bold uppercase tracking-[0.08em] text-muted">
              <span className="flex items-center justify-between gap-3">
                {group.title}
                <span className="text-xs normal-case tracking-normal text-accent-dark group-open:hidden">
                  View
                </span>
                <span className="hidden text-xs normal-case tracking-normal text-accent-dark group-open:inline">
                  Hide
                </span>
              </span>
            </summary>
            <div className="mt-4 space-y-3">
              {group.items.map((item) => (
                <div key={item.term} className="rounded-2xl border border-border bg-white p-4">
                  <p className="font-semibold">{item.term}</p>
                  <p className="mt-2 text-sm leading-6 text-foreground">{item.formula}</p>
                  <p className="mt-1 text-xs leading-5 text-muted">{item.note}</p>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </Panel>
  );
}
