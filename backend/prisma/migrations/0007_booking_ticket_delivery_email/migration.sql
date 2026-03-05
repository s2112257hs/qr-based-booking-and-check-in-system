CREATE TYPE "TicketDeliveryStatus" AS ENUM (
  'NOT_REQUESTED',
  'PENDING',
  'SENT',
  'FAILED'
);

ALTER TABLE "Booking"
ADD COLUMN "guest_email" TEXT,
ADD COLUMN "ticket_delivery_status" "TicketDeliveryStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
ADD COLUMN "ticket_delivery_last_attempt_at" TIMESTAMP(3),
ADD COLUMN "ticket_delivery_last_error" TEXT;
