import { Badge, PageHeader, Panel } from "@/components/ui";

export function ComingSoonPage({
  title,
  badge,
  description,
  previewCards,
  wing = false,
}: {
  title: string;
  badge: string;
  description?: string;
  previewCards: string[];
  wing?: boolean;
}) {
  const message = wing
    ? "This wing is coming soon. Growth Engine Phase 1 is currently focused on CG Studio Lead Tracker."
    : "This module is coming soon. Leads, Follow-ups, Dashboard, Reports, CSV Import, Clients, Projects, Poster Calendar, and Settings are currently active.";

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description || message}
        action={<Badge tone={wing ? "soon" : "info"}>{badge}</Badge>}
      />
      <Panel className="overflow-hidden">
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div className="rounded-[22px] bg-surface-strong p-6 text-white">
            <Badge tone="soon">{badge}</Badge>
            <h2 className="mt-6 text-3xl font-semibold tracking-tight">{title}</h2>
            <p className="mt-4 text-sm leading-6 text-[#cad6dc]">{message}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {previewCards.map((card) => (
              <div
                key={card}
                className="rounded-[18px] border border-border bg-surface-soft p-5"
              >
                <p className="text-sm font-bold text-foreground">{card}</p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Prepared for future Growth Engine expansion.
                </p>
              </div>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  );
}
