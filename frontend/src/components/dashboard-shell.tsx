"use client";

import { useAuth } from "@/context/auth-context";
import { Role } from "@/types";
import Link from "next/link";
import { useRouter } from "next/router";
import { ReactNode, useMemo, useState } from "react";

type NavItem = { label: string; href: string };

function navItemsForRole(role: Role): NavItem[] {
  if (role === "receptionist") {
    return [
      { label: "Trips", href: "/trips" },
      { label: "Bookings", href: "/bookings" },
    ];
  }
  if (role === "staff_scanner") {
    return [{ label: "Scan Boarding Pass", href: "/scan" }];
  }
  return [
    { label: "Trips", href: "/trips" },
    { label: "Bookings", href: "/bookings" },
    { label: "Scan Boarding Pass", href: "/scan" },
    { label: "Monthly Reports", href: "/admin/reports" },
    { label: "Staff Users", href: "/admin/staff-users" },
  ];
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const navItems = useMemo(
    () => (auth.role ? navItemsForRole(auth.role) : []),
    [auth.role],
  );

  return (
    <main className="h-screen overflow-hidden bg-slate-100 text-slate-900">
      <div className="h-full">
        {navOpen && (
          <button
            aria-label="Close navigation"
            className="fixed inset-0 z-30 bg-black/35"
            onClick={() => setNavOpen(false)}
            type="button"
          />
        )}
        <aside
          className={`fixed left-0 top-0 z-40 h-full w-64 border-r bg-white p-4 shadow transition-transform ${
            navOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Navigation</h2>
            <button
              className="rounded border px-2 py-1 text-xs"
              onClick={() => setNavOpen(false)}
              type="button"
            >
              Close
            </button>
          </div>
          <nav className="mt-4 space-y-2">
            {navItems.map((item) => {
              const active = router.pathname === item.href.split("#")[0];
              return (
                <Link
                  className={`block rounded px-3 py-2 text-sm ${
                    active ? "bg-slate-900 text-white" : "bg-slate-100"
                  }`}
                  href={item.href}
                  key={item.href}
                  onClick={() => setNavOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <section className="flex h-full w-full flex-col">
          <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-3">
            <div className="flex items-center gap-3">
              <button
                className="rounded bg-slate-900 px-4 py-2 text-sm text-white"
                onClick={() => setNavOpen((v) => !v)}
                type="button"
              >
                Navigation
              </button>
              <h1 className="text-xl font-bold">QR Booking and Check-In</h1>
            </div>
            <div className="relative">
              <button
                className="rounded bg-slate-900 px-4 py-2 text-sm text-white"
                onClick={() => setProfileOpen((v) => !v)}
                type="button"
              >
                {auth.username || "Profile"}
              </button>
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-44 rounded border bg-white p-2 shadow">
                  <p className="px-2 py-1 text-xs text-slate-500">{auth.role}</p>
                  <button
                    className="w-full rounded bg-rose-700 px-3 py-2 text-left text-sm text-white"
                    onClick={auth.logout}
                    type="button"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-hidden p-6">{children}</div>
        </section>
      </div>
    </main>
  );
}
