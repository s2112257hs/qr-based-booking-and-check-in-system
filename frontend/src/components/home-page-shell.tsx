"use client";

import { AdminPanel } from "@/components/admin-panel";
import { LoginScreen } from "@/components/login-screen";
import { ReceptionistPanel } from "@/components/receptionist-panel";
import { ScannerPanel } from "@/components/scanner-panel";
import { AuthProvider, useAuth } from "@/context/auth-context";

function RoleApp() {
  const auth = useAuth();

  if (!auth.accessToken || !auth.role) {
    return <LoginScreen />;
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-center justify-between rounded-lg bg-white p-4 shadow">
          <h1 className="text-2xl font-bold">QR Booking and Check-In</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm">
              {auth.username} ({auth.role})
            </span>
            <button
              className="rounded bg-slate-900 px-4 py-2 text-white"
              onClick={auth.logout}
              type="button"
            >
              Logout
            </button>
          </div>
        </header>

        {auth.role === "receptionist" && <ReceptionistPanel token={auth.accessToken} />}
        {auth.role === "staff_scanner" && <ScannerPanel token={auth.accessToken} />}
        {auth.role === "super_admin" && <AdminPanel token={auth.accessToken} />}
      </div>
    </main>
  );
}

export function HomePageShell() {
  return (
    <AuthProvider>
      <RoleApp />
    </AuthProvider>
  );
}
