import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight, BarChart3, CalendarClock, FileUp, LockKeyhole, Sparkles, Target } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Badge, Panel, buttonClasses } from "@/components/ui";
import { futureModules, phaseOneModules, wingCards } from "@/lib/constants";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";

export default async function Home() {
  const cookieStore = await cookies();
  const isAuthenticated = isValidSession(cookieStore.get(SESSION_COOKIE)?.value);
  const leadTrackerHref = isAuthenticated ? "/leads" : "/login";

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <BrandLogo variant="dark" className="h-12 max-w-[190px]" />
        </Link>
        <Link href="/login" className={buttonClasses("secondary", "sm")}>
          <LockKeyhole className="h-4 w-4" />
          Login
        </Link>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-88px)] max-w-7xl gap-10 px-5 pb-12 pt-8 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div>
          <h1 className="text-5xl font-semibold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            Growth Engine
          </h1>
          <p className="mt-6 max-w-2xl text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
            Your internal command center for leads, follow-ups, clients, and growth.
          </p>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">
            Start with CG Studio Lead Tracker. Expand later into YAA, Hiring,
            Outsourcing, clients, projects, poster calendars, website workflows,
            payments, and full operations.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/login" className={buttonClasses("primary", "lg")}>
              Login
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href={leadTrackerHref} className={buttonClasses("dark", "lg")}>
              View Lead Tracker
            </Link>
          </div>
        </div>

        <DashboardPreview />
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[
            {
              icon: Target,
              title: "Lead Tracker",
              text: "Track every sales lead, status, call, follow-up, and remark.",
            },
            {
              icon: CalendarClock,
              title: "Follow-ups",
              text: "See today's calls, overdue follow-ups, and next actions.",
            },
            {
              icon: BarChart3,
              title: "Studio Workflows",
              text: "Prepared for poster packages, websites, creative work, and approvals.",
            },
            {
              icon: Sparkles,
              title: "Future Wings",
              text: "Prepared for YAA, Hiring, and Outsourcing.",
            },
          ].map((feature) => {
            const FeatureIcon = feature.icon;
            return (
              <Panel key={feature.title} className="p-5">
                <FeatureIcon className="h-5 w-5 text-accent-dark" />
                <h2 className="mt-5 text-lg font-semibold">{feature.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{feature.text}</p>
              </Panel>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight">Built for every Closing Gap wing</h2>
        <div className="mt-6 grid gap-4 lg:grid-cols-4">
          {wingCards.map((wing) => (
            <Panel key={wing.title} className="p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-xl font-semibold">{wing.title}</h3>
                <Badge tone={wing.status === "Active" ? "success" : "soon"}>{wing.status}</Badge>
              </div>
              <p className="mt-4 text-sm leading-6 text-muted">{wing.description}</p>
            </Panel>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-12 sm:px-6 lg:grid-cols-2">
        <Panel>
          <h2 className="text-2xl font-semibold tracking-tight">Active CG Studio system</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Growth Engine now connects sales leads, clients, projects, poster slots,
            settings, reports, and dashboard operations for CG Studio.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {phaseOneModules.map((module) => (
              <Badge key={module} tone="success">{module}</Badge>
            ))}
          </div>
        </Panel>
        <Panel dark>
          <h2 className="text-2xl font-semibold tracking-tight">Future expansion</h2>
          <p className="mt-2 text-sm leading-6 text-[#cad6dc]">
            Website projects, payments, and other Closing Gap wings stay visible
            without overbuilding backend logic before it is needed.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {futureModules.map((module) => (
              <Badge key={module} tone="soon">{module}</Badge>
            ))}
          </div>
        </Panel>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-6">
        <Panel className="grid gap-8 p-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Dashboard preview</h2>
            <p className="mt-4 text-sm leading-6 text-muted">
              See lead temperature, overdue follow-ups, client count, active projects,
              poster production, expected revenue, and recent activity from one place.
            </p>
          </div>
          <div className="rounded-[24px] bg-surface-strong p-4 text-white">
            <DashboardPreview compact />
          </div>
        </Panel>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-6">
        <Panel className="flex flex-col items-start justify-between gap-5 p-7 md:flex-row md:items-center">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Ready to manage growth better?</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Log in and start with CG Studio leads, follow-ups, reports, and CSV import.
            </p>
          </div>
          <Link href="/login" className={buttonClasses("primary", "lg")}>
            Login to Growth Engine
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Panel>
      </section>
    </main>
  );
}

function DashboardPreview({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "space-y-4" : "rounded-[32px] border border-white/70 bg-white/72 p-4 shadow-[0_28px_90px_rgba(22,44,55,0.18)] backdrop-blur"}>
      <div className={compact ? "grid gap-3 sm:grid-cols-3" : "grid gap-3 sm:grid-cols-3"}>
        {[
          ["Total Leads", "124"],
          ["Due Today", "18"],
          ["Expected", "₹7.4L"],
        ].map(([label, value]) => (
          <div key={label} className={compact ? "rounded-2xl bg-white/10 p-4" : "rounded-2xl bg-white p-4"}>
            <p className={compact ? "text-xs font-bold uppercase tracking-[0.08em] text-[#aebcc4]" : "text-xs font-bold uppercase tracking-[0.08em] text-muted"}>
              {label}
            </p>
            <p className={compact ? "mt-2 font-mono text-2xl font-bold text-white" : "mt-2 font-mono text-2xl font-bold"}>
              {value}
            </p>
          </div>
        ))}
      </div>
      <div className={compact ? "grid gap-3 lg:grid-cols-[0.9fr_1.1fr]" : "mt-4 grid gap-3 lg:grid-cols-[0.9fr_1.1fr]"}>
        <div className="rounded-[22px] bg-surface-strong p-4 text-white">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Hot leads</h3>
            <Badge tone="hot">Action</Badge>
          </div>
          {["Blue Mango Cafe", "FitCore Gym", "Sparkle Salon"].map((lead, index) => (
            <div key={lead} className="flex items-center justify-between border-t border-white/10 py-3 text-sm">
              <span>{lead}</span>
              <span className="font-mono text-accent">{index === 1 ? "Overdue" : "Today"}</span>
            </div>
          ))}
        </div>
        <div className={compact ? "rounded-[22px] bg-white/10 p-4" : "rounded-[22px] bg-[#d9e9f2] p-4"}>
          <div className="flex items-center justify-between">
            <h3 className={compact ? "text-sm font-semibold text-white" : "text-sm font-semibold"}>
              Lead status
            </h3>
            <FileUp className={compact ? "h-4 w-4 text-accent" : "h-4 w-4 text-accent-dark"} />
          </div>
          <div className="mt-5 space-y-3">
            {[
              ["Follow-up Needed", "78%"],
              ["Proposal Sent", "54%"],
              ["Won", "28%"],
            ].map(([label, width]) => (
              <div key={label}>
                <div className={compact ? "mb-1 flex justify-between text-xs text-[#cad6dc]" : "mb-1 flex justify-between text-xs text-muted"}>
                  <span>{label}</span>
                  <span>{width}</span>
                </div>
                <div className={compact ? "h-2 rounded-full bg-white/15" : "h-2 rounded-full bg-white/70"}>
                  <div className="h-full rounded-full bg-accent" style={{ width }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
