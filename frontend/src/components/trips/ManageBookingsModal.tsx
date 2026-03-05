"use client";

import { apiUrl } from "@/api/client";
import {
  createBooking,
  deleteBooking,
  listBookings,
  sendBookingTicketEmail,
  updateBooking,
} from "@/api/bookings";
import { Booking, Trip } from "@/types";
import { parseErrorMessage, withAuth } from "@/utils/http";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookingFormModal, BookingFormValues } from "./BookingFormModal";

type ManageBookingsModalProps = {
  token: string;
  trip: Trip | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
};

export function ManageBookingsModal({
  token,
  trip,
  isOpen,
  onClose,
  onSuccess,
}: ManageBookingsModalProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [latestCreatedBooking, setLatestCreatedBooking] = useState<{
    bookingId: string;
    guestName: string;
  } | null>(null);
  const [addBookingOpen, setAddBookingOpen] = useState(false);
  const [editBookingOpen, setEditBookingOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

  const refreshBookings = useCallback(
    async (tripId: string) => {
      try {
        const rows = await listBookings(token, tripId);
        setBookings(rows);
        setErrorMessage("");
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load bookings.",
        );
      }
    },
    [token],
  );

  useEffect(() => {
    if (!isOpen || !trip) return;

    setErrorMessage("");
    setSuccessMessage("");
    setLatestCreatedBooking(null);
    setAddBookingOpen(false);
    setEditBookingOpen(false);
    setEditingBooking(null);
    void refreshBookings(trip.id);
  }, [isOpen, refreshBookings, trip]);

  async function downloadTicketPdf(booking: { id: string; guestName: string }) {
    try {
      const response = await fetch(apiUrl(`/bookings/${booking.id}/ticket`), {
        headers: withAuth({}, token),
      });
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const safeName = booking.guestName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `ticket-${safeName || "guest"}-${booking.id.slice(0, 8)}.pdf`;
      link.click();
      URL.revokeObjectURL(objectUrl);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to download ticket.",
      );
    }
  }

  async function onAddBooking(values: BookingFormValues) {
    if (!trip) return;
    try {
      const created = await createBooking(token, {
        tripId: trip.id,
        guestName: values.guestName,
        guestEmail: values.guestEmail,
        adultPaxCount: values.adultPaxCount,
        childrenPaxCount: values.childrenPaxCount,
        inhouse: values.inhouse,
        guesthouseName: values.inhouse ? undefined : values.guesthouseName,
        sendTicketEmail: values.sendTicketEmail,
      });

      await refreshBookings(trip.id);
      await onSuccess();
      setAddBookingOpen(false);
      setErrorMessage("");
      setLatestCreatedBooking({
        bookingId: created.booking.id,
        guestName: values.guestName,
      });
      setSuccessMessage(
        values.sendTicketEmail
          ? `Booking created. ${created.emailDelivery.message}`
          : "Booking created. Ticket PDF is ready to download.",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to add booking.";
      setErrorMessage(message);
      throw new Error(message);
    }
  }

  async function onSaveEditedBooking(values: BookingFormValues) {
    if (!editingBooking || !trip) return;
    try {
      await updateBooking(token, editingBooking.id, {
        guestName: values.guestName,
        guestEmail: values.guestEmail,
        adultPaxCount: values.adultPaxCount,
        childrenPaxCount: values.childrenPaxCount,
        inhouse: values.inhouse,
        guesthouseName: values.inhouse ? undefined : values.guesthouseName,
        status: values.status,
      });
      await refreshBookings(trip.id);
      await onSuccess();
      setEditBookingOpen(false);
      setEditingBooking(null);
      setErrorMessage("");
      setSuccessMessage("Booking updated.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update booking.";
      setErrorMessage(message);
      throw new Error(message);
    }
  }

  async function onDeleteBooking(bookingId: string) {
    if (!trip) return;
    if (!window.confirm("Delete this booking?")) return;

    try {
      await deleteBooking(token, bookingId);
      setBookings((prev) => prev.filter((item) => item.id !== bookingId));
      await onSuccess();
      setErrorMessage("");
      setSuccessMessage("Booking deleted.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to delete booking.",
      );
    }
  }

  async function onSendTicketEmail(booking: Booking) {
    if (!booking.guest_email) {
      setErrorMessage("No guest email saved for this booking.");
      return;
    }

    try {
      const result = await sendBookingTicketEmail(token, booking.id);
      if (trip) {
        await refreshBookings(trip.id);
      }
      setErrorMessage("");
      setSuccessMessage(result.message);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to send ticket email.",
      );
    }
  }

  const editInitialData = useMemo<BookingFormValues | undefined>(() => {
    if (!editingBooking) return undefined;
    return {
      guestName: editingBooking.guest_name,
      guestEmail: editingBooking.guest_email ?? "",
      adultPaxCount: editingBooking.adult_pax_count,
      childrenPaxCount: editingBooking.children_pax_count,
      inhouse: editingBooking.inhouse,
      sendTicketEmail: false,
      guesthouseName: editingBooking.guesthouse_name,
      status: editingBooking.status,
    };
  }, [editingBooking]);

  if (!isOpen || !trip) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-6xl rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">
            Manage Trip Bookings ({trip.boat} |{" "}
            {new Date(trip.date).toISOString().slice(0, 10)}{" "}
            {new Date(trip.start_time).toISOString().slice(11, 16)})
          </h3>
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
        {successMessage && (
          <div className="mt-4 rounded bg-emerald-700 px-4 py-2 text-sm text-white">
            <p>{successMessage}</p>
            {latestCreatedBooking && (
              <button
                className="mt-2 cursor-pointer rounded bg-white px-3 py-1 text-emerald-800"
                onClick={() =>
                  void downloadTicketPdf({
                    id: latestCreatedBooking.bookingId,
                    guestName: latestCreatedBooking.guestName,
                  })
                }
                type="button"
              >
                Download Latest Ticket PDF
              </button>
            )}
          </div>
        )}

        <div className="mt-4 max-h-[70vh] overflow-auto rounded border">
          <div className="flex justify-end border-b bg-slate-50 p-3">
            <button
              className="cursor-pointer rounded bg-emerald-700 px-4 py-2 text-white"
              onClick={() => setAddBookingOpen(true)}
              type="button"
            >
              Add Booking
            </button>
          </div>
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-slate-100">
              <tr>
                <th className="border px-2 py-2 text-left">Guest</th>
                <th className="border px-2 py-2 text-left">Email</th>
                <th className="border px-2 py-2 text-left">Adults</th>
                <th className="border px-2 py-2 text-left">Children</th>
                <th className="border px-2 py-2 text-left">In-house</th>
                <th className="border px-2 py-2 text-left">Guesthouse</th>
                <th className="border px-2 py-2 text-left">Status</th>
                <th className="border px-2 py-2 text-left">Ticket Delivery</th>
                <th className="border px-2 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id}>
                  <td className="border px-2 py-2">{booking.guest_name}</td>
                  <td className="border px-2 py-2">
                    {booking.guest_email || "-"}
                  </td>
                  <td className="border px-2 py-2">{booking.adult_pax_count}</td>
                  <td className="border px-2 py-2">{booking.children_pax_count}</td>
                  <td className="border px-2 py-2">
                    {booking.inhouse ? "Yes" : "No"}
                  </td>
                  <td className="border px-2 py-2">{booking.guesthouse_name}</td>
                  <td className="border px-2 py-2">{booking.status}</td>
                  <td className="border px-2 py-2">
                    <div>{booking.ticket_delivery_status}</div>
                    {booking.ticket_delivery_last_error && (
                      <div className="text-xs text-rose-700">
                        {booking.ticket_delivery_last_error}
                      </div>
                    )}
                  </td>
                  <td className="border px-2 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        className="cursor-pointer rounded bg-indigo-700 px-3 py-1 text-white"
                        onClick={() => {
                          setEditingBooking(booking);
                          setEditBookingOpen(true);
                        }}
                        type="button"
                      >
                        Edit
                      </button>
                      <button
                        className="cursor-pointer rounded bg-sky-700 px-3 py-1 text-white"
                        onClick={() =>
                          void downloadTicketPdf({
                            id: booking.id,
                            guestName: booking.guest_name,
                          })
                        }
                        type="button"
                      >
                        PDF
                      </button>
                      <button
                        className="cursor-pointer rounded bg-amber-700 px-3 py-1 text-white"
                        onClick={() => void onSendTicketEmail(booking)}
                        type="button"
                      >
                        Send Email
                      </button>
                      <button
                        className="cursor-pointer rounded bg-rose-700 px-3 py-1 text-white"
                        onClick={() => void onDeleteBooking(booking.id)}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {bookings.length === 0 && (
                <tr>
                  <td
                    className="border px-3 py-4 text-center text-slate-500"
                    colSpan={9}
                  >
                    No bookings for this trip.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <BookingFormModal
          isOpen={addBookingOpen}
          title="Add Booking"
          submitLabel="Add Booking"
          onClose={() => setAddBookingOpen(false)}
          onSave={onAddBooking}
          showSendTicketOption
          requireGuestEmail
        />

        <BookingFormModal
          isOpen={editBookingOpen}
          title="Edit Booking"
          submitLabel="Save Booking"
          onClose={() => {
            setEditBookingOpen(false);
            setEditingBooking(null);
          }}
          onSave={onSaveEditedBooking}
          initialData={editInitialData}
          showStatus
        />
      </div>
    </div>
  );
}
