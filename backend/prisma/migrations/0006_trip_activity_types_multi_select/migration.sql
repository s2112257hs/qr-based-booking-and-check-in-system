ALTER TABLE "Trip" ADD COLUMN "max_capacity" INTEGER;

UPDATE "Trip"
SET "max_capacity" = CASE
  WHEN "boat" = 'W_speed' THEN 20
  WHEN "boat" = 'Hiriwave' THEN 25
  WHEN "boat" = 'Small_speed' THEN 9
  ELSE 20
END;

ALTER TABLE "Trip"
ALTER COLUMN "max_capacity" SET NOT NULL;

CREATE TABLE "ActivityType" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL UNIQUE
);

CREATE TABLE "TripActivityType" (
  "trip_id" UUID NOT NULL REFERENCES "Trip"("id") ON DELETE CASCADE,
  "activity_type_id" UUID NOT NULL REFERENCES "ActivityType"("id") ON DELETE CASCADE,
  PRIMARY KEY ("trip_id", "activity_type_id")
);

CREATE INDEX "TripActivityType_activity_type_id_idx" ON "TripActivityType" ("activity_type_id");

INSERT INTO "ActivityType" ("code", "name") VALUES
('DOLPHIN_CRUISE', 'Dolphin Cruise'),
('WHALE_SHARK_SNORKELLING', 'Whale Shark Snorkelling'),
('MANTA_SNORKELLING', 'Manta Snorkelling'),
('FISH_BANK_SNORKELLING', 'Fish Bank Snorkelling'),
('TURTLE_SNORKELLING_AND_SANDBANK', 'Turtle Snorkelling and Sandbank'),
('REEF_SNORKEL_TRIP', 'Reef Snorkel Trip');

INSERT INTO "TripActivityType" ("trip_id", "activity_type_id")
SELECT
  t."id",
  a."id"
FROM "Trip" t
CROSS JOIN "ActivityType" a
WHERE a."code" = 'REEF_SNORKEL_TRIP';
