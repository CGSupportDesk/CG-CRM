"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  CalendarClock,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Sparkles,
  Target,
  History,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { Badge, Button } from "@/components/ui";
import { cgStudioModules, primaryModules, wingCards } from "@/lib/constants";
import { cn } from "@/lib/utils";

const iconMap: Record<string, ComponentType<{ className?: string }>> = {
  Dashboard: LayoutDashboard,
  Leads: Target,
  "Follow-ups": CalendarClock,
  Reports: BarChart3,
  "Activity Logs": History,
  Clients: Users,
  Projects: FolderKanban,
  "Poster Calendar": ClipboardList,
  "Website Projects": Sparkles,
  Payments: CircleDollarSign,
  "Daily Sales": ClipboardList,
  Settings,
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const currentModule = getCurrentModuleLabel(pathname);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileMenuOpen(false);
    }

    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-border bg-white/92 px-4 py-5 shadow-[18px_0_60px_rgba(22,44,55,0.08)] backdrop-blur-xl lg:flex">
        <Link href="/dashboard" className="flex flex-col items-start gap-1 px-2">
          <BrandLogo variant="dark" className="h-14 max-w-[190px]" />
          <span className="text-xs font-semibold text-muted">CG Studio active</span>
        </Link>

        <nav className="mt-7 flex flex-1 flex-col gap-6 overflow-y-auto pr-1">
          <SidebarSection>
            {primaryModules.map((item) => (
              <NavItem
                key={item.href}
                href={item.href}
                label={item.label}
                active={pathname === item.href}
                icon={iconMap[item.label]}
              />
            ))}
          </SidebarSection>

          <SidebarSection title="CG Studio Modules">
            {cgStudioModules.map((item) => (
              <NavItem
                key={item.href}
                href={item.href}
                label={item.label}
                active={pathname === item.href}
                icon={iconMap[item.label]}
                trailing={item.status === "Coming Soon" ? <Badge tone="soon">Soon</Badge> : undefined}
              />
            ))}
          </SidebarSection>

          <SidebarSection title="Wings">
            {wingCards.map((wing) => (
              <NavItem
                key={wing.title}
                href={wing.href}
                label={wing.title}
                active={pathname === wing.href}
                icon={wing.title === "CG Studio" ? Sparkles : ChevronRight}
                trailing={<Badge tone={wing.status === "Active" ? "success" : "soon"}>{wing.status}</Badge>}
              />
            ))}
          </SidebarSection>
        </nav>

        <div className="mt-5 rounded-[20px] bg-surface-soft p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold">captain</p>
              <p className="text-xs text-muted">Phase 1 access</p>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} title="Logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-border bg-white/86 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link href="/dashboard" className="min-w-0 flex-1">
            <BrandLogo variant="dark" className="h-10 max-w-[150px]" />
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setMobileMenuOpen(true)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-growth-engine-menu"
            >
              <Menu className="h-4 w-4" />
              Menu
            </Button>
            <Button variant="ghost" size="icon" onClick={logout} title="Logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-surface-soft px-3 py-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
              Current
            </p>
            <p className="truncate text-sm font-bold text-foreground">{currentModule}</p>
          </div>
          <Badge tone="success">CG Studio</Badge>
        </div>
      </header>

      {mobileMenuOpen ? (
        <div
          className="fixed inset-0 z-50 bg-[#101820]/55 px-3 py-4 backdrop-blur-sm lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Growth Engine mobile navigation"
          id="mobile-growth-engine-menu"
        >
          <div className="ml-auto flex h-full w-full max-w-sm flex-col overflow-hidden rounded-[22px] border border-border bg-white shadow-[0_28px_90px_rgba(0,0,0,0.25)]">
            <div className="flex items-center justify-between gap-3 border-b border-border p-4">
              <div className="min-w-0">
                <BrandLogo variant="dark" className="h-10 max-w-[150px]" />
                <p className="mt-1 text-xs font-semibold text-muted">CG Studio active</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(false)}
                title="Close menu"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <nav className="flex-1 space-y-5 overflow-y-auto p-4">
              <MobileNavSection title="Primary">
                {primaryModules.map((item) => (
                  <MobileNavItem
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    active={pathname === item.href}
                    icon={iconMap[item.label]}
                    onNavigate={() => setMobileMenuOpen(false)}
                  />
                ))}
              </MobileNavSection>

              <MobileNavSection title="Active CG Studio Modules">
                {cgStudioModules
                  .filter((item) => item.status === "Active")
                  .map((item) => (
                    <MobileNavItem
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      active={pathname === item.href}
                      icon={iconMap[item.label]}
                      onNavigate={() => setMobileMenuOpen(false)}
                    />
                  ))}
              </MobileNavSection>

              <MobileNavSection title="Future Modules">
                {cgStudioModules
                  .filter((item) => item.status !== "Active")
                  .map((item) => (
                    <MobileNavItem
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      active={pathname === item.href}
                      icon={iconMap[item.label]}
                      trailing={<Badge tone="soon">Soon</Badge>}
                      onNavigate={() => setMobileMenuOpen(false)}
                    />
                  ))}
              </MobileNavSection>

              <MobileNavSection title="Wings">
                {wingCards.map((wing) => (
                  <MobileNavItem
                    key={wing.title}
                    href={wing.href}
                    label={wing.title}
                    active={pathname === wing.href}
                    icon={wing.title === "CG Studio" ? Sparkles : ChevronRight}
                    trailing={
                      <Badge tone={wing.status === "Active" ? "success" : "soon"}>
                        {wing.status}
                      </Badge>
                    }
                    onNavigate={() => setMobileMenuOpen(false)}
                  />
                ))}
              </MobileNavSection>
            </nav>
            <div className="border-t border-border p-4">
              <Button className="w-full" variant="secondary" onClick={logout}>
                <LogOut className="h-4 w-4" />
                Logout captain
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <main className="min-h-screen px-4 py-5 sm:px-6 lg:ml-72 lg:px-8 lg:py-7">
        <div className="mx-auto max-w-[1500px]">{children}</div>
      </main>
    </div>
  );
}

function getCurrentModuleLabel(pathname: string) {
  const allItems = [
    ...primaryModules,
    ...cgStudioModules,
    ...wingCards.map((wing) => ({ label: wing.title, href: wing.href })),
  ];
  const exact = allItems.find((item) => item.href === pathname);
  if (exact) return exact.label;
  if (pathname.startsWith("/leads/")) return "Lead Detail";
  if (pathname.startsWith("/clients/")) return "Client Profile";
  return "Growth Engine";
}

function SidebarSection({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div>
      {title ? (
        <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
          {title}
        </p>
      ) : null}
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function NavItem({
  href,
  label,
  active,
  icon: Icon,
  trailing,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: ComponentType<{ className?: string }>;
  trailing?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex min-h-11 items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition",
        active
          ? "bg-surface-strong text-white shadow-[0_16px_34px_rgba(17,26,32,0.2)]"
          : "text-muted hover:bg-surface-soft hover:text-foreground",
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", active && "text-accent")} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
    </Link>
  );
}

function MobileNavSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
        {title}
      </p>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function MobileNavItem({
  href,
  label,
  active,
  icon: Icon,
  trailing,
  onNavigate,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: ComponentType<{ className?: string }>;
  trailing?: ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition",
        active
          ? "bg-surface-strong text-white shadow-[0_12px_28px_rgba(17,26,32,0.18)]"
          : "bg-surface-soft text-muted hover:text-foreground",
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", active && "text-accent")} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
    </Link>
  );
}
