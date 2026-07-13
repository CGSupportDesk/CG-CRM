type ExportValue = string | number | boolean | null | undefined;

export type ExportRow = Record<string, ExportValue>;

export function exportRowsToCsv(filename: string, rows: ExportRow[]) {
  const csv = rowsToCsv(rows);
  downloadTextFile(filename.endsWith(".csv") ? filename : `${filename}.csv`, csv, "text/csv;charset=utf-8");
}

export function rowsToCsv(rows: ExportRow[]) {
  if (!rows.length) return "";

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(",")),
  ];

  return lines.join("\n");
}

function downloadTextFile(filename: string, content: string, type: string) {
  if (typeof document === "undefined") return;

  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeCsvValue(value: ExportValue) {
  const text = value === null || value === undefined ? "" : String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}
