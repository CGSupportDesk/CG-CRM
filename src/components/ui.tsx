import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn, statusTone } from "@/lib/utils";

type Tone =
  | "neutral"
  | "hot"
  | "warm"
  | "cold"
  | "success"
  | "danger"
  | "muted"
  | "soon"
  | "info";

export function buttonClasses(
  variant: "primary" | "secondary" | "dark" | "ghost" | "danger" = "primary",
  size: "sm" | "md" | "lg" | "icon" = "md",
) {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-55",
    size === "sm" && "min-h-9 px-3 text-xs",
    size === "md" && "min-h-10 px-4 text-sm",
    size === "lg" && "min-h-12 px-5 text-base",
    size === "icon" && "h-9 w-9 p-0",
    variant === "primary" &&
      "bg-accent text-surface-strong shadow-[0_10px_24px_rgba(159,205,19,0.28)] hover:bg-[#c9f228] focus-visible:outline-accent-dark",
    variant === "secondary" &&
      "border border-border bg-white text-foreground hover:border-[#c2d1d8] hover:bg-surface-soft focus-visible:outline-accent-dark",
    variant === "dark" &&
      "bg-surface-strong text-white hover:bg-[#1c2a32] focus-visible:outline-accent",
    variant === "ghost" &&
      "text-muted hover:bg-white hover:text-foreground focus-visible:outline-accent-dark",
    variant === "danger" &&
      "bg-[#fdecec] text-[#bd2727] hover:bg-[#fbdede] focus-visible:outline-danger",
  );
}

export function Button({
  className,
  variant,
  size,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Parameters<typeof buttonClasses>[0];
  size?: Parameters<typeof buttonClasses>[1];
}) {
  return <button className={cn(buttonClasses(variant, size), className)} {...props} />;
}

export function Badge({
  children,
  tone,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  const resolvedTone = tone || (typeof children === "string" ? statusTone(children) : "neutral");

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-bold leading-none",
        resolvedTone === "neutral" && "border-border bg-white text-foreground",
        resolvedTone === "hot" && "border-[#ffc4bd] bg-[#fff0ed] text-[#c13a2e]",
        resolvedTone === "warm" && "border-[#ffe1a3] bg-[#fff7df] text-[#9b6a00]",
        resolvedTone === "cold" && "border-[#cfe1ff] bg-[#eff6ff] text-[#3464b7]",
        resolvedTone === "success" && "border-[#b8ead6] bg-[#eafaf3] text-[#0c7c52]",
        resolvedTone === "danger" && "border-[#f7c7c7] bg-[#fff0f0] text-[#bd2727]",
        resolvedTone === "muted" && "border-[#d8e0e4] bg-[#f1f5f7] text-[#61717c]",
        resolvedTone === "soon" && "border-[#dfe7ec] bg-[#f7fafc] text-[#65747f]",
        resolvedTone === "info" && "border-[#cddcff] bg-[#eef4ff] text-[#2f5edb]",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Panel({
  children,
  className,
  dark = false,
}: {
  children: ReactNode;
  className?: string;
  dark?: boolean;
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-[22px] border p-5 shadow-[0_18px_60px_rgba(22,44,55,0.08)]",
        dark
          ? "border-[#263740] bg-surface-strong text-white"
          : "border-border bg-white text-foreground",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-sm leading-6 text-muted md:text-base">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-[18px] border border-dashed border-border bg-surface-soft p-8 text-center">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Modal({
  title,
  description,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#101820]/55 px-4 py-8 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "w-full rounded-[24px] border border-border bg-white p-5 shadow-[0_28px_90px_rgba(0,0,0,0.25)]",
          wide ? "max-w-5xl" : "max-w-2xl",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
            ) : null}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="pt-5">{children}</div>
      </div>
    </div>
  );
}

export function FieldLabel({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-muted">
        {label}
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs font-semibold text-[#bd2727]">{error}</span> : null}
    </label>
  );
}

export const inputClasses =
  "min-h-11 w-full rounded-2xl border border-border bg-white px-3 text-sm text-foreground outline-none transition placeholder:text-[#9ba8af] focus:border-accent-dark focus:ring-4 focus:ring-accent/30";
