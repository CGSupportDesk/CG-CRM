import { ComingSoonPage } from "@/components/coming-soon-page";

export default function ProjectsPage() {
  return (
    <ComingSoonPage
      title="Projects"
      badge="Coming Soon - Phase 2"
      description="Track poster packages, website projects, branding work, revisions, approvals, and delivery status."
      previewCards={["Poster Packages", "Website Projects", "Branding Work", "Revisions and Approvals"]}
    />
  );
}
