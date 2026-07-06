import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { CRMProvider } from "@/components/crm-provider";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  if (!isValidSession(cookieStore.get(SESSION_COOKIE)?.value)) {
    redirect("/login");
  }

  return (
    <CRMProvider>
      <AppShell>{children}</AppShell>
    </CRMProvider>
  );
}
