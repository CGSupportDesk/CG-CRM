"use client";

import { FileUp, Sparkles, UploadCloud } from "lucide-react";
import { useState } from "react";
import { useCRM } from "@/components/crm-provider";
import { Badge, Button, EmptyState, Panel } from "@/components/ui";
import { parseLegacyLeadCsv } from "@/lib/csv-import";
import type { ImportCleanupResult, ImportCleanupRowSuggestion, ImportPreview, ImportSummary, LeadDraft } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function CsvImporter() {
  const { importLegacyRows } = useCRM();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState("");
  const [cleanupError, setCleanupError] = useState("");

  async function handleFile(file?: File) {
    if (!file) return;
    setLoading(true);
    setSummary(null);
    setCleanupMessage("");
    setCleanupError("");
    try {
      const text = await readLeadTrackerFile(file);
      setPreview(parseLegacyLeadCsv(trimToTrackerHeader(text)));
    } finally {
      setLoading(false);
    }
  }

  async function importRows() {
    if (!preview) return;
    setLoading(true);
    try {
      const result = await importLegacyRows(preview.rows);
      setSummary(result);
    } finally {
      setLoading(false);
    }
  }

  async function cleanupPreviewWithAi() {
    if (!preview?.rows.length) return;
    setCleanupLoading(true);
    setCleanupError("");
    setCleanupMessage("");

    try {
      const suggestions: ImportCleanupRowSuggestion[] = [];
      const chunkSize = 25;

      for (let index = 0; index < preview.rows.length; index += chunkSize) {
        const chunk = preview.rows.slice(index, index + chunkSize);
        const response = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "importCleanup", rows: chunk }),
        });

        if (!response.ok) {
          const error = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(error?.error || `AI cleanup failed with ${response.status}`);
        }

        const result = (await response.json()) as ImportCleanupResult;
        suggestions.push(...result.rows);
      }

      setPreview((current) => (current ? applyImportCleanup(current, suggestions) : current));
      setCleanupMessage(`AI cleanup reviewed ${suggestions.length} rows. Phone numbers, remarks, and dates were preserved.`);
    } catch (error) {
      setCleanupError(error instanceof Error ? error.message : "Could not clean import preview.");
    } finally {
      setCleanupLoading(false);
    }
  }

  return (
    <Panel className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">CSV Import</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            Import the old Excel Sales Lead Tracker as CSV or XLSX. Preview first, then optionally clean inferred fields with AI before import.
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-surface-strong px-4 py-3 text-sm font-bold text-white transition hover:bg-[#1c2a32]">
          <UploadCloud className="h-4 w-4" />
          Choose CSV/XLSX
          <input
            type="file"
            accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
        </label>
      </div>

      {loading ? (
        <EmptyState
          title="Reading CSV"
          description="Parsing lead rows, status mapping, contact dates, and Followup 1-4 columns."
        />
      ) : null}

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <ImportMetric label="Leads imported" value={summary.leadsImported} />
          <ImportMetric label="Follow-ups created" value={summary.followupsImported} />
          <ImportMetric label="Skipped rows" value={summary.skippedRows} />
        </div>
      ) : null}

      {preview ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge tone="info">{preview.rows.length} valid lead rows</Badge>
              <Badge tone={preview.errors.length ? "danger" : "success"}>
                {preview.errors.length} parse errors
              </Badge>
              <Badge tone="neutral">{preview.totalRows} total rows</Badge>
            </div>
            <Button onClick={importRows} disabled={!preview.rows.length || loading}>
              <FileUp className="h-4 w-4" />
              {loading ? "Importing..." : "Import Previewed Rows"}
            </Button>
            <Button
              variant="secondary"
              onClick={cleanupPreviewWithAi}
              disabled={!preview.rows.length || cleanupLoading || loading}
            >
              <Sparkles className="h-4 w-4" />
              {cleanupLoading ? "Cleaning..." : "AI Cleanup Preview"}
            </Button>
          </div>

          {cleanupMessage ? (
            <div className="rounded-2xl border border-[#b8ead6] bg-[#eafaf3] p-4 text-sm font-semibold text-[#0c7c52]">
              {cleanupMessage}
            </div>
          ) : null}

          {cleanupError ? (
            <div className="rounded-2xl border border-[#f7c7c7] bg-[#fff0f0] p-4 text-sm font-semibold text-[#bd2727]">
              {cleanupError}
            </div>
          ) : null}

          {preview.errors.length ? (
            <div className="rounded-2xl border border-[#f7c7c7] bg-[#fff0f0] p-4 text-sm text-[#bd2727]">
              {preview.errors.slice(0, 4).map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-[18px] border border-border">
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="sticky top-0 bg-surface-soft text-xs font-bold uppercase tracking-[0.08em] text-muted">
                  <tr>
                    <th className="px-4 py-3">Row</th>
                    <th className="px-4 py-3">Lead</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Mapped Status</th>
                    <th className="px-4 py-3">First Contact</th>
                    <th className="px-4 py-3">Follow-ups</th>
                    <th className="px-4 py-3">Warnings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-white">
                  {preview.rows.map((row) => (
                    <tr key={row.rowNumber} className="align-top">
                      <td className="px-4 py-3 font-mono text-xs text-muted">{row.rowNumber}</td>
                      <td className="px-4 py-3 font-semibold">{row.lead.leadName}</td>
                      <td className="px-4 py-3">{row.lead.phone || "Unavailable"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge>{row.lead.leadTemperature}</Badge>
                          <Badge>{row.lead.leadStage}</Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3">{formatDate(row.lead.firstContactDate)}</td>
                      <td className="px-4 py-3">{row.followups.length}</td>
                      <td className="px-4 py-3 text-xs leading-5 text-muted">
                        {row.warnings.length ? row.warnings.join(" ") : "Ready"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState
          title="No CSV or Excel selected"
          description="Expected columns: Lead Url, Lead Name, Contact Number, Status, Contact Date, Followup 1-4, and Remarks."
        />
      )}
    </Panel>
  );
}

function ImportMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[18px] border border-border bg-surface-soft p-4">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="mt-2 font-mono text-3xl font-bold">{value}</p>
    </div>
  );
}

async function readLeadTrackerFile(file: File) {
  if (file.name.toLowerCase().endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/browser");
    const rows = await readSheet(file);
    return rows.map((row) => row.map(csvCell).join(",")).join("\n");
  }

  return file.text();
}

function trimToTrackerHeader(text: string) {
  const lines = text.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => {
    const lower = line.toLowerCase();
    return lower.includes("lead url") && lower.includes("lead name");
  });

  return headerIndex >= 0 ? lines.slice(headerIndex).join("\n") : text;
}

function csvCell(value: unknown) {
  let text = "";
  if (value instanceof Date) text = value.toISOString().slice(0, 10);
  else text = value === null || value === undefined ? "" : String(value);

  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function applyImportCleanup(
  preview: ImportPreview,
  suggestions: ImportCleanupRowSuggestion[],
): ImportPreview {
  const suggestionByRow = new Map(suggestions.map((suggestion) => [suggestion.rowNumber, suggestion]));

  return {
    ...preview,
    rows: preview.rows.map((row) => {
      const suggestion = suggestionByRow.get(row.rowNumber);
      if (!suggestion) return row;

      return {
        ...row,
        lead: {
          ...row.lead,
          ...removeEmptyImportSuggestion(suggestion.suggestedLead),
          leadUrl: row.lead.leadUrl,
          phone: row.lead.phone,
          remarks: row.lead.remarks,
          firstContactDate: row.lead.firstContactDate,
          nextFollowupDate: row.lead.nextFollowupDate,
          assignedTo: row.lead.assignedTo,
        },
        warnings: [
          ...row.warnings,
          ...suggestion.warnings.map((warning) => `AI: ${warning}`),
          suggestion.notes ? `AI: ${suggestion.notes}` : "",
        ].filter(Boolean),
      };
    }),
  };
}

function removeEmptyImportSuggestion(suggestion: Partial<LeadDraft>) {
  return Object.fromEntries(
    Object.entries(suggestion).filter(([key, value]) => {
      if (["phone", "remarks", "leadUrl", "firstContactDate", "nextFollowupDate"].includes(key)) {
        return false;
      }
      if (typeof value === "string") return value.trim().length > 0;
      return value !== undefined && value !== null;
    }),
  ) as Partial<LeadDraft>;
}
