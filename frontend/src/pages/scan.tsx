"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { QrScanPanel } from "@/components/qr-scan-panel";
import { useRequireAuth } from "@/hooks/use-route-guards";

export default function ScanPage() {
  const { auth, authorized } = useRequireAuth(["staff_scanner", "super_admin"]);

  if (!authorized) {
    return null;
  }

  return (
    <DashboardShell>
      <QrScanPanel token={auth.accessToken} />
    </DashboardShell>
  );
}
