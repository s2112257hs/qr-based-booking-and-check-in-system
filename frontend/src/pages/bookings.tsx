"use client";

import { BookingsPageContent } from "@/components/bookings-page-content";
import { DashboardShell } from "@/components/dashboard-shell";
import { useRequireAuth } from "@/hooks/use-route-guards";

export default function BookingsPage() {
  const { auth, authorized } = useRequireAuth(["receptionist", "super_admin"]);

  if (!authorized) {
    return null;
  }

  return (
    <DashboardShell>
      <BookingsPageContent
        token={auth.accessToken}
        canManageAll={auth.role === "super_admin"}
      />
    </DashboardShell>
  );
}
