"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { updateTrip } from "@/api/trips";
import { BoatName, Trip, TripTypeCode } from "@/types";
import { useEffect, useMemo, useState } from "react";
import { BOATS, TRIP_TYPES } from "./trip-config";

type ManageTripEditorModalProps = {
  token: string;
  trip: Trip | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
};

export function ManageTripEditorModal({
  token,
  trip,
  isOpen,
  onClose,
  onSuccess,
}: ManageTripEditorModalProps) {
  const [editDate, setEditDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editBoat, setEditBoat] = useState<BoatName>("W_speed");
  const [editPrimaryTripTypeCode, setEditPrimaryTripTypeCode] =
    useState<TripTypeCode>("DOLPHIN_CRUISE");
  const [editSecondaryTripTypeCode, setEditSecondaryTripTypeCode] = useState<
    TripTypeCode | ""
  >("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isOpen || !trip) return;

    setEditDate(new Date(trip.date).toISOString().slice(0, 10));
    setEditStartTime(new Date(trip.start_time).toISOString().slice(11, 16));
    setEditBoat(trip.boat);
    setEditPrimaryTripTypeCode(trip.trip_types[0]?.code ?? "DOLPHIN_CRUISE");
    setEditSecondaryTripTypeCode(trip.trip_types[1]?.code ?? "");
    setErrorMessage("");
  }, [isOpen, trip]);

  const editTripTypeCodes: TripTypeCode[] = useMemo(
    () =>
      editSecondaryTripTypeCode
        ? [editPrimaryTripTypeCode, editSecondaryTripTypeCode].filter(
            (value, index, arr) => arr.indexOf(value) === index,
          ) as TripTypeCode[]
        : [editPrimaryTripTypeCode],
    [editPrimaryTripTypeCode, editSecondaryTripTypeCode],
  );

  if (!isOpen || !trip) {
    return null;
  }

  async function onUpdateTrip() {
    if (!trip) return;

    if (editTripTypeCodes.length < 1 || editTripTypeCodes.length > 2) {
      setErrorMessage("Select 1 or 2 trip types.");
      return;
    }

    try {
      await updateTrip(token, trip.id, {
        date: editDate,
        startTime: editStartTime,
        boat: editBoat,
        tripTypeCodes: editTripTypeCodes,
      });
      await onSuccess();
      setErrorMessage("");
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to update trip.",
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-3xl rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">Manage Trip</h3>
          <button
            className="rounded border px-3 py-1 text-sm"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        {errorMessage && (
          <p className="mt-4 rounded bg-rose-700 px-4 py-2 text-sm text-white">
            {errorMessage}
          </p>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-700">Date</span>
            <input
              className="rounded border px-3 py-2"
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-700">Time</span>
            <input
              className="rounded border px-3 py-2"
              type="time"
              value={editStartTime}
              onChange={(e) => setEditStartTime(e.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-700">Boat</span>
            <select
              className="rounded border px-3 py-2"
              value={editBoat}
              onChange={(e) => setEditBoat(e.target.value as BoatName)}
            >
              {BOATS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-sm text-slate-700">Trip Type</span>
            <div className="flex flex-col gap-2">
              <select
                className="rounded border px-3 py-2"
                value={editPrimaryTripTypeCode}
                onChange={(e) =>
                  setEditPrimaryTripTypeCode(e.target.value as TripTypeCode)
                }
              >
                {TRIP_TYPES.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>
              <select
                className="rounded border px-3 py-2"
                value={editSecondaryTripTypeCode}
                onChange={(e) =>
                  setEditSecondaryTripTypeCode(e.target.value as TripTypeCode | "")
                }
              >
                <option value="">No second type</option>
                {TRIP_TYPES.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button
              className="rounded bg-indigo-700 px-5 py-2 text-white"
              onClick={() => void onUpdateTrip()}
              type="button"
            >
              Save Trip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
