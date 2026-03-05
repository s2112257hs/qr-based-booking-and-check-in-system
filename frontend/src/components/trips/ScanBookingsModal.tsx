"use client";

import { validateScan } from "@/api/scan";
import { ScanResponse, Trip } from "@/types";
import { FormEvent, useEffect, useId, useRef, useState } from "react";

type Html5QrcodeInstance = {
  start: (
    cameraConfig: { facingMode: string },
    config: { fps: number; qrbox: number | { width: number; height: number } },
    successCallback: (decodedText: string) => void,
    errorCallback: (error: string) => void,
  ) => Promise<unknown>;
  stop: () => Promise<unknown>;
  clear: () => void | Promise<unknown>;
};

type Html5QrcodeConstructor = new (elementId: string) => Html5QrcodeInstance;

type WindowWithHtml5Qr = Window & {
  Html5Qrcode?: Html5QrcodeConstructor;
};

type ScanBookingsModalProps = {
  token: string;
  trip: Trip | null;
  isOpen: boolean;
  onClose: () => void;
};

function loadHtml5QrcodeScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Scanner is only available in the browser."));
  }

  const typedWindow = window as WindowWithHtml5Qr;
  if (typedWindow.Html5Qrcode) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[data-html5-qrcode="true"]',
    ) as HTMLScriptElement | null;

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load QR scanner script.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "/vendor/html5-qrcode.min.js";
    script.async = true;
    script.dataset.html5Qrcode = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load QR scanner script."));
    document.body.appendChild(script);
  });
}

export function ScanBookingsModal({
  token,
  trip,
  isOpen,
  onClose,
}: ScanBookingsModalProps) {
  const [manualToken, setManualToken] = useState("");
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [status, setStatus] = useState("Ready to scan.");
  const [running, setRunning] = useState(false);
  const elementId = useId().replace(/:/g, "");
  const scannerRef = useRef<Html5QrcodeInstance | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setManualToken("");
    setResult(null);
    setStatus("Ready to scan.");
  }, [isOpen, trip?.id]);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        void scannerRef.current.stop().catch(() => undefined);
        void Promise.resolve(scannerRef.current.clear()).catch(() => undefined);
      }
    };
  }, []);

  if (!isOpen || !trip) {
    return null;
  }

  async function runValidation(scannedToken: string) {
    if (!trip) return;

    setStatus("Validating scan...");
    try {
      const data = await validateScan(token, {
        token: scannedToken,
        selectedTripId: trip.id,
      });
      setResult(data);
      setStatus(`Scan: ${data.result} (${data.reason})`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Scan failed.");
    }
  }

  async function stopScanner() {
    if (!scannerRef.current) return;
    try {
      await scannerRef.current.stop();
      await Promise.resolve(scannerRef.current.clear());
    } finally {
      scannerRef.current = null;
      setRunning(false);
    }
  }

  async function startScanner() {
    if (running) return;
    setStatus("Starting camera...");
    try {
      await loadHtml5QrcodeScript();
      const typedWindow = window as WindowWithHtml5Qr;
      if (!typedWindow.Html5Qrcode) {
        throw new Error("QR scanner failed to initialize.");
      }
      const scanner = new typedWindow.Html5Qrcode(`trip-scan-reader-${elementId}`);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        (decodedText) => {
          void stopScanner();
          void runValidation(decodedText);
        },
        () => undefined,
      );
      setRunning(true);
      setStatus("Scanning...");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not start scanner.");
    }
  }

  async function handleClose() {
    await stopScanner();
    onClose();
  }

  async function onScanNext() {
    setResult(null);
    setManualToken("");
    setStatus("Ready for next scan.");
    await startScanner();
  }

  async function onSubmitManual(e: FormEvent) {
    e.preventDefault();
    if (!manualToken.trim()) {
      setStatus("Enter a token first.");
      return;
    }
    await runValidation(manualToken.trim());
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-3xl rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">
            Scan Bookings ({trip.boat} | {new Date(trip.date).toISOString().slice(0, 10)}{" "}
            {new Date(trip.start_time).toISOString().slice(11, 16)})
          </h3>
          <button
            className="rounded border px-3 py-1 text-sm"
            onClick={() => void handleClose()}
            type="button"
          >
            Close
          </button>
        </div>

        <p className="mt-2 text-sm text-slate-600">{status}</p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            className="rounded bg-indigo-700 px-4 py-2 text-white"
            onClick={() => void startScanner()}
            type="button"
          >
            Scan QR Code
          </button>
          {running && (
            <button
              className="rounded bg-slate-700 px-4 py-2 text-white"
              onClick={() => void stopScanner()}
              type="button"
            >
              Stop
            </button>
          )}
        </div>

        <div className="mt-3">
          <div id={`trip-scan-reader-${elementId}`} className="max-w-sm" />
        </div>

        <form className="mt-3 flex flex-wrap items-end gap-3 border-t pt-3" onSubmit={onSubmitManual}>
          <label className="flex flex-col gap-1">
            <span className="text-sm">Manual token</span>
            <input
              className="rounded border px-3 py-2"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
            />
          </label>
          <button className="rounded bg-slate-900 px-4 py-2 text-white" type="submit">
            Validate
          </button>
        </form>

        {result && (
          <div className="mt-4 rounded border bg-slate-50 p-4">
            <p className="text-sm">
              <strong>{result.result}</strong> - {result.reason}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                className="rounded bg-emerald-700 px-4 py-2 text-white"
                onClick={() => void onScanNext()}
                type="button"
              >
                Scan Next
              </button>
              <button
                className="rounded border px-4 py-2"
                onClick={() => void handleClose()}
                type="button"
              >
                Go Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
