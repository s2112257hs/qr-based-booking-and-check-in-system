"use client";

import { QrScanPanel } from "@/components/qr-scan-panel";

export function ScannerPanel({ token }: { token: string }) {
  return <QrScanPanel token={token} />;
}
