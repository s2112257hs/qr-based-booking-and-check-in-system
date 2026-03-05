"use client";

import { Trip } from "@/types";

type TripActionModalProps = {
  isOpen: boolean;
  trip: Trip | null;
  canManageTrip: boolean;
  canManageBookings: boolean;
  canScanBookings: boolean;
  onClose: () => void;
  onOpenEditor: () => void;
  onOpenBookings: () => void;
  onOpenScan: () => void;
};

export function TripActionModal({
  isOpen,
  trip,
  canManageTrip,
  canManageBookings,
  canScanBookings,
  onClose,
  onOpenEditor,
  onOpenBookings,
  onOpenScan,
}: TripActionModalProps) {
  if (!isOpen || !trip) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-xl rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-xl font-semibold">Trip Actions</h3>
        <p className="mt-2 text-sm text-slate-600">
          {new Date(trip.date).toISOString().slice(0, 10)}{" "}
          {new Date(trip.start_time).toISOString().slice(11, 16)} | {trip.boat}
        </p>
        <div className="mt-6 grid grid-cols-1 gap-3">
          {canManageTrip && (
            <button
              className="rounded bg-indigo-700 px-4 py-2 text-white"
              onClick={onOpenEditor}
              type="button"
            >
              Manage Trip
            </button>
          )}
          {canManageBookings && (
            <button
              className="rounded bg-slate-900 px-4 py-2 text-white"
              onClick={onOpenBookings}
              type="button"
            >
              Manage Trip Bookings
            </button>
          )}
          {canScanBookings && (
            <button
              className="rounded bg-emerald-700 px-4 py-2 text-white"
              onClick={onOpenScan}
              type="button"
            >
              Scan Bookings
            </button>
          )}
          <button className="rounded border px-4 py-2" onClick={onClose} type="button">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
