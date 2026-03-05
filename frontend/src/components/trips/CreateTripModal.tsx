"use client";

import { createTrip } from "@/api/trips";
import { BoatName, TripTypeCode } from "@/types";
import { FormEvent, useState } from "react";
import { BOATS, TRIP_TYPES } from "./trip-config";

type CreateTripModalProps = {
  token: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
};

export function CreateTripModal({
  token,
  isOpen,
  onClose,
  onSuccess,
}: CreateTripModalProps) {
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [boat, setBoat] = useState<BoatName>("W_speed");
  const [primaryTripTypeCode, setPrimaryTripTypeCode] =
    useState<TripTypeCode>("DOLPHIN_CRUISE");
  const [secondaryTripTypeCode, setSecondaryTripTypeCode] = useState<
    TripTypeCode | ""
  >("");
  const [errorMessage, setErrorMessage] = useState("");

  if (!isOpen) {
    return null;
  }

  const tripTypeCodes: TripTypeCode[] = secondaryTripTypeCode
    ? [primaryTripTypeCode, secondaryTripTypeCode].filter(
        (value, index, arr) => arr.indexOf(value) === index,
      ) as TripTypeCode[]
    : [primaryTripTypeCode];

  async function onCreateTrip(e: FormEvent) {
    e.preventDefault();
    if (tripTypeCodes.length < 1 || tripTypeCodes.length > 2) {
      setErrorMessage("Select 1 or 2 trip types.");
      return;
    }

    setErrorMessage("");
    try {
      await createTrip(token, {
        date,
        startTime,
        boat,
        tripTypeCodes,
      });

      setDate("");
      setStartTime("");
      setBoat("W_speed");
      setPrimaryTripTypeCode("DOLPHIN_CRUISE");
      setSecondaryTripTypeCode("");
      onClose();
      await onSuccess();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Trip creation failed.",
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-4xl rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">Create Trip</h3>
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

        <form className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={onCreateTrip}>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-700">Date</span>
            <input
              className="rounded border px-3 py-2"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-700">Time</span>
            <input
              className="rounded border px-3 py-2"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-700">Boat</span>
            <select
              className="rounded border px-3 py-2"
              value={boat}
              onChange={(e) => setBoat(e.target.value as BoatName)}
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
                value={primaryTripTypeCode}
                onChange={(e) =>
                  setPrimaryTripTypeCode(e.target.value as TripTypeCode)
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
                value={secondaryTripTypeCode}
                onChange={(e) =>
                  setSecondaryTripTypeCode(e.target.value as TripTypeCode | "")
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
            <span className="text-xs text-slate-500">
              Select 1 or 2 trip types per trip.
            </span>
          </div>

          <div className="md:col-span-2 flex justify-end">
            <button className="rounded bg-emerald-700 px-5 py-2 text-white" type="submit">
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
