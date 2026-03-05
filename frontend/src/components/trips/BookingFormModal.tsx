"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { BookingStatus } from "@/types";
import { FormEvent, useEffect, useState } from "react";

export type BookingFormValues = {
  guestName: string;
  guestEmail: string;
  adultPaxCount: number;
  childrenPaxCount: number;
  inhouse: boolean;
  sendTicketEmail: boolean;
  guesthouseName: string;
  status: BookingStatus;
};

type BookingFormModalProps = {
  isOpen: boolean;
  title: string;
  submitLabel: string;
  onClose: () => void;
  onSave: (values: BookingFormValues) => void | Promise<void>;
  initialData?: BookingFormValues;
  showStatus?: boolean;
  showSendTicketOption?: boolean;
  requireGuestEmail?: boolean;
};

const DEFAULT_VALUES: BookingFormValues = {
  guestName: "",
  guestEmail: "",
  adultPaxCount: 1,
  childrenPaxCount: 0,
  inhouse: true,
  sendTicketEmail: false,
  guesthouseName: "",
  status: "ACTIVE",
};

export function BookingFormModal({
  isOpen,
  title,
  submitLabel,
  onClose,
  onSave,
  initialData,
  showStatus = false,
  showSendTicketOption = false,
  requireGuestEmail = false,
}: BookingFormModalProps) {
  const [values, setValues] = useState<BookingFormValues>(DEFAULT_VALUES);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setValues(initialData ?? DEFAULT_VALUES);
    setErrorMessage("");
  }, [initialData, isOpen]);

  if (!isOpen) {
    return null;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!values.guestName.trim()) {
      setErrorMessage("Lead guest name is required.");
      return;
    }
    if (!values.inhouse && !values.guesthouseName.trim()) {
      setErrorMessage("Guesthouse name is required for non in-house bookings.");
      return;
    }
    if (requireGuestEmail && !values.guestEmail.trim()) {
      setErrorMessage("Guest email is required.");
      return;
    }
    if (values.sendTicketEmail && !values.guestEmail.trim()) {
      setErrorMessage("Guest email is required when sending ticket email.");
      return;
    }

    setErrorMessage("");
    try {
      await onSave({
        ...values,
        guestName: values.guestName.trim(),
        guestEmail: values.guestEmail.trim().toLowerCase(),
        guesthouseName: values.guesthouseName.trim(),
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save booking.",
      );
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold">{title}</h4>
          <button
            className="cursor-pointer rounded border px-3 py-1 text-sm"
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

        <form
          className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2"
          onSubmit={onSubmit}
        >
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-700">Lead Guest Name</span>
            <input
              className="rounded border px-3 py-2"
              value={values.guestName}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, guestName: e.target.value }))
              }
              required
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-700">Guest Email</span>
            <input
              className="rounded border px-3 py-2"
              inputMode="email"
              type="email"
              value={values.guestEmail}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, guestEmail: e.target.value }))
              }
              placeholder="guest@example.com"
              required={requireGuestEmail}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-700">Adult Pax Count</span>
            <input
              className="rounded border px-3 py-2"
              min={1}
              type="number"
              value={values.adultPaxCount}
              onChange={(e) =>
                setValues((prev) => ({
                  ...prev,
                  adultPaxCount: Number(e.target.value) || 1,
                }))
              }
              required
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-700">Children Pax Count</span>
            <input
              className="rounded border px-3 py-2"
              min={0}
              type="number"
              value={values.childrenPaxCount}
              onChange={(e) =>
                setValues((prev) => ({
                  ...prev,
                  childrenPaxCount: Number(e.target.value) || 0,
                }))
              }
              required
            />
          </label>

          {showStatus && (
            <label className="flex flex-col gap-1">
              <span className="text-sm text-slate-700">Status</span>
              <select
                className="rounded border px-3 py-2"
                value={values.status}
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    status: e.target.value as BookingStatus,
                  }))
                }
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="CANCELLED">CANCELLED</option>
                <option value="CHECKED_IN">CHECKED_IN</option>
              </select>
            </label>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-700">In-house</span>
            <input
              checked={values.inhouse}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, inhouse: e.target.checked }))
              }
              type="checkbox"
              className="h-5 w-5"
            />
          </label>

          {!values.inhouse && (
            <label className="flex flex-col gap-1">
              <span className="text-sm text-slate-700">Guesthouse Name</span>
              <input
                className="rounded border px-3 py-2"
                value={values.guesthouseName}
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    guesthouseName: e.target.value,
                  }))
                }
              />
            </label>
          )}

          {showSendTicketOption && (
            <label className="md:col-span-2 flex cursor-pointer items-center gap-2 rounded border px-3 py-2">
              <input
                checked={values.sendTicketEmail}
                onChange={(e) =>
                  setValues((prev) => ({
                    ...prev,
                    sendTicketEmail: e.target.checked,
                  }))
                }
                type="checkbox"
                className="h-5 w-5"
              />
              <span className="text-sm text-slate-700">
                Send ticket to email after creating booking
              </span>
            </label>
          )}

          <div className="md:col-span-2 flex justify-end">
            <button
              className="cursor-pointer rounded bg-indigo-700 px-4 py-2 text-white"
              type="submit"
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
