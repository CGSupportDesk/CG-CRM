import { ComingSoonPage } from "@/components/coming-soon-page";

export default function SettingsPage() {
  return (
    <ComingSoonPage
      title="Settings"
      badge="Coming Soon - Phase 2"
      description="Manage packages, users, lead sources, industries, and system preferences."
      previewCards={["Packages", "Users", "Lead Sources", "System Preferences"]}
    />
  );
}
