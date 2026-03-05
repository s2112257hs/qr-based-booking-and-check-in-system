"use client";

import { useRequireAuth } from "@/hooks/use-route-guards";
import { useRouter } from "next/router";
import { useEffect } from "react";

export default function ReceptionistPage() {
  const { authorized } = useRequireAuth(["receptionist"]);
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady || !authorized) return;
    router.replace("/trips");
  }, [authorized, router]);

  return null;
}
