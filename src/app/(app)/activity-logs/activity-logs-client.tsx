"use client";

import Link from "next/link";
import { Download, Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { BarList } from "@/components/charts";
import { useCRM } from "@/components/crm-provider";
import { Badge, Button, EmptyState, FieldLabel, PageHeader, Panel, inputClasses } from "@/components/ui";
import { dailyActivityLogReport } from "@/lib/analytics";
import { exportRowsToCsv } from "@/lib/export-utils";
import { formatDateTime, getDisplayName, todayIso, toLocalIsoDate } from "@/lib/utils";

export function ActivityLogsClient() {
  const { activityLogs, leads, loading } = useCRM();
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [chartDate, setChartDate] = useState(todayIso());
  const leadById = useMemo(() => new Map(leads.map((lead) => [lead.id, lead])), [leads]);
  const actions = useMemo(
    () => Array.from(new Set(activityLogs.map((log) => log.action).filter(Boolean))).sort(),
    [activityLogs],
  );
  const dailyLogReport = useMemo(
    () => dailyActivityLogReport(activityLogs, chartDate),
    [activityLogs, chartDate],
  );

  const filteredLogs = useMemo(() => {
    const text = query.trim().toLowerCase();

    return activityLogs
      .filter((log) => {
        const logDate = getLogDate(log.createdAt);
        return (!fromDate || logDate >= fromDate) && (!toDate || logDate <= toDate);
      })
      .filter((log) => action === "all" || log.action === action)
      .filter((log) => {
        const lead = leadById.get(log.leadId);
        const haystack = [
          log.action,
          log.oldValue,
          log.newValue,
          log.createdBy,
          lead?.leadCode,
          lead ? getDisplayName(lead) : log.leadId,
        ]
          .join(" ")
          .toLowerCase();
        return !text || haystack.includes(text);
      });
  }, [action, activityLogs, fromDate, leadById, query, toDate]);

  function exportLogs() {
    exportRowsToCsv(
      `growth-engine-activity-logs-${todayIso()}.csv`,
      filteredLogs.map((log) => {
        const lead = leadById.get(log.leadId);
        return {
          "Log Time": log.createdAt,
          "Lead ID": lead?.leadCode || log.leadId,
          Lead: lead ? getDisplayName(lead) : log.leadId,
          Action: log.action,
          "Old Value": log.oldValue,
          "New Value": log.newValue,
          "Created By": log.createdBy,
        };
      }),
    );
  }

  function clearFilters() {
    setQuery("");
    setAction("all");
    setFromDate("");
    setToDate("");
  }

  if (loading) {
    return <EmptyState title="Loading activity logs" description="Preparing the full Growth Engine audit trail." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity Logs"
        description="View the complete Growth Engine activity timeline, filter by date, and export logs for review."
        action={
          <Button variant="secondary" onClick={exportLogs}>
            <Download className="h-4 w-4" />
            Export Logs
          </Button>
        }
      />

      <Panel className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Hourly activity chart</h2>
            <p className="mt-1 text-sm text-muted">
              Work distribution for the selected day, calculated from activity log timestamps.
            </p>
          </div>
          <FieldLabel label="Chart Date">
            <input
              className={inputClasses}
              type="date"
              value={chartDate}
              onChange={(event) => setChartDate(event.target.value)}
            />
          </FieldLabel>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-surface-soft p-4">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Total Logs</p>
            <p className="mt-2 font-mono text-3xl font-bold">{dailyLogReport.totalLogs}</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-soft p-4">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Busiest Hour</p>
            <p className="mt-2 font-mono text-3xl font-bold">{dailyLogReport.topHour}</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-soft p-4">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Action Types</p>
            <p className="mt-2 font-mono text-3xl font-bold">{Object.keys(dailyLogReport.actionCounts).length}</p>
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-muted">Logs by hour</h3>
            <div className="mt-4">
              <BarList data={dailyLogReport.hourlyLogs} compact />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-muted">Logs by action</h3>
            <div className="mt-4">
              <BarList data={dailyLogReport.actionCounts} />
            </div>
          </div>
        </div>
      </Panel>

      <Panel className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.3fr_1fr_0.8fr_0.8fr]">
          <FilterField label="Search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                className={`${inputClasses} pl-10`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Lead ID, name, action"
              />
            </div>
          </FilterField>
          <FilterField label="Action">
            <select className={inputClasses} value={action} onChange={(event) => setAction(event.target.value)}>
              <option value="all">All actions</option>
              {actions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </FilterField>
          <FieldLabel label="From Date">
            <input className={inputClasses} type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </FieldLabel>
          <FieldLabel label="To Date">
            <input className={inputClasses} type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </FieldLabel>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">{filteredLogs.length} visible</Badge>
            <Badge tone="info">{activityLogs.length} total logs</Badge>
          </div>
          <Button variant="secondary" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {filteredLogs.slice(0, 3).map((log) => {
            const lead = leadById.get(log.leadId);
            return (
              <Link
                key={`latest-${log.id}`}
                href={lead ? `/leads/${lead.id}` : "/activity-logs"}
                className="rounded-2xl border border-border bg-surface-soft p-4 transition hover:bg-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{log.action}</p>
                    <p className="mt-1 truncate text-xs text-muted">
                      {lead ? getDisplayName(lead) : log.leadId}
                    </p>
                  </div>
                  <Badge tone="neutral">{log.createdBy || "captain"}</Badge>
                </div>
                <p className="mt-3 text-xs font-semibold text-muted">{formatDateTime(log.createdAt)}</p>
              </Link>
            );
          })}
        </div>

        {filteredLogs.length ? (
          <div className="grid gap-3 lg:hidden">
            {filteredLogs.map((log) => {
              const lead = leadById.get(log.leadId);
              return (
                <article key={log.id} className="rounded-[20px] border border-border bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{log.action}</p>
                      <p className="mt-1 text-xs text-muted">{formatDateTime(log.createdAt)}</p>
                    </div>
                    <Badge tone="neutral">{log.createdBy || "captain"}</Badge>
                  </div>
                  <div className="mt-3 rounded-2xl border border-border bg-surface-soft p-3">
                    {lead ? (
                      <Link href={`/leads/${lead.id}`} className="text-sm font-semibold hover:underline">
                        {getDisplayName(lead)}
                      </Link>
                    ) : (
                      <p className="text-sm font-semibold">{log.leadId}</p>
                    )}
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
                      {lead?.leadCode || log.leadId}
                    </p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted">
                    {log.oldValue ? <span>{log.oldValue} -&gt; </span> : null}
                    <span>{log.newValue || "No value"}</span>
                  </p>
                </article>
              );
            })}
          </div>
        ) : null}

        {filteredLogs.length ? (
          <div className="hidden overflow-hidden rounded-[20px] border border-border lg:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-surface-strong text-xs font-bold uppercase tracking-[0.08em] text-[#cad6dc]">
                  <tr>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Lead</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Change</th>
                    <th className="px-4 py-3">By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-white">
                  {filteredLogs.map((log) => {
                    const lead = leadById.get(log.leadId);
                    return (
                      <tr key={log.id}>
                        <td className="px-4 py-4 text-muted">{formatDateTime(log.createdAt)}</td>
                        <td className="px-4 py-4">
                          {lead ? (
                            <Link href={`/leads/${lead.id}`} className="font-semibold hover:underline">
                              {getDisplayName(lead)}
                            </Link>
                          ) : (
                            <span className="font-semibold">{log.leadId}</span>
                          )}
                          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
                            {lead?.leadCode || log.leadId}
                          </p>
                        </td>
                        <td className="px-4 py-4 font-semibold">{log.action}</td>
                        <td className="px-4 py-4 text-muted">
                          {log.oldValue ? <span>{log.oldValue} -&gt; </span> : null}
                          <span>{log.newValue || "No value"}</span>
                        </td>
                        <td className="px-4 py-4">{log.createdBy || "captain"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState title="No logs found" description="Try widening the date range or clearing the action filter." />
        )}
      </Panel>
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function getLogDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return toLocalIsoDate(date);
}
