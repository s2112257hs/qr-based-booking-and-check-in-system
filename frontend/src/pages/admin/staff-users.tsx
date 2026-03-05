"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { useRequireAuth } from "@/hooks/use-route-guards";

export default function AdminStaffUsersPage() {
  const { authorized } = useRequireAuth(["super_admin"]);

  if (!authorized) {
    return null;
  }

  return (
    <DashboardShell>
      <section id="staff-users" className="rounded-lg bg-white p-4 shadow">
        <h2 className="text-xl font-semibold">Staff Users</h2>
        <p className="mt-2 text-sm text-slate-600">
          Staff account administration can be managed here.
        </p>
      </section>
    </DashboardShell>
  );
}
