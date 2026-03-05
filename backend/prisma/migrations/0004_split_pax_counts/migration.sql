ALTER TABLE "Booking"
ADD COLUMN "adult_pax_count" INTEGER,
ADD COLUMN "children_pax_count" INTEGER;

UPDATE "Booking"
SET
  "adult_pax_count" = COALESCE("pax_count", 0),
  "children_pax_count" = 0;

ALTER TABLE "Booking"
ALTER COLUMN "adult_pax_count" SET NOT NULL,
ALTER COLUMN "children_pax_count" SET NOT NULL;

ALTER TABLE "Booking" DROP COLUMN "pax_count";
