import { ComingSoonPage } from "@/components/coming-soon-page";

export default function PaymentsPage() {
  return (
    <ComingSoonPage
      title="Payments"
      badge="Coming Soon - Phase 2"
      description="Track invoices, advances, balances, renewals, and overdue payments."
      previewCards={["Invoices", "Advances", "Balances", "Renewals"]}
    />
  );
}
