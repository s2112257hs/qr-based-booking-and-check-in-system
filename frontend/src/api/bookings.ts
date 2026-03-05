import { apiUrl } from "@/api/client";
import {
  Booking,
  BookingResponse,
  BookingStatus,
  TicketEmailDelivery,
} from "@/types";
import { parseErrorMessage, withAuth } from "@/utils/http";

export async function createBooking(
  token: string,
  input: {
    tripId: string;
    guestName: string;
    guestEmail: string;
    adultPaxCount: number;
    childrenPaxCount: number;
    inhouse: boolean;
    guesthouseName?: string;
    sendTicketEmail?: boolean;
  },
): Promise<BookingResponse> {
  const response = await fetch(apiUrl("/bookings"), {
    method: "POST",
    headers: withAuth({ "Content-Type": "application/json" }, token),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as BookingResponse;
}

export async function cancelBooking(
  token: string,
  bookingId: string,
): Promise<void> {
  const response = await fetch(apiUrl(`/bookings/${bookingId}/cancel`), {
    method: "PATCH",
    headers: withAuth({}, token),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
}

export async function listBookings(
  token: string,
  tripId?: string,
): Promise<Booking[]> {
  const query = tripId ? `?tripId=${encodeURIComponent(tripId)}` : "";
  const response = await fetch(apiUrl(`/bookings${query}`), {
    headers: withAuth({}, token),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as Booking[];
}

export async function updateBooking(
  token: string,
  bookingId: string,
  input: {
    tripId?: string;
    guestName?: string;
    guestEmail?: string;
    adultPaxCount?: number;
    childrenPaxCount?: number;
    inhouse?: boolean;
    guesthouseName?: string;
    status?: BookingStatus;
  },
): Promise<Booking> {
  const response = await fetch(apiUrl(`/bookings/${bookingId}`), {
    method: "PATCH",
    headers: withAuth({ "Content-Type": "application/json" }, token),
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as Booking;
}

export async function deleteBooking(
  token: string,
  bookingId: string,
): Promise<void> {
  const response = await fetch(apiUrl(`/bookings/${bookingId}`), {
    method: "DELETE",
    headers: withAuth({}, token),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
}

export async function sendBookingTicketEmail(
  token: string,
  bookingId: string,
  email?: string,
): Promise<TicketEmailDelivery> {
  const response = await fetch(apiUrl(`/bookings/${bookingId}/send-ticket`), {
    method: "POST",
    headers: withAuth({ "Content-Type": "application/json" }, token),
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as TicketEmailDelivery;
}
