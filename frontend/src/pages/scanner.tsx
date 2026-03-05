"use client";

import { useRequireAuth } from "@/hooks/use-route-guards";
import { useRouter } from "next/router";
import { useEffect } from "react";

export default function ScannerPage() {
  const { authorized } = useRequireAuth(["staff_scanner"]);
  const router = useRouter();

  useEffect(() => {
    if (!router.isReady || !authorized) return;
    router.replace("/scan");
  }, [authorized, router]);

  return null;
}
