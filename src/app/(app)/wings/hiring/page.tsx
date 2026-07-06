import { ComingSoonPage } from "@/components/coming-soon-page";

export default function HiringWingPage() {
  return (
    <ComingSoonPage
      title="Hiring"
      badge="Coming Soon - Future Wing"
      previewCards={["Recruitment Leads", "Clients", "Job Openings", "Candidates", "Vendors", "Placement Tracking"]}
      wing
    />
  );
}
