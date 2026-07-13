"use client";

import Link from "next/link";
import { ArrowRight, Download, IndianRupee, MessageCircle, Percent, PhoneCall, Target, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";
import { ReportInsightsPanel } from "@/components/ai-panels";
import { BarList, DonutChart } from "@/components/charts";
import { useCRM } from "@/components/crm-provider";
import { Badge, Button, EmptyState, FieldLabel, PageHeader, Panel, buttonClasses, inputClasses } from "@/components/ui";
import {
  activeLeads,
  clientStatusChart,
  dailyActivityLogReport,
  dailyCommunicationReport,
  designerWorkloadChart,
  followupDueChart,
  getKpis,
  industryChart,
  leadStageChart,
  leadTemperatureChart,
  monthlyConversionRows,
  objectionChart,
  posterStatusChart,
  projectStatusChart,
  renewalRows,
  sampleConversionStats,
} from "@/lib/analytics";
import { exportRowsToCsv } from "@/lib/export-utils";
import { formatCurrency, formatDate, getDisplayName, todayIso } from "@/lib/utils";

export function ReportsClient() {
  const { leads, followups, activityLogs, clients, projects, posterSlots, loading } = useCRM();
  const [callReportDate, setCallReportDate] = useState(todayIso());
  const [activityReportDate, setActivityReportDate] = useState(todayIso());
  const active = activeLeads(leads);
  const kpis = getKpis(leads);
  const conversionRate = active.length ? Math.round((kpis.wonLeads / active.length) * 100) : 0;
  const monthlyRows = monthlyConversionRows(leads);
  const renewals = renewalRows(clients);
  const sampleStats = sampleConversionStats(leads, followups);
  const dailyReport = dailyCommunicationReport(followups, activityLogs, callReportDate, leads);
  const activityLogReport = dailyActivityLogReport(activityLogs, activityReportDate);
  const leadById = new Map(leads.map((lead) => [lead.id, lead]));
  const activityByUser = activityLogReport.logs.reduce<Record<string, number>>((acc, log) => {
    const user = log.createdBy || "captain";
    acc[user] = (acc[user] || 0) + 1;
    return acc;
  }, {});
  const activityByLead = activityLogReport.logs.reduce<Record<string, number>>((acc, log) => {
    const lead = leadById.get(log.leadId);
    const label = lead ? getDisplayName(lead) : log.leadId || "Unknown lead";
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
  const revenueByService = active.reduce<Record<string, number>>((acc, lead) => {
    if (!["Lost", "Rejected"].includes(lead.leadStage)) {
      acc[lead.serviceInterest] = (acc[lead.serviceInterest] || 0) + lead.expectedValue;
    }
    return acc;
  }, {});

  function exportReports() {
    exportRowsToCsv(`growth-engine-reports-${todayIso()}.csv`, [
      { Section: "Overview", Metric: "Active Leads", Value: active.length, Extra: "" },
      { Section: "Overview", Metric: "Won Leads", Value: kpis.wonLeads, Extra: "" },
      { Section: "Overview", Metric: "Conversion Rate", Value: `${conversionRate}%`, Extra: "" },
      { Section: "Overview", Metric: "Expected Revenue", Value: kpis.expectedRevenue, Extra: "" },
      { Section: "Samples", Metric: "Samples Sent", Value: sampleStats.samplesSent, Extra: "" },
      { Section: "Samples", Metric: "Samples Won", Value: sampleStats.samplesWon, Extra: "" },
      { Section: "Samples", Metric: "Sample Conversion Rate", Value: `${sampleStats.sampleConversionRate}%`, Extra: "" },
      { Section: "Samples", Metric: "Sample + Follow-up Conversion Rate", Value: `${sampleStats.sampleFollowupConversionRate}%`, Extra: "" },
      { Section: "Daily Report", Metric: "Report Date", Value: dailyReport.date, Extra: "" },
      { Section: "Daily Report", Metric: "Leads Created", Value: dailyReport.leadsCreated, Extra: "" },
      { Section: "Daily Report", Metric: "Follow-ups Logged", Value: dailyReport.totalFollowups, Extra: "" },
      { Section: "Daily Report", Metric: "Total Calls", Value: dailyReport.totalCalls, Extra: "" },
      { Section: "Daily Report", Metric: "WhatsApp / Messages", Value: dailyReport.totalMessages, Extra: "" },
      { Section: "Daily Report", Metric: "Total Activities", Value: dailyReport.totalActivities, Extra: "" },
      { Section: "Daily Report", Metric: "Top Activity Hour", Value: dailyReport.topActivityHour, Extra: "" },
      { Section: "Daily Report", Metric: "Call Source", Value: dailyReport.source, Extra: "" },
      { Section: "Daily Report", Metric: "Message Source", Value: dailyReport.messageSource, Extra: "" },
      { Section: "Activity Log Report", Metric: "Report Date", Value: activityLogReport.date, Extra: "" },
      { Section: "Activity Log Report", Metric: "Total Logs", Value: activityLogReport.totalLogs, Extra: "" },
      { Section: "Activity Log Report", Metric: "Busiest Hour", Value: activityLogReport.topHour, Extra: "" },
      { Section: "Activity Log Report", Metric: "Action Types", Value: Object.keys(activityLogReport.actionCounts).length, Extra: "" },
      ...Object.entries(dailyReport.outcomeCounts).map(([outcome, count]) => ({
        Section: "Daily Call Outcomes",
        Metric: outcome,
        Value: count,
        Extra: dailyReport.date,
      })),
      ...Object.entries(dailyReport.followupTypeCounts).map(([type, count]) => ({
        Section: "Daily Follow-up Types",
        Metric: type,
        Value: count,
        Extra: dailyReport.date,
      })),
      ...Object.entries(dailyReport.followupOutcomeCounts).map(([outcome, count]) => ({
        Section: "Daily Follow-up Outcomes",
        Metric: outcome,
        Value: count,
        Extra: dailyReport.date,
      })),
      ...Object.entries(dailyReport.messageCounts).map(([message, count]) => ({
        Section: "Daily WhatsApp / Messages",
        Metric: message,
        Value: count,
        Extra: dailyReport.date,
      })),
      ...Object.entries(dailyReport.hourlyCalls).map(([hour, count]) => ({
        Section: "Daily Call Hours",
        Metric: hour,
        Value: count,
        Extra: dailyReport.date,
      })),
      ...Object.entries(dailyReport.hourlyFollowups).map(([hour, count]) => ({
        Section: "Daily Follow-up Hours",
        Metric: hour,
        Value: count,
        Extra: dailyReport.date,
      })),
      ...Object.entries(dailyReport.hourlyMessages).map(([hour, count]) => ({
        Section: "Daily Message Hours",
        Metric: hour,
        Value: count,
        Extra: dailyReport.date,
      })),
      ...Object.entries(dailyReport.hourlyLeadCreations).map(([hour, count]) => ({
        Section: "Daily Lead Creation Hours",
        Metric: hour,
        Value: count,
        Extra: dailyReport.date,
      })),
      ...Object.entries(dailyReport.hourlyActivity).map(([hour, count]) => ({
        Section: "Daily Activity Hours",
        Metric: hour,
        Value: count,
        Extra: dailyReport.date,
      })),
      ...Object.entries(dailyReport.leadSourceCounts).map(([source, count]) => ({
        Section: "Daily Leads Created",
        Metric: source,
        Value: count,
        Extra: dailyReport.date,
      })),
      ...Object.entries(activityLogReport.actionCounts).map(([action, count]) => ({
        Section: "Activity Log Actions",
        Metric: action,
        Value: count,
        Extra: activityLogReport.date,
      })),
      ...Object.entries(activityLogReport.hourlyLogs).map(([hour, count]) => ({
        Section: "Activity Log Hours",
        Metric: hour,
        Value: count,
        Extra: activityLogReport.date,
      })),
      ...Object.entries(activityByUser).map(([user, count]) => ({
        Section: "Activity Log Users",
        Metric: user,
        Value: count,
        Extra: activityLogReport.date,
      })),
      ...Object.entries(activityByLead).map(([lead, count]) => ({
        Section: "Activity Log Leads",
        Metric: lead,
        Value: count,
        Extra: activityLogReport.date,
      })),
      ...monthlyRows.map((row) => ({
        Section: "Monthly Conversion",
        Metric: row.month,
        Value: row.leads,
        Extra: `Won: ${row.won}; Expected: ${row.expected}`,
      })),
    ]);
  }

  if (loading) {
    return <EmptyState title="Loading reports" description="Preparing lead reports and summary charts." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead Reports"
        description="CG Studio reports now cover leads, follow-ups, conversions, clients, projects, poster production, designer workload, renewals, and expected revenue."
        action={
          <>
            <Button variant="secondary" onClick={exportReports}>
              <Download className="h-4 w-4" />
              Export Reports
            </Button>
            <Link href="/leads" className={buttonClasses("secondary")}>
              Review Leads
              <ArrowRight className="h-4 w-4" />
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ReportMetric icon={Target} label="Active Leads" value={active.length} />
        <ReportMetric icon={TrendingUp} label="Won Leads" value={kpis.wonLeads} />
        <ReportMetric icon={Percent} label="Conversion Rate" value={`${conversionRate}%`} />
        <ReportMetric icon={IndianRupee} label="Expected Revenue" value={formatCurrency(kpis.expectedRevenue)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ReportMetric icon={Target} label="Samples Sent" value={sampleStats.samplesSent} />
        <ReportMetric icon={TrendingUp} label="Samples Won" value={sampleStats.samplesWon} />
        <ReportMetric icon={Percent} label="Sample Conversion" value={`${sampleStats.sampleConversionRate}%`} />
        <ReportMetric icon={PhoneCall} label="Follow-up Conversion" value={`${sampleStats.followupConversionRate}%`} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ReportMetric icon={PhoneCall} label="Samples Followed Up" value={sampleStats.samplesWithFollowups} />
        <ReportMetric icon={TrendingUp} label="Sample Follow-up Won" value={sampleStats.samplesWithFollowupsWon} />
        <ReportMetric icon={Percent} label="Sample Follow-up Conversion" value={`${sampleStats.sampleFollowupConversionRate}%`} />
        <ReportMetric icon={Target} label="Followed-up Leads" value={sampleStats.followedUp} />
      </div>

      <ReportInsightsPanel />

      <Panel className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Operation Reports</h2>
            <p className="mt-1 text-sm text-muted">
              Client health, project delivery, poster production, designer workload, and renewal visibility.
            </p>
          </div>
          <Badge tone="success">CG Studio active</Badge>
        </div>
        <div className="grid gap-5 xl:grid-cols-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-muted">Client report</h3>
            <div className="mt-4"><BarList data={clientStatusChart(clients)} compact /></div>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-muted">Project report</h3>
            <div className="mt-4"><BarList data={projectStatusChart(projects)} compact /></div>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-muted">Poster report</h3>
            <div className="mt-4"><BarList data={posterStatusChart(posterSlots)} compact /></div>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-muted">Designer workload</h3>
            <div className="mt-4"><BarList data={designerWorkloadChart(projects, posterSlots)} compact /></div>
          </div>
        </div>
      </Panel>

      <Panel className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Daily sales report</h2>
            <p className="mt-1 text-sm text-muted">
              Calls and WhatsApp/message activity for the selected day, using activity log timestamps.
            </p>
          </div>
          <FieldLabel label="Report Date">
            <input
              className={inputClasses}
              type="date"
              value={callReportDate}
              onChange={(event) => setCallReportDate(event.target.value)}
            />
          </FieldLabel>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-2xl border border-border bg-surface-soft p-4">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Leads Created</p>
            <p className="mt-2 font-mono text-3xl font-bold">{dailyReport.leadsCreated}</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-soft p-4">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Follow-ups Logged</p>
            <p className="mt-2 font-mono text-3xl font-bold">{dailyReport.totalFollowups}</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-soft p-4">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Total Calls</p>
            <p className="mt-2 font-mono text-3xl font-bold">{dailyReport.totalCalls}</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-soft p-4">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">WhatsApp / Messages</p>
            <p className="mt-2 font-mono text-3xl font-bold">{dailyReport.totalMessages}</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-soft p-4">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Busiest Call Hour</p>
            <p className="mt-2 font-mono text-3xl font-bold">{dailyReport.topHour}</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-soft p-4">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Busiest Message Hour</p>
            <p className="mt-2 font-mono text-3xl font-bold">{dailyReport.topMessageHour}</p>
          </div>
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-muted">Call outcomes</h3>
            <div className="mt-4">
              <BarList data={dailyReport.outcomeCounts} />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-muted">WhatsApp / message report</h3>
            <div className="mt-4">
              <BarList data={dailyReport.messageCounts} />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-muted">Follow-ups by type</h3>
            <div className="mt-4">
              <BarList data={dailyReport.followupTypeCounts} />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-muted">Follow-up outcomes</h3>
            <div className="mt-4">
              <BarList data={dailyReport.followupOutcomeCounts} />
            </div>
          </div>
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.08em] text-muted">
              <PhoneCall className="h-4 w-4" />
              Calls by hour
            </h3>
            <div className="mt-4">
              <BarList data={dailyReport.hourlyCalls} compact />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-muted">Follow-ups by hour</h3>
            <div className="mt-4">
              <BarList data={dailyReport.hourlyFollowups} compact />
            </div>
          </div>
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.08em] text-muted">
              <MessageCircle className="h-4 w-4" />
              Messages by hour
            </h3>
            <div className="mt-4">
              <BarList data={dailyReport.hourlyMessages} compact />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-muted">Leads created by source</h3>
            <div className="mt-4">
              <BarList data={dailyReport.leadSourceCounts} />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-muted">Leads created by hour</h3>
            <div className="mt-4">
              <BarList data={dailyReport.hourlyLeadCreations} compact />
            </div>
          </div>
          <div className="xl:col-span-2">
            <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-muted">Combined daily activity by hour</h3>
            <div className="mt-4">
              <BarList data={dailyReport.hourlyActivity} compact />
            </div>
          </div>
        </div>
      </Panel>

      <Panel className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Activity log report</h2>
            <p className="mt-1 text-sm text-muted">
              Infographic view of all CRM activity for a selected day, filtered directly from the activity log.
            </p>
          </div>
          <FieldLabel label="Activity Date">
            <input
              className={inputClasses}
              type="date"
              value={activityReportDate}
              onChange={(event) => setActivityReportDate(event.target.value)}
            />
          </FieldLabel>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-border bg-surface-soft p-4">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Total Logs</p>
            <p className="mt-2 font-mono text-3xl font-bold">{activityLogReport.totalLogs}</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-soft p-4">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Busiest Hour</p>
            <p className="mt-2 font-mono text-3xl font-bold">{activityLogReport.topHour}</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-soft p-4">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Action Types</p>
            <p className="mt-2 font-mono text-3xl font-bold">{Object.keys(activityLogReport.actionCounts).length}</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-soft p-4">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Leads Touched</p>
            <p className="mt-2 font-mono text-3xl font-bold">{Object.keys(activityByLead).length}</p>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-muted">Activities by type</h3>
            <div className="mt-4">
              <BarList data={activityLogReport.actionCounts} />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-muted">Activities by hour</h3>
            <div className="mt-4">
              <BarList data={activityLogReport.hourlyLogs} compact />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-muted">Activities by user</h3>
            <div className="mt-4">
              <BarList data={activityByUser} />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-muted">Most active leads</h3>
            <div className="mt-4">
              <BarList data={activityByLead} />
            </div>
          </div>
        </div>
      </Panel>

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

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Renewal report</h2>
          <Badge tone="neutral">{renewals.length} upcoming renewals</Badge>
        </div>
        <div className="mt-5 overflow-hidden rounded-[20px] border border-border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-surface-strong text-xs font-bold uppercase tracking-[0.08em] text-[#cad6dc]">
                <tr>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Package</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Renewal Date</th>
                  <th className="px-4 py-3">Monthly Value</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {renewals.length ? (
                  renewals.slice(0, 12).map((client) => (
                    <tr key={client.id}>
                      <td className="px-4 py-4 font-semibold">{client.clientName}</td>
                      <td className="px-4 py-4">{client.packageName}</td>
                      <td className="px-4 py-4">{client.owner}</td>
                      <td className="px-4 py-4">{formatDate(client.renewalDate)}</td>
                      <td className="px-4 py-4 font-mono font-bold">{formatCurrency(client.monthlyValue)}</td>
                      <td className="px-4 py-4"><Badge>{client.status}</Badge></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-6 text-muted" colSpan={6}>No renewal dates set yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
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
