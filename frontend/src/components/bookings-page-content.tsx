"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import {
  createBooking,
  deleteBooking,
  listBookings,
  updateBooking,
} from "@/api/bookings";
import { listTrips } from "@/api/trips";
import { Booking, BookingResponse, BookingStatus, Trip } from "@/types";
import { FormEvent, useEffect, useState } from "react";

export function BookingsPageContent({
  token,
  canManageAll,
}: {
  token: string;
  canManageAll: boolean;
}) {
  const [status, setStatus] = useState("Bookings");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingResult, setBookingResult] = useState<BookingResponse | null>(null);

  const [guestName, setGuestName] = useState("");
  const [adultPaxCount, setAdultPaxCount] = useState(1);
  const [childrenPaxCount, setChildrenPaxCount] = useState(0);
  const [inhouse, setInhouse] = useState(true);
  const [guesthouseName, setGuesthouseName] = useState("");

  async function refreshTrips() {
    try {
      const data = await listTrips(token);
      setTrips(data);
      if (!selectedTripId && data[0]) {
        setSelectedTripId(data[0].id);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load trips.");
    }
  }

  async function refreshBookings(tripId: string) {
    if (!tripId) return;
    try {
      const data = await listBookings(token, tripId);
      setBookings(data);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Failed to load bookings.",
      );
    }
  }

  useEffect(() => {
    void refreshTrips();
  }, [token]);

  useEffect(() => {
    void refreshBookings(selectedTripId);
  }, [selectedTripId]);

  async function onCreateBooking(e: FormEvent) {
    e.preventDefault();
    if (!selectedTripId) {
      setStatus("Select a trip.");
      return;
    }
    setStatus("Creating booking...");
    try {
      const data = await createBooking(token, {
        tripId: selectedTripId,
        guestName,
        adultPaxCount,
        childrenPaxCount,
        inhouse,
        guesthouseName: inhouse ? undefined : guesthouseName,
      });
      setBookingResult(data);
      setStatus("Booking created.");
      await refreshBookings(selectedTripId);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Booking creation failed.");
    }
  }

  async function onUpdateStatus(booking: Booking, statusValue: BookingStatus) {
    setStatus("Updating booking...");
    try {
      await updateBooking(token, booking.id, {
        guestName: booking.guest_name,
        adultPaxCount: booking.adult_pax_count,
        childrenPaxCount: booking.children_pax_count,
        inhouse: booking.inhouse,
        guesthouseName: booking.guesthouse_name,
        status: statusValue,
      });
      setStatus("Booking updated.");
      await refreshBookings(selectedTripId);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Booking update failed.");
    }
  }

  async function onDeleteBooking(bookingId: string) {
    if (!window.confirm("Delete booking?")) return;
    setStatus("Deleting booking...");
    try {
      await deleteBooking(token, bookingId);
      setStatus("Booking deleted.");
      await refreshBookings(selectedTripId);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Booking deletion failed.");
    }
  }

  return (
    <div className="space-y-6">
      <p className="rounded bg-slate-900 px-4 py-2 text-sm text-white">{status}</p>

      <section id="bookings" className="rounded-lg bg-white p-4 shadow">
        <h2 className="text-xl font-semibold">Create Booking</h2>
        <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={onCreateBooking}>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-700">Trip</span>
            <select
              className="rounded border px-3 py-2"
              value={selectedTripId}
              onChange={(e) => setSelectedTripId(e.target.value)}
            >
              {trips.map((trip, index) => (
                <option key={trip.id} value={trip.id}>
                  Trip {index + 1} - {new Date(trip.date).toISOString().slice(0, 10)}{" "}
                  {new Date(trip.start_time).toISOString().slice(11, 16)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-700">Lead Guest Name</span>
            <input
              className="rounded border px-3 py-2"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-700">Adult Pax Count</span>
            <input
              className="w-32 rounded border px-3 py-2"
              min={1}
              type="number"
              value={adultPaxCount}
              onChange={(e) => setAdultPaxCount(Number(e.target.value) || 1)}
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-700">Children Pax Count</span>
            <input
              className="w-36 rounded border px-3 py-2"
              min={0}
              type="number"
              value={childrenPaxCount}
              onChange={(e) => setChildrenPaxCount(Number(e.target.value) || 0)}
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-700">In-house</span>
            <input
              checked={inhouse}
              onChange={(e) => setInhouse(e.target.checked)}
              type="checkbox"
              className="h-5 w-5"
            />
          </label>
          {!inhouse && (
            <label className="flex flex-col gap-1">
              <span className="text-sm text-slate-700">Guesthouse Name</span>
              <input
                className="rounded border px-3 py-2"
                value={guesthouseName}
                onChange={(e) => setGuesthouseName(e.target.value)}
              />
            </label>
          )}
          <button className="rounded bg-blue-700 px-4 py-2 text-white" type="submit">
            Create Booking
          </button>
        </form>

        {bookingResult && (
          <p className="mt-3 text-sm">
            Ticket token: {bookingResult.token}
          </p>
        )}
      </section>

      <section className="rounded-lg bg-white p-4 shadow">
        <h2 className="text-xl font-semibold">View Bookings</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {bookings.map((booking) => (
            <li className="rounded border p-2" key={booking.id}>
              <div>
                {booking.guest_name} | {booking.status} | adults{" "}
                {booking.adult_pax_count}, children {booking.children_pax_count}
              </div>
              {canManageAll && (
                <div className="mt-2 flex items-center gap-2">
                  <span>Status:</span>
                  <select
                    className="rounded border px-2 py-1"
                    value={booking.status}
                    onChange={(e) =>
                      void onUpdateStatus(
                        booking,
                        e.target.value as BookingStatus,
                      )
                    }
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="CANCELLED">CANCELLED</option>
                    <option value="CHECKED_IN">CHECKED_IN</option>
                  </select>
                  <button
                    className="rounded bg-rose-700 px-3 py-1 text-white"
                    onClick={() => void onDeleteBooking(booking.id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
