"use client";

import Link from "next/link";
import { BrainCircuit, Sparkles } from "lucide-react";
import { useState } from "react";
import { Badge, Button, EmptyState, Panel } from "@/components/ui";
import type { DailyBrief, ReportAiInsight, ReportInsights } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

type AiState<T> = {
  loading: boolean;
  error: string;
  data: T | null;
};

export function DailyBriefPanel() {
  const [state, setState] = useState<AiState<DailyBrief>>({
    loading: false,
    error: "",
    data: null,
  });

  async function generateBrief() {
    setState((current) => ({ ...current, loading: true, error: "" }));

    try {
      const data = await callAi<DailyBrief>({ action: "dailyBrief" });
      setState({ loading: false, error: "", data });
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : "Could not generate daily brief.",
        data: null,
      });
    }
  }

  return (
    <Panel dark className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">Daily Growth Brief</h2>
            <Badge tone="info">Groq</Badge>
          </div>
          <p className="mt-1 text-sm leading-6 text-[#cad6dc]">
            Generate a focused calling plan from live lead and follow-up data.
          </p>
        </div>
        <Button variant="secondary" onClick={generateBrief} disabled={state.loading}>
          <Sparkles className="h-4 w-4" />
          {state.loading ? "Thinking..." : "Generate Brief"}
        </Button>
      </div>

      {state.error ? (
        <p className="rounded-2xl border border-[#f7c7c7] bg-[#fff0f0] p-3 text-sm font-semibold text-[#bd2727]">
          {state.error}
        </p>
      ) : null}

      {!state.data && !state.loading ? (
        <EmptyState
          title="No AI brief yet"
          description="Click Generate Brief when Naveen is ready to plan today's follow-ups."
        />
      ) : null}

      {state.data ? (
        <div className="space-y-5">
          <div className="rounded-2xl bg-white/8 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-accent">
              {formatDateTime(state.data.generatedAt)}
            </p>
            <h3 className="mt-2 text-lg font-semibold text-white">{state.data.headline}</h3>
            <p className="mt-2 text-sm leading-6 text-[#cad6dc]">{state.data.focus}</p>
          </div>

          {state.data.priorities.length ? (
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-[#cad6dc]">
                Priority Leads
              </h3>
              {state.data.priorities.map((priority) => (
                <Link
                  key={`${priority.leadId}-${priority.action}`}
                  href={`/leads/${priority.leadId}`}
                  className="block rounded-2xl bg-white/8 p-4 transition hover:bg-white/12"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-white">{priority.leadName}</p>
                    <Badge tone="neutral">{priority.recommendedWhatsappTemplate}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#cad6dc]">{priority.reason}</p>
                  <p className="mt-2 text-sm font-semibold text-accent">{priority.action}</p>
                </Link>
              ))}
            </div>
          ) : null}

          <AiList title="Today Plan" items={state.data.todayPlan} />
          <AiList title="Quick Wins" items={state.data.quickWins} />
          <AiList title="Risks" items={state.data.risks} danger />
        </div>
      ) : null}
    </Panel>
  );
}

export function ReportInsightsPanel() {
  const [state, setState] = useState<AiState<ReportInsights>>({
    loading: false,
    error: "",
    data: null,
  });

  async function generateInsights() {
    setState((current) => ({ ...current, loading: true, error: "" }));

    try {
      const data = await callAi<ReportInsights>({ action: "reportInsights" });
      setState({ loading: false, error: "", data });
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error.message : "Could not generate report insights.",
        data: null,
      });
    }
  }

  return (
    <Panel className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">AI Report Insights</h2>
            <Badge tone="info">Groq</Badge>
          </div>
          <p className="mt-1 text-sm leading-6 text-muted">
            Turn the report numbers into practical sales observations and next actions.
          </p>
        </div>
        <Button variant="secondary" onClick={generateInsights} disabled={state.loading}>
          <BrainCircuit className="h-4 w-4" />
          {state.loading ? "Reading reports..." : "Generate Insights"}
        </Button>
      </div>

      {state.error ? (
        <p className="rounded-2xl border border-[#f7c7c7] bg-[#fff0f0] p-3 text-sm font-semibold text-[#bd2727]">
          {state.error}
        </p>
      ) : null}

      {!state.data && !state.loading ? (
        <EmptyState
          title="No AI report yet"
          description="Generate insights after reviewing the charts, then use them to plan campaign improvements."
        />
      ) : null}

      {state.data ? (
        <div className="space-y-5">
          <div className="rounded-2xl border border-border bg-surface-soft p-4">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">
              {formatDateTime(state.data.generatedAt)}
            </p>
            <p className="mt-2 text-sm leading-6 text-foreground">
              {state.data.executiveSummary}
            </p>
          </div>

          <InsightGrid title="Insights" items={state.data.insights} />
          <InsightGrid title="Risks" items={state.data.risks} />
          <InsightGrid title="Opportunities" items={state.data.opportunities} />
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-muted">
              Next Actions
            </h3>
            <ul className="mt-3 grid gap-2">
              {state.data.nextActions.map((action) => (
                <li key={action} className="rounded-2xl border border-border bg-surface-soft p-3 text-sm">
                  {action}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

function AiList({
  title,
  items,
  danger = false,
}: {
  title: string;
  items: string[];
  danger?: boolean;
}) {
  if (!items.length) return null;

  return (
    <div>
      <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-[#cad6dc]">{title}</h3>
      <ul className="mt-3 grid gap-2">
        {items.map((item) => (
          <li
            key={item}
            className={`rounded-2xl p-3 text-sm leading-6 ${
              danger ? "bg-[#fff0f0] text-[#bd2727]" : "bg-white/8 text-[#cad6dc]"
            }`}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function InsightGrid({ title, items }: { title: string; items: ReportAiInsight[] }) {
  if (!items.length) return null;

  return (
    <div>
      <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-muted">{title}</h3>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {items.map((item) => (
          <div key={`${item.title}-${item.action}`} className="rounded-2xl border border-border bg-surface-soft p-4">
            <p className="font-semibold">{item.title}</p>
            <p className="mt-2 text-sm leading-6 text-muted">{item.detail}</p>
            <p className="mt-3 text-sm font-semibold text-accent-dark">{item.action}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

async function callAi<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(error?.error || `AI request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}
