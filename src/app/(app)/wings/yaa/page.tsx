import { ComingSoonPage } from "@/components/coming-soon-page";

export default function YaaWingPage() {
  return (
    <ComingSoonPage
      title="YAA"
      badge="Coming Soon - Future Wing"
      previewCards={["Student Leads", "Program Enquiries", "Onboarding", "Progress Tracking"]}
      wing
    />
  );
}
