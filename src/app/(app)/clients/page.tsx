import { ComingSoonPage } from "@/components/coming-soon-page";

export default function ClientsPage() {
  return (
    <ComingSoonPage
      title="Clients"
      badge="Coming Soon - Phase 2"
      description="Manage converted clients, contact details, packages, renewals, and account ownership once Phase 2 is active."
      previewCards={["Converted Clients", "Packages", "Renewals", "Account Ownership"]}
    />
  );
}
