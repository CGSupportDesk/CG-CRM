"use client";

import Link from "next/link";
import { ArrowRight, IndianRupee, Percent, Target, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ReportInsightsPanel } from "@/components/ai-panels";
import { BarList, DonutChart } from "@/components/charts";
import { useCRM } from "@/components/crm-provider";
import { Badge, EmptyState, PageHeader, Panel, buttonClasses } from "@/components/ui";
import {
  activeLeads,
  followupDueChart,
  getKpis,
  industryChart,
  leadStageChart,
  leadTemperatureChart,
  monthlyConversionRows,
  objectionChart,
} from "@/lib/analytics";
import { formatCurrency } from "@/lib/utils";

export function ReportsClient() {
  const { leads, loading } = useCRM();
  const active = activeLeads(leads);
  const kpis = getKpis(leads);
  const conversionRate = active.length ? Math.round((kpis.wonLeads / active.length) * 100) : 0;
  const monthlyRows = monthlyConversionRows(leads);
  const revenueByService = active.reduce<Record<string, number>>((acc, lead) => {
    if (!["Lost", "Rejected"].includes(lead.leadStage)) {
      acc[lead.serviceInterest] = (acc[lead.serviceInterest] || 0) + lead.expectedValue;
    }
    return acc;
  }, {});

  if (loading) {
    return <EmptyState title="Loading reports" description="Preparing lead reports and summary charts." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead Reports"
        description="Phase 1 reports focus only on CG Studio lead tracking, follow-ups, rejections, industries, conversions, and expected revenue."
        action={
          <Link href="/leads" className={buttonClasses("secondary")}>
            Review Leads
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ReportMetric icon={Target} label="Active Leads" value={active.length} />
        <ReportMetric icon={TrendingUp} label="Won Leads" value={kpis.wonLeads} />
        <ReportMetric icon={Percent} label="Conversion Rate" value={`${conversionRate}%`} />
        <ReportMetric icon={IndianRupee} label="Expected Revenue" value={formatCurrency(kpis.expectedRevenue)} />
      </div>

      <ReportInsightsPanel />

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Lead status report</h2>
            <Badge tone="neutral">{active.length} active</Badge>
          </div>
          <div className="mt-5">
            <BarList data={leadStageChart(leads)} />
          </div>
        </Panel>

        <Panel>
          <h2 className="text-xl font-semibold">Lead temperature report</h2>
          <div className="mt-5">
            <DonutChart data={leadTemperatureChart(leads)} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel>
          <h2 className="text-xl font-semibold">Follow-up report</h2>
          <div className="mt-5">
            <BarList data={followupDueChart(leads)} />
          </div>
        </Panel>
        <Panel>
          <h2 className="text-xl font-semibold">Rejection reason report</h2>
          <div className="mt-5">
            <BarList data={objectionChart(leads)} />
          </div>
        </Panel>
        <Panel>
          <h2 className="text-xl font-semibold">Industry-wise report</h2>
          <div className="mt-5">
            <BarList data={industryChart(leads)} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel>
          <h2 className="text-xl font-semibold">Monthly conversion report</h2>
          <div className="mt-5 overflow-hidden rounded-[20px] border border-border">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-surface-strong text-xs font-bold uppercase tracking-[0.08em] text-[#cad6dc]">
                  <tr>
                    <th className="px-4 py-3">Month</th>
                    <th className="px-4 py-3">Leads</th>
                    <th className="px-4 py-3">Won</th>
                    <th className="px-4 py-3">Conversion</th>
                    <th className="px-4 py-3">Expected Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-white">
                  {monthlyRows.map((row) => (
                    <tr key={row.month}>
                      <td className="px-4 py-4 font-semibold">{row.month}</td>
                      <td className="px-4 py-4">{row.leads}</td>
                      <td className="px-4 py-4">{row.won}</td>
                      <td className="px-4 py-4">{row.leads ? Math.round((row.won / row.leads) * 100) : 0}%</td>
                      <td className="px-4 py-4 font-mono font-bold">{formatCurrency(row.expected)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Panel>

        <Panel dark>
          <h2 className="text-xl font-semibold">Expected revenue report</h2>
          <p className="mt-2 text-sm leading-6 text-[#cad6dc]">
            Open expected value grouped by service interest, excluding lost and rejected leads.
          </p>
          <div className="mt-5 space-y-3">
            {Object.entries(revenueByService).length ? (
              Object.entries(revenueByService)
                .sort((a, b) => b[1] - a[1])
                .map(([service, value]) => (
                  <div key={service} className="rounded-2xl bg-white/8 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-white">{service}</span>
                      <span className="font-mono font-bold text-accent">{formatCurrency(value)}</span>
                    </div>
                  </div>
                ))
            ) : (
              <p className="text-sm text-[#cad6dc]">No expected revenue yet.</p>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function ReportMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
}) {
  return (
    <Panel className="p-5">
      <Icon className="h-5 w-5 text-accent-dark" />
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="mt-2 font-mono text-3xl font-bold tracking-tight">{value}</p>
    </Panel>
  );
}
