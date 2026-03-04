"use client";

import { FormEvent, useState } from "react";
import { useAuth } from "@/context/auth-context";

export function LoginScreen() {
  const auth = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState(
    "Use valid username and password to log in.",
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("Logging in...");
    try {
      const role = await auth.login(username, password);
      setStatus(`Logged in as ${role}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Login failed.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 text-slate-900">
      <div className="mx-auto max-w-xl rounded-xl bg-white p-6 shadow">
        <h1 className="text-2xl font-bold">QR Booking System</h1>
        <p className="mt-2 text-sm text-slate-600">{status}</p>
        <form className="mt-5 space-y-3" onSubmit={onSubmit}>
          <label className="flex flex-col gap-1">
            <span className="text-sm">Username</span>
            <input
              className="rounded border px-3 py-2"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm">Password</span>
            <input
              className="rounded border px-3 py-2"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button className="rounded bg-slate-900 px-4 py-2 text-white" type="submit">
            Login
          </button>
        </form>
      </div>
    </main>
  );
}
