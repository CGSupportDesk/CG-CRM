"use client";

import { FileUp, UploadCloud } from "lucide-react";
import { useState } from "react";
import { useCRM } from "@/components/crm-provider";
import { Badge, Button, EmptyState, Panel } from "@/components/ui";
import { parseLegacyLeadCsv } from "@/lib/csv-import";
import type { ImportPreview, ImportSummary } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function CsvImporter() {
  const { importLegacyRows } = useCRM();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(file?: File) {
    if (!file) return;
    setLoading(true);
    setSummary(null);
    try {
      const text = await file.text();
      setPreview(parseLegacyLeadCsv(text));
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

  return (
    <Panel className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">CSV Import</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            Import the old Excel Sales Lead Tracker after saving it as CSV. A preview is shown before data is added.
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-surface-strong px-4 py-3 text-sm font-bold text-white transition hover:bg-[#1c2a32]">
          <UploadCloud className="h-4 w-4" />
          Choose CSV
          <input
            type="file"
            accept=".csv,text/csv"
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
          </div>

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
          title="No CSV selected"
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
