"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { deleteBooking, listBookings, updateBooking } from "@/api/bookings";
import { listScanLogs } from "@/api/scan";
import {
  createTrip,
  deleteTrip,
  getTripDetails,
  listTrips,
  updateTrip,
} from "@/api/trips";
import { BoatName, Booking, BookingStatus, CheckinLog, Trip, TripDetails } from "@/types";
import { FormEvent, useEffect, useState } from "react";
import { QrScanPanel } from "@/components/qr-scan-panel";

const BOATS: BoatName[] = ["W_speed", "Hiriwave", "Small_speed"];

export function AdminPanel({ token }: { token: string }) {
  const [status, setStatus] = useState("super_admin dashboard.");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState("");
  const [details, setDetails] = useState<TripDetails | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [logs, setLogs] = useState<CheckinLog[]>([]);

  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newBoat, setNewBoat] = useState<BoatName | "">("");

  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editBoat, setEditBoat] = useState<BoatName | "">("");

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

  async function refreshSelectedTrip(tripId: string) {
    if (!tripId) return;
    try {
      const [tripDetails, bookingRows, scanRows] = await Promise.all([
        getTripDetails(token, tripId),
        listBookings(token, tripId),
        listScanLogs(token, tripId),
      ]);
      setDetails(tripDetails);
      setBookings(bookingRows);
      setLogs(scanRows);
      setEditDate(new Date(tripDetails.date).toISOString().slice(0, 10));
      setEditTime(new Date(tripDetails.start_time).toISOString().slice(11, 16));
      setEditBoat(tripDetails.boat);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to load trip details.");
    }
  }

  useEffect(() => {
    void refreshTrips();
  }, [token]);

  useEffect(() => {
    void refreshSelectedTrip(selectedTripId);
  }, [selectedTripId]);

  async function onCreateTrip(e: FormEvent) {
    e.preventDefault();
    setStatus("Creating trip...");
    try {
      await createTrip(token, {
        date: newDate,
        startTime: newTime,
        boat: newBoat || undefined,
      });
      setStatus("Trip created.");
      await refreshTrips();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Trip creation failed.");
    }
  }

  async function onUpdateTrip() {
    if (!selectedTripId) return;
    setStatus("Updating trip...");
    try {
      await updateTrip(token, selectedTripId, {
        date: editDate,
        startTime: editTime,
        boat: editBoat || undefined,
      });
      setStatus("Trip updated.");
      await refreshTrips();
      await refreshSelectedTrip(selectedTripId);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Trip update failed.");
    }
  }

  async function onDeleteTrip() {
    if (!selectedTripId) return;
    if (!window.confirm("Delete this trip and related records?")) return;
    setStatus("Deleting trip...");
    try {
      await deleteTrip(token, selectedTripId);
      setStatus("Trip deleted.");
      setSelectedTripId("");
      setDetails(null);
      setBookings([]);
      setLogs([]);
      await refreshTrips();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Trip deletion failed.");
    }
  }

  async function onUpdateBooking(booking: Booking, statusValue: BookingStatus) {
    setStatus(`Updating booking ${booking.id}...`);
    try {
      await updateBooking(token, booking.id, {
        guestName: booking.guest_name,
        paxCount: booking.pax_count,
        inhouse: booking.inhouse,
        guesthouseName: booking.guesthouse_name,
        status: statusValue,
      });
      setStatus("Booking updated.");
      await refreshSelectedTrip(selectedTripId);
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
      await refreshSelectedTrip(selectedTripId);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Booking deletion failed.");
    }
  }

  return (
    <div className="space-y-6">
      <p className="rounded bg-slate-900 px-4 py-2 text-sm text-white">{status}</p>

      <section className="rounded-lg bg-white p-4 shadow">
        <h2 className="text-xl font-semibold">Trips (All)</h2>
        <div className="mt-3">
          <button className="rounded bg-slate-700 px-4 py-2 text-white" onClick={() => void refreshTrips()} type="button">
            Refresh Trips
          </button>
        </div>
        <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={onCreateTrip}>
          <input className="rounded border px-3 py-2" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} required />
          <input className="rounded border px-3 py-2" type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} required />
          <select className="rounded border px-3 py-2" value={newBoat} onChange={(e) => setNewBoat((e.target.value as BoatName | "") || "")}>
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

      {details && (
        <section className="rounded-lg bg-white p-4 shadow">
          <h2 className="text-xl font-semibold">Selected Trip Details</h2>
          <p className="mt-2 text-sm">
            {details.id} | {new Date(details.date).toISOString().slice(0, 10)} |{" "}
            {new Date(details.start_time).toISOString().slice(11, 16)} | {details.boat}
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <input className="rounded border px-3 py-2" type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            <input className="rounded border px-3 py-2" type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} />
            <select className="rounded border px-3 py-2" value={editBoat} onChange={(e) => setEditBoat((e.target.value as BoatName | "") || "")}>
              {BOATS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <button className="rounded bg-amber-700 px-4 py-2 text-white" onClick={() => void onUpdateTrip()} type="button">
              Edit Trip
            </button>
            <button className="rounded bg-rose-700 px-4 py-2 text-white" onClick={() => void onDeleteTrip()} type="button">
              Delete Trip
            </button>
          </div>
        </section>
      )}

      <section className="rounded-lg bg-white p-4 shadow">
        <h2 className="text-xl font-semibold">Bookings For Selected Trip</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {bookings.map((booking) => (
            <li className="rounded border p-2" key={booking.id}>
              <div>
                {booking.id} | {booking.guest_name} | pax {booking.pax_count}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span>Status:</span>
                <select
                  className="rounded border px-2 py-1"
                  value={booking.status}
                  onChange={(e) => void onUpdateBooking(booking, e.target.value as BookingStatus)}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="CANCELLED">CANCELLED</option>
                  <option value="CHECKED_IN">CHECKED_IN</option>
                </select>
                <button className="rounded bg-rose-700 px-3 py-1 text-white" onClick={() => void onDeleteBooking(booking.id)} type="button">
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg bg-white p-4 shadow">
        <h2 className="text-xl font-semibold">Scanner Logs For Selected Trip</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {logs.map((log) => (
            <li className="rounded border p-2" key={log.id}>
              {new Date(log.scanned_at).toLocaleString()} | booking {log.booking_id} |{" "}
              {log.result} ({log.reason}) | scanner {log.scanned_by_user_id}
            </li>
          ))}
        </ul>
      </section>

      <QrScanPanel token={token} />
    </div>
  );
}
