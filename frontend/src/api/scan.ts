import { apiUrl } from "@/api/client";
import { CheckinLog, ScanResponse } from "@/types";
import { parseErrorMessage, withAuth } from "@/utils/http";

export async function validateScan(
  token: string,
  input: { token: string; selectedTripId: string },
): Promise<ScanResponse> {
  const response = await fetch(apiUrl("/scan"), {
    method: "POST",
    headers: withAuth({ "Content-Type": "application/json" }, token),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as ScanResponse;
}

export async function listScanLogs(
  token: string,
  tripId?: string,
): Promise<CheckinLog[]> {
  const query = tripId ? `?tripId=${encodeURIComponent(tripId)}` : "";
  const response = await fetch(apiUrl(`/scan/logs${query}`), {
    headers: withAuth({}, token),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as CheckinLog[];
}
