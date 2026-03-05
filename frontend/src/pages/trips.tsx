"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { TripsPageContent } from "@/components/trips-page-content";
import { useRequireAuth } from "@/hooks/use-route-guards";

export default function TripsPage() {
  const { auth, authorized } = useRequireAuth([
    "receptionist",
    "super_admin",
    "staff_scanner",
  ]);

  if (!authorized) {
    return null;
  }

  const canManage = auth.role === "receptionist" || auth.role === "super_admin";

  return (
    <DashboardShell>
      <TripsPageContent
        token={auth.accessToken}
        canCreate={canManage}
        canManageTrip={canManage}
        canManageBookings={canManage}
        canScanBookings
      />
    </DashboardShell>
  );
}
