"use client";

import Link from "next/link";
import { Download, Search } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useCRM } from "@/components/crm-provider";
import { Badge, Button, EmptyState, FieldLabel, PageHeader, Panel, inputClasses } from "@/components/ui";
import { exportRowsToCsv } from "@/lib/export-utils";
import { formatDateTime, getDisplayName, todayIso, toLocalIsoDate } from "@/lib/utils";

export function ActivityLogsClient() {
  const { activityLogs, leads, loading } = useCRM();
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const leadById = useMemo(() => new Map(leads.map((lead) => [lead.id, lead])), [leads]);
  const actions = useMemo(
    () => Array.from(new Set(activityLogs.map((log) => log.action).filter(Boolean))).sort(),
    [activityLogs],
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

        <div className="flex flex-wrap gap-2">
          <Badge tone="neutral">{filteredLogs.length} visible</Badge>
          <Badge tone="info">{activityLogs.length} total logs</Badge>
        </div>

        {filteredLogs.length ? (
          <div className="overflow-hidden rounded-[20px] border border-border">
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
