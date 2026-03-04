"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { createBooking, listBookings } from "@/api/bookings";
import { createTrip, listTrips } from "@/api/trips";
import { BoatName, Booking, BookingResponse, Trip } from "@/types";
import { FormEvent, useEffect, useState } from "react";

const BOATS: BoatName[] = ["W_speed", "Hiriwave", "Small_speed"];

export function ReceptionistPanel({ token }: { token: string }) {
  const [status, setStatus] = useState("Receptionist dashboard.");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedTripId, setSelectedTripId] = useState("");
  const [bookingResult, setBookingResult] = useState<BookingResponse | null>(null);

  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [boat, setBoat] = useState<BoatName | "">("");

  const [guestName, setGuestName] = useState("");
  const [paxCount, setPaxCount] = useState(1);
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
      setStatus(error instanceof Error ? error.message : "Failed to load bookings.");
    }
  }

  useEffect(() => {
    void refreshTrips();
  }, [token]);

  useEffect(() => {
    void refreshBookings(selectedTripId);
  }, [selectedTripId]);

  async function onCreateTrip(e: FormEvent) {
    e.preventDefault();
    setStatus("Creating trip...");
    try {
      await createTrip(token, {
        date,
        startTime,
        boat: boat || undefined,
      });
      setStatus("Trip created.");
      await refreshTrips();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Trip creation failed.");
    }
  }

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
        paxCount,
        inhouse,
        guesthouseName: inhouse ? undefined : guesthouseName,
      });
      setBookingResult(data);
      setStatus(`Booking created: ${data.booking.id}`);
      await refreshBookings(selectedTripId);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Booking creation failed.");
    }
  }

  return (
    <div className="space-y-6">
      <p className="rounded bg-slate-900 px-4 py-2 text-sm text-white">{status}</p>

      <section className="rounded-lg bg-white p-4 shadow">
        <h2 className="text-xl font-semibold">Trips</h2>
        <div className="mt-3">
          <button className="rounded bg-slate-700 px-4 py-2 text-white" onClick={() => void refreshTrips()} type="button">
            Refresh Trips
          </button>
        </div>
        <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={onCreateTrip}>
          <input className="rounded border px-3 py-2" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <input className="rounded border px-3 py-2" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
          <select className="rounded border px-3 py-2" value={boat} onChange={(e) => setBoat((e.target.value as BoatName | "") || "")}>
            <option value="">Default (W_speed)</option>
            {BOATS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <button className="rounded bg-emerald-700 px-4 py-2 text-white" type="submit">
            Create Trip
          </button>
        </form>
        <ul className="mt-3 space-y-2 text-sm">
          {trips.map((trip) => (
            <li
              className={`rounded border p-2 ${selectedTripId === trip.id ? "border-indigo-500" : ""}`}
              key={trip.id}
            >
              <button className="text-left" onClick={() => setSelectedTripId(trip.id)} type="button">
                {trip.id} | {new Date(trip.date).toISOString().slice(0, 10)} | {trip.boat}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg bg-white p-4 shadow">
        <h2 className="text-xl font-semibold">Bookings</h2>
        <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={onCreateBooking}>
          <input className="rounded border px-3 py-2" placeholder="Guest name" value={guestName} onChange={(e) => setGuestName(e.target.value)} required />
          <input className="w-24 rounded border px-3 py-2" min={1} type="number" value={paxCount} onChange={(e) => setPaxCount(Number(e.target.value) || 1)} required />
          <label className="flex items-center gap-2">
            <input checked={inhouse} onChange={(e) => setInhouse(e.target.checked)} type="checkbox" />
            In-house
          </label>
          {!inhouse && (
            <input className="rounded border px-3 py-2" placeholder="Guesthouse name" value={guesthouseName} onChange={(e) => setGuesthouseName(e.target.value)} />
          )}
          <button className="rounded bg-blue-700 px-4 py-2 text-white" type="submit">
            Create Booking
          </button>
        </form>
        {bookingResult && (
          <p className="mt-3 text-sm">
            Booking: {bookingResult.booking.id} | Token: {bookingResult.token}
          </p>
        )}
        <ul className="mt-3 space-y-2 text-sm">
          {bookings.map((booking) => (
            <li className="rounded border p-2" key={booking.id}>
              {booking.id} | {booking.guest_name} | {booking.status} | pax {booking.pax_count}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
