"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { TripsPageContent } from "@/components/trips-page-content";
import { useRequireAuth } from "@/hooks/use-route-guards";

export default function TripsPage() {
  const { auth, authorized } = useRequireAuth(["receptionist", "super_admin"]);

  if (!authorized) {
    return null;
  }

  return (
    <DashboardShell>
      <TripsPageContent token={auth.accessToken} canCreate />
    </DashboardShell>
  );
}
