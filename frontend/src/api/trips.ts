import { apiUrl } from "@/api/client";
import { BoatName, Trip, TripDetails } from "@/types";
import { parseErrorMessage, withAuth } from "@/utils/http";

export async function listTrips(token: string): Promise<Trip[]> {
  const response = await fetch(apiUrl("/trips"), {
    headers: withAuth({}, token),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as Trip[];
}

export async function createTrip(
  token: string,
  input: { date: string; startTime: string; boat?: BoatName },
): Promise<Trip> {
  const response = await fetch(apiUrl("/trips"), {
    method: "POST",
    headers: withAuth({ "Content-Type": "application/json" }, token),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as Trip;
}

export async function getTripDetails(
  token: string,
  tripId: string,
): Promise<TripDetails> {
  const response = await fetch(apiUrl(`/trips/${tripId}`), {
    headers: withAuth({}, token),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as TripDetails;
}

export async function updateTrip(
  token: string,
  tripId: string,
  input: { date?: string; startTime?: string; boat?: BoatName },
): Promise<Trip> {
  const response = await fetch(apiUrl(`/trips/${tripId}`), {
    method: "PATCH",
    headers: withAuth({ "Content-Type": "application/json" }, token),
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as Trip;
}

export async function deleteTrip(token: string, tripId: string): Promise<void> {
  const response = await fetch(apiUrl(`/trips/${tripId}`), {
    method: "DELETE",
    headers: withAuth({}, token),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
}
