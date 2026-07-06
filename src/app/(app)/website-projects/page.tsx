import { ComingSoonPage } from "@/components/coming-soon-page";

export default function WebsiteProjectsPage() {
  return (
    <ComingSoonPage
      title="Website Projects"
      badge="Coming Soon - Phase 2"
      description="Manage website pages, content collection, design status, development progress, and deployment."
      previewCards={["Website Pages", "Content Collection", "Design Status", "Deployment"]}
    />
  );
}
