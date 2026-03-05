"use client";

import { Trip } from "@/types";

type TripActionModalProps = {
  isOpen: boolean;
  trip: Trip | null;
  onClose: () => void;
  onOpenEditor: () => void;
  onOpenBookings: () => void;
};

export function TripActionModal({
  isOpen,
  trip,
  onClose,
  onOpenEditor,
  onOpenBookings,
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
          <button
            className="rounded bg-indigo-700 px-4 py-2 text-white"
            onClick={onOpenEditor}
            type="button"
          >
            Manage Trip
          </button>
          <button
            className="rounded bg-slate-900 px-4 py-2 text-white"
            onClick={onOpenBookings}
            type="button"
          >
            Manage Trip Bookings
          </button>
          <button className="rounded border px-4 py-2" onClick={onClose} type="button">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
