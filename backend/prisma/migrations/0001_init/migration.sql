CREATE TYPE "UserRole" AS ENUM ('super_admin', 'receptionist', 'staff_scanner');
CREATE TYPE "BookingStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'CHECKED_IN');
CREATE TYPE "CheckinResult" AS ENUM ('VALID', 'INVALID');

CREATE TABLE "User" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "role" "UserRole" NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE "Trip" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "date" DATE NOT NULL,
  "start_time" TIME NOT NULL,
  "boat" TEXT,
  "created_by_user_id" UUID NOT NULL REFERENCES "User"("id"),
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Booking" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "trip_id" UUID NOT NULL REFERENCES "Trip"("id"),
  "guest_name" TEXT NOT NULL,
  "pax_count" INTEGER NOT NULL,
  "inhouse" BOOLEAN NOT NULL,
  "guesthouse_name" TEXT NOT NULL,
  "status" "BookingStatus" NOT NULL,
  "created_by_user_id" UUID NOT NULL REFERENCES "User"("id"),
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cancelled_by_user_id" UUID REFERENCES "User"("id"),
  "cancelled_at" TIMESTAMP
);

CREATE TABLE "Ticket" (
  "booking_id" UUID PRIMARY KEY REFERENCES "Booking"("id"),
  "token_hash" TEXT NOT NULL UNIQUE,
  "issued_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Checkin" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "booking_id" UUID NOT NULL REFERENCES "Booking"("id"),
  "trip_id" UUID NOT NULL REFERENCES "Trip"("id"),
  "selected_trip_id" UUID NOT NULL REFERENCES "Trip"("id"),
  "scanned_by_user_id" UUID NOT NULL REFERENCES "User"("id"),
  "scanned_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "result" "CheckinResult" NOT NULL,
  "reason" TEXT NOT NULL
);

CREATE INDEX "Checkin_one_valid_per_booking" ON "Checkin" ("booking_id") WHERE "result" = 'VALID';
CREATE UNIQUE INDEX "Checkin_one_valid_per_booking_unique" ON "Checkin" ("booking_id") WHERE "result" = 'VALID';
