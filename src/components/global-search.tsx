"use client";

import Link from "next/link";
import { Building2, FolderKanban, Search, Target, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { useCRM } from "@/components/crm-provider";
import { Badge, inputClasses } from "@/components/ui";
import { cn, formatCurrency, formatDate, getDisplayName } from "@/lib/utils";

type SearchResult = {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  href: string;
  type: "Lead" | "Client" | "Project";
  icon: ComponentType<{ className?: string }>;
  badge?: string;
  value?: string;
};

export function GlobalSearch({ compact = false }: { compact?: boolean }) {
  const { leads, clients, projects } = useCRM();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const results = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (text.length < 2) return [];

    const leadResults: SearchResult[] = leads.map((lead) => ({
      id: `lead-${lead.id}`,
      title: getDisplayName(lead),
      eyebrow: `${lead.leadCode} - ${lead.assignedTo || "Unassigned"}`,
      description: [
        lead.phone,
        lead.leadUrl,
        lead.industry,
        lead.remarks,
      ].filter(Boolean).join(" - "),
      href: `/leads/${lead.id}`,
      type: "Lead",
      icon: Target,
      badge: lead.leadStage,
      value: formatCurrency(lead.expectedValue),
    }));

    const clientResults: SearchResult[] = clients.map((client) => ({
      id: `client-${client.id}`,
      title: client.clientName,
      eyebrow: `${client.packageName} - ${client.owner}`,
      description: [
        client.contactPerson,
        client.phone,
        client.industry,
        client.notes,
      ].filter(Boolean).join(" - "),
      href: `/clients/${client.id}`,
      type: "Client",
      icon: Building2,
      badge: client.status,
      value: `Renewal ${formatDate(client.renewalDate, "not set")}`,
    }));

    const projectResults: SearchResult[] = projects.map((project) => ({
      id: `project-${project.id}`,
      title: project.projectName,
      eyebrow: `${project.projectType} - ${project.designer}`,
      description: [
        project.status,
        project.dueDate,
        project.notes,
      ].filter(Boolean).join(" - "),
      href: "/projects",
      type: "Project",
      icon: FolderKanban,
      badge: project.status,
      value: project.dueDate ? `Due ${formatDate(project.dueDate)}` : "",
    }));

    return [...leadResults, ...clientResults, ...projectResults]
      .filter((result) =>
        [result.title, result.eyebrow, result.description, result.badge, result.value]
          .join(" ")
          .toLowerCase()
          .includes(text),
      )
      .slice(0, 8);
  }, [clients, leads, projects, query]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function handleShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", handleShortcut);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", handleShortcut);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative min-w-0">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          ref={inputRef}
          className={cn(inputClasses, "rounded-full pl-9 pr-9", compact ? "min-h-10 text-xs" : "min-h-11")}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={compact ? "Search" : "Search leads, clients, projects"}
          aria-label="Global search"
        />
        {query ? (
          <button
            type="button"
            className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted transition hover:bg-surface-soft hover:text-foreground"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            title="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {open && query.trim().length >= 2 ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-[20px] border border-border bg-white shadow-[0_24px_70px_rgba(17,26,32,0.18)]">
          {results.length ? (
            <div className="max-h-[420px] overflow-y-auto p-2">
              {results.map((result) => (
                <SearchResultRow
                  key={result.id}
                  result={result}
                  onSelect={() => {
                    setOpen(false);
                    setQuery("");
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="p-4 text-sm font-semibold text-muted">
              No match found for {query.trim()}.
            </div>
          )}
          <div className="flex items-center justify-between gap-3 border-t border-border bg-surface-soft px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
            <span>Global Search</span>
            <span>Ctrl K</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SearchResultRow({
  result,
  onSelect,
}: {
  result: SearchResult;
  onSelect: () => void;
}) {
  const Icon = result.icon;

  return (
    <Link
      href={result.href}
      onClick={onSelect}
      className="flex min-w-0 items-start gap-3 rounded-2xl p-3 transition hover:bg-surface-soft"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-white text-accent-dark">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-bold text-foreground">{result.title}</span>
          <Badge tone="neutral" className="shrink-0">{result.type}</Badge>
        </span>
        <span className="mt-1 block truncate text-xs font-semibold text-muted">{result.eyebrow}</span>
        <span className="mt-1 block truncate text-xs text-muted">{result.description || result.value}</span>
      </span>
      {result.badge ? <Badge>{result.badge}</Badge> : null}
    </Link>
  );
}
