-- Add enum type for Trip.boat
CREATE TYPE "boatName" AS ENUM ('W_speed', 'Hiriwave', 'Small_speed');

-- Convert Trip.boat from TEXT (nullable) to required enum
ALTER TABLE "Trip" ADD COLUMN "boat_new" "boatName";

UPDATE "Trip"
SET "boat_new" = CASE
  WHEN "boat" = 'W_speed' THEN 'W_speed'::"boatName"
  WHEN "boat" = 'Hiriwave' THEN 'Hiriwave'::"boatName"
  WHEN "boat" = 'Small_speed' THEN 'Small_speed'::"boatName"
  ELSE 'W_speed'::"boatName"
END;

ALTER TABLE "Trip" ALTER COLUMN "boat_new" SET NOT NULL;
ALTER TABLE "Trip" DROP COLUMN "boat";
ALTER TABLE "Trip" RENAME COLUMN "boat_new" TO "boat";

-- Set default status for new bookings
ALTER TABLE "Booking"
ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- Keep/ensure partial unique rule: one VALID check-in per booking
CREATE UNIQUE INDEX IF NOT EXISTS "Checkin_one_valid_per_booking_unique"
ON "Checkin" ("booking_id")
WHERE "result" = 'VALID';
