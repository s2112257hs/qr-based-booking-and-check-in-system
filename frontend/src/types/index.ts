export type Role = "super_admin" | "receptionist" | "staff_scanner";

export type BoatName = "W_speed" | "Hiriwave" | "Small_speed";

export type Trip = {
  id: string;
  date: string;
  start_time: string;
  boat: BoatName;
};

export type BookingStatus = "ACTIVE" | "CANCELLED" | "CHECKED_IN";

export type Booking = {
  id: string;
  trip_id: string;
  guest_name: string;
  pax_count: number;
  inhouse: boolean;
  guesthouse_name: string;
  status: BookingStatus;
  created_at: string;
  ticket?: { booking_id: string; token_hash: string; issued_at: string } | null;
};

export type BookingResponse = {
  booking: { id: string; status: BookingStatus };
  token: string;
  ticketUrl: string;
};

export type ScanResponse = {
  result: "VALID" | "INVALID";
  reason: string;
};

export type CheckinLog = {
  id: string;
  booking_id: string;
  trip_id: string;
  selected_trip_id: string;
  scanned_by_user_id: string;
  scanned_at: string;
  result: "VALID" | "INVALID";
  reason: string;
  booking: Booking;
};

export type TripDetails = Trip & {
  bookings: Booking[];
  checkinsByTrip: CheckinLog[];
};

export type ApiError = {
  message?: string | string[];
};
