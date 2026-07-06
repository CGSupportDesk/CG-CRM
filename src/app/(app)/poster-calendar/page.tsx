import { ComingSoonPage } from "@/components/coming-soon-page";

export default function PosterCalendarPage() {
  return (
    <ComingSoonPage
      title="Poster Calendar"
      badge="Coming Soon - Phase 2"
      description="Plan monthly posts, assign designers, track approvals, and manage scheduled content."
      previewCards={["Monthly Posts", "Designer Assignment", "Approvals", "Scheduled Content"]}
    />
  );
}
