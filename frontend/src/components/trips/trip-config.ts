import { BoatName, TripTypeCode } from "@/types";

export const BOATS: BoatName[] = ["W_speed", "Hiriwave", "Small_speed"];

export const TRIP_TYPES: Array<{ code: TripTypeCode; label: string }> = [
  { code: "DOLPHIN_CRUISE", label: "Dolphin Cruise" },
  { code: "WHALE_SHARK_SNORKELLING", label: "Whale Shark Snorkelling" },
  { code: "MANTA_SNORKELLING", label: "Manta Snorkelling" },
  { code: "FISH_BANK_SNORKELLING", label: "Fish Bank Snorkelling" },
  {
    code: "TURTLE_SNORKELLING_AND_SANDBANK",
    label: "Turtle Snorkelling and Sandbank",
  },
  { code: "REEF_SNORKEL_TRIP", label: "Reef Snorkel Trip" },
];

export const TRIP_TYPE_DURATION_MINUTES: Record<TripTypeCode, number> = {
  DOLPHIN_CRUISE: 120,
  WHALE_SHARK_SNORKELLING: 180,
  MANTA_SNORKELLING: 120,
  TURTLE_SNORKELLING_AND_SANDBANK: 180,
  REEF_SNORKEL_TRIP: 120,
  FISH_BANK_SNORKELLING: 120,
};
