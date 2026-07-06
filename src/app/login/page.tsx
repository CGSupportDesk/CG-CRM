import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { LoginForm } from "./login-form";
import { BrandLogo } from "@/components/brand-logo";
import { Panel } from "@/components/ui";
import { isValidSession, SESSION_COOKIE } from "@/lib/auth";

export default async function LoginPage() {
  const cookieStore = await cookies();
  if (isValidSession(cookieStore.get(SESSION_COOKIE)?.value)) {
    redirect("/dashboard");
  }

  return (
    <main className="grid min-h-screen bg-background px-4 py-8 text-foreground lg:grid-cols-[1fr_1fr]">
      <section className="hidden flex-col justify-between rounded-[32px] bg-surface-strong p-10 text-white lg:flex">
        <Link href="/" className="flex items-center gap-3">
          <BrandLogo variant="light" className="h-16 max-w-[220px]" />
        </Link>
        <div>
          <h1 className="max-w-xl text-5xl font-semibold tracking-tight">
            CG Studio lead tracker, follow-ups, and reports in one calm workspace.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-[#cad6dc]">
            Phase 1 focuses on replacing the Excel tracker with a proper CRM flow.
            Future wings stay visible, but not overbuilt.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {["Leads", "Follow-ups", "Reports"].map((item) => (
            <div key={item} className="rounded-2xl bg-white/10 p-4">
              <p className="text-sm font-bold">{item}</p>
              <p className="mt-1 text-xs text-[#aebcc4]">Active</p>
            </div>
          ))}
        </div>
      </section>
      <section className="flex items-center justify-center">
        <Panel className="w-full max-w-md p-6">
          <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-muted">
            <ArrowLeft className="h-4 w-4" />
            Back to landing
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">Login</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Use the Phase 1 internal access for Growth Engine.
          </p>
          <div className="mt-8">
            <LoginForm />
          </div>
        </Panel>
      </section>
    </main>
  );
}
