"use client";

import { listTrips } from "@/api/trips";
import { validateScan } from "@/api/scan";
import { ScanResponse, Trip } from "@/types";
import { useEffect, useId, useRef, useState } from "react";

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

export function QrScanPanel({ token }: { token: string }) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState("");
  const [manualToken, setManualToken] = useState("");
  const [result, setResult] = useState<ScanResponse | null>(null);
  const [status, setStatus] = useState("Select trip and scan.");
  const [running, setRunning] = useState(false);

  const elementId = useId().replace(/:/g, "");
  const scannerRef = useRef<Html5QrcodeInstance | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const data = await listTrips(token);
        setTrips(data);
        if (data[0]) {
          setSelectedTripId(data[0].id);
        }
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Failed to load trips.");
      }
    })();
  }, [token]);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        void scannerRef.current.stop().catch(() => undefined);
        void Promise.resolve(scannerRef.current.clear()).catch(() => undefined);
      }
    };
  }, []);

  async function runValidation(scannedToken: string) {
    if (!selectedTripId) {
      setStatus("Select a trip first.");
      return;
    }
    setStatus("Validating scan...");
    try {
      const data = await validateScan(token, {
        token: scannedToken,
        selectedTripId,
      });
      setResult(data);
      setStatus(`Scan: ${data.result} (${data.reason})`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Scan failed.");
    }
  }

  async function startScanner() {
    if (running) {
      return;
    }
    setStatus("Starting camera...");
    try {
      const mod = await import("html5-qrcode");
      const scanner = new mod.Html5Qrcode(
        `qr-reader-${elementId}`,
      ) as unknown as Html5QrcodeInstance;
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

  async function stopScanner() {
    if (!scannerRef.current) {
      return;
    }
    try {
      await scannerRef.current.stop();
      await Promise.resolve(scannerRef.current.clear());
    } finally {
      scannerRef.current = null;
      setRunning(false);
    }
  }

  return (
    <section className="rounded-lg bg-white p-4 shadow">
      <h2 className="text-xl font-semibold">Scan</h2>
      <p className="mt-1 text-sm text-slate-600">{status}</p>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm">Trip</span>
          <select
            className="rounded border px-3 py-2"
            value={selectedTripId}
            onChange={(e) => setSelectedTripId(e.target.value)}
          >
            {trips.map((trip) => (
              <option key={trip.id} value={trip.id}>
                {trip.id} - {new Date(trip.date).toISOString().slice(0, 10)}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded bg-indigo-700 px-4 py-2 text-white" onClick={startScanner} type="button">
          Scan QR Code
        </button>
        {running && (
          <button className="rounded bg-slate-700 px-4 py-2 text-white" onClick={() => void stopScanner()} type="button">
            Stop
          </button>
        )}
      </div>

      <div className="mt-3">
        <div id={`qr-reader-${elementId}`} className="max-w-sm" />
      </div>

      <form
        className="mt-3 flex flex-wrap items-end gap-3 border-t pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          void runValidation(manualToken);
        }}
      >
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
        <p className="mt-3 text-sm">
          <strong>{result.result}</strong> - {result.reason}
        </p>
      )}
    </section>
  );
}
