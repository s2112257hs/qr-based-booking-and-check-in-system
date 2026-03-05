"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { listTrips } from "@/api/trips";
import { BoatName, Trip } from "@/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { CreateTripModal } from "./CreateTripModal";
import { ManageBookingsModal } from "./ManageBookingsModal";
import { ManageTripEditorModal } from "./ManageTripEditorModal";
import { ScanBookingsModal } from "./ScanBookingsModal";
import { TripActionModal } from "./TripActionModal";
import { BOATS, TRIP_TYPE_DURATION_MINUTES } from "./trip-config";

type BoatFilter = BoatName | "ALL";

const PIXELS_PER_HOUR = 68;
const DAY_COLUMN_MIN_WIDTH = 180;
const SCHEDULE_START_HOUR = 8;
const SCHEDULE_END_HOUR = 20;
const OPERATING_TIMEZONE_OFFSET_MINUTES = 5 * 60;

function addDaysToDayKey(dayKey: string, offsetDays: number): string {
  const date = new Date(`${dayKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function nowInOperatingTimezone(now: Date): {
  dayKey: string;
  minuteOfDay: number;
} {
  const shifted = new Date(
    now.getTime() + OPERATING_TIMEZONE_OFFSET_MINUTES * 60 * 1000,
  );
  return {
    dayKey: shifted.toISOString().slice(0, 10),
    minuteOfDay: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

function operatingTodayDayKey(): string {
  return nowInOperatingTimezone(new Date()).dayKey;
}

function dayKeyFromTrip(trip: Trip): string {
  const direct = trip.date.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
  if (direct) return direct;
  return new Date(trip.date).toISOString().slice(0, 10);
}

function timeKeyFromTrip(trip: Trip): string {
  const fromDateTime = trip.start_time.match(/T(\d{2}:\d{2})/)?.[1];
  if (fromDateTime) return fromDateTime;
  const direct = trip.start_time.match(/^(\d{2}:\d{2})/)?.[1];
  if (direct) return direct;
  return new Date(trip.start_time).toISOString().slice(11, 16);
}

function tripDurationMinutes(trip: Trip): number {
  const codes = Array.from(new Set(trip.trip_types.map((item) => item.code)));
  return codes.reduce((sum, code) => sum + TRIP_TYPE_DURATION_MINUTES[code], 0);
}

function formatDayLabel(dayKey: string): string {
  return new Date(`${dayKey}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function formatDayHeader(dayKey: string): { weekday: string; dayNumber: string } {
  const day = new Date(`${dayKey}T00:00:00`);
  return {
    weekday: day
      .toLocaleDateString(undefined, { weekday: "short" })
      .toUpperCase(),
    dayNumber: String(day.getDate()),
  };
}

function formatHourLabel(hour: number): string {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMinuteLabel(minuteOfDay: number): string {
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function tripCardStyle(status: TripVisualStatus): string {
  if (status === "NOT_STARTED_AVAILABLE") {
    return "border-emerald-400 bg-emerald-100 text-emerald-950";
  }
  if (status === "NOT_STARTED_FULL") {
    return "border-rose-400 bg-rose-100 text-rose-950";
  }
  if (status === "STARTED") {
    return "border-sky-400 bg-sky-100 text-sky-950";
  }
  return "border-slate-400 bg-slate-200 text-slate-800";
}

function tripStatusLabel(status: TripVisualStatus): string {
  if (status === "NOT_STARTED_AVAILABLE") return "Not Started";
  if (status === "NOT_STARTED_FULL") return "Not Started - Full";
  if (status === "STARTED") return "Started";
  return "Ended";
}

type TripVisualStatus =
  | "NOT_STARTED_AVAILABLE"
  | "NOT_STARTED_FULL"
  | "STARTED"
  | "ENDED";

type CalendarTripEvent = {
  trip: Trip;
  dayKey: string;
  boat: BoatName;
  startMinute: number;
  endMinute: number;
};

type PositionedCalendarTripEvent = CalendarTripEvent & {
  column: number;
  columns: number;
};

function positionOverlapCluster(events: CalendarTripEvent[]): PositionedCalendarTripEvent[] {
  const sorted = [...events].sort(
    (a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute,
  );
  const active: PositionedCalendarTripEvent[] = [];
  const positioned: PositionedCalendarTripEvent[] = [];
  let clusterMaxColumns = 1;

  for (const event of sorted) {
    for (let idx = active.length - 1; idx >= 0; idx -= 1) {
      if (active[idx].endMinute <= event.startMinute) {
        active.splice(idx, 1);
      }
    }

    const used = new Set(active.map((item) => item.column));
    let column = 0;
    while (used.has(column)) {
      column += 1;
    }

    const next: PositionedCalendarTripEvent = {
      ...event,
      column,
      columns: 1,
    };
    active.push(next);
    positioned.push(next);
    clusterMaxColumns = Math.max(clusterMaxColumns, active.length, column + 1);
  }

  return positioned.map((event) => ({ ...event, columns: clusterMaxColumns }));
}

function layoutDayEvents(events: CalendarTripEvent[]): PositionedCalendarTripEvent[] {
  if (events.length === 0) return [];

  const sorted = [...events].sort(
    (a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute,
  );
  const clusters: CalendarTripEvent[][] = [];
  let currentCluster: CalendarTripEvent[] = [];
  let clusterEnd = -1;

  for (const event of sorted) {
    if (currentCluster.length === 0 || event.startMinute < clusterEnd) {
      currentCluster.push(event);
      clusterEnd = Math.max(clusterEnd, event.endMinute);
    } else {
      clusters.push(currentCluster);
      currentCluster = [event];
      clusterEnd = event.endMinute;
    }
  }

  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  return clusters.flatMap((cluster) => positionOverlapCluster(cluster));
}

export function TripsPageContent({
  token,
  canCreate,
  canManageTrip = true,
  canManageBookings = true,
  canScanBookings = true,
}: {
  token: string;
  canCreate: boolean;
  canManageTrip?: boolean;
  canManageBookings?: boolean;
  canScanBookings?: boolean;
}) {
  const [boatFilter, setBoatFilter] = useState<BoatFilter>("W_speed");
  const calendarViewportRef = useRef<HTMLDivElement | null>(null);
  const [calendarViewportWidth, setCalendarViewportWidth] = useState(0);

  const [pageErrorMessage, setPageErrorMessage] = useState("");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [windowStartDayKey, setWindowStartDayKey] = useState<string>(
    operatingTodayDayKey(),
  );
  const [now, setNow] = useState<Date>(new Date());

  const [createTripOpen, setCreateTripOpen] = useState(false);
  const [tripActionOpen, setTripActionOpen] = useState(false);
  const [manageTripEditorOpen, setManageTripEditorOpen] = useState(false);
  const [manageTripBookingsOpen, setManageTripBookingsOpen] = useState(false);
  const [scanBookingsOpen, setScanBookingsOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

  const visibleDayCount = useMemo(() => {
    const defaultDays = boatFilter === "ALL" ? 2 : 7;
    if (!calendarViewportWidth) {
      return defaultDays;
    }

    const columnsPerDay = boatFilter === "ALL" ? BOATS.length : 1;
    const availableForDayColumns = Math.max(0, calendarViewportWidth - 84);
    const possibleColumns = Math.max(
      1,
      Math.floor(availableForDayColumns / DAY_COLUMN_MIN_WIDTH),
    );
    const days = Math.max(1, Math.floor(possibleColumns / columnsPerDay));
    return days;
  }, [boatFilter, calendarViewportWidth]);

  async function refreshTrips(nextBoat: BoatFilter = boatFilter) {
    try {
      const data = await listTrips(
        token,
        nextBoat === "ALL" ? undefined : nextBoat,
      );
      setTrips(data);
      setPageErrorMessage("");
    } catch (error) {
      setPageErrorMessage(
        error instanceof Error ? error.message : "Failed to load trips.",
      );
    }
  }

  useEffect(() => {
    void refreshTrips();
  }, [boatFilter, token]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const node = calendarViewportRef.current;
    if (!node) return;

    const updateWidth = () => {
      setCalendarViewportWidth(node.clientWidth);
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  const windowDayKeys = useMemo(
    () =>
      Array.from({ length: visibleDayCount }, (_, idx) =>
        addDaysToDayKey(windowStartDayKey, idx),
      ),
    [visibleDayCount, windowStartDayKey],
  );

  const visibleTrips = useMemo(() => {
    const keys = new Set(windowDayKeys);
    return trips.filter((trip) => keys.has(dayKeyFromTrip(trip)));
  }, [trips, windowDayKeys]);

  const calendarEvents = useMemo<CalendarTripEvent[]>(() => {
    return visibleTrips.map((trip) => {
      const durationMinutes = tripDurationMinutes(trip);
      const [startHour, startMinutePart] = timeKeyFromTrip(trip)
        .split(":")
        .map(Number);
      const startMinute = startHour * 60 + startMinutePart;
      const endMinute = Math.min(24 * 60, startMinute + durationMinutes);

      return {
        trip,
        dayKey: dayKeyFromTrip(trip),
        boat: trip.boat,
        startMinute,
        endMinute,
      };
    });
  }, [visibleTrips]);

  const eventsByColumn = useMemo(() => {
    const grouped = new Map<string, CalendarTripEvent[]>();
    for (const event of calendarEvents) {
      const key = `${event.dayKey}|${event.boat}`;
      const list = grouped.get(key) ?? [];
      list.push(event);
      grouped.set(key, list);
    }
    const laidOut = new Map<string, PositionedCalendarTripEvent[]>();
    for (const [columnKey, events] of grouped.entries()) {
      laidOut.set(columnKey, layoutDayEvents(events));
    }
    return laidOut;
  }, [calendarEvents]);

  const scheduleStartMinute = SCHEDULE_START_HOUR * 60;
  const scheduleEndMinute = SCHEDULE_END_HOUR * 60;
  const scheduleHeight =
    ((scheduleEndMinute - scheduleStartMinute) / 60) * PIXELS_PER_HOUR;

  const hourMarks = useMemo(
    () =>
      Array.from(
        { length: SCHEDULE_END_HOUR - SCHEDULE_START_HOUR + 1 },
        (_, idx) => SCHEDULE_START_HOUR + idx,
      ),
    [],
  );

  const calendarColumns = useMemo(() => {
    if (boatFilter !== "ALL") {
      return windowDayKeys.map((dayKey) => ({
        key: `${dayKey}|${boatFilter}`,
        dayKey,
        boat: boatFilter as BoatName,
      }));
    }
    return windowDayKeys.flatMap((dayKey) =>
      BOATS.map((boatName) => ({
        key: `${dayKey}|${boatName}`,
        dayKey,
        boat: boatName,
      })),
    );
  }, [boatFilter, windowDayKeys]);

  const rangeLabel = useMemo(() => {
    const first = windowDayKeys[0];
    const last = windowDayKeys[windowDayKeys.length - 1];
    if (!first || !last) return "";
    return `${formatDayLabel(first)} - ${formatDayLabel(last)}`;
  }, [windowDayKeys]);

  const operatingNow = useMemo(() => nowInOperatingTimezone(now), [now]);

  function visualStatusForTrip(trip: Trip): TripVisualStatus {
    const tripDayKey = dayKeyFromTrip(trip);
    const [startHour, startMinutePart] = timeKeyFromTrip(trip)
      .split(":")
      .map(Number);
    const startMinute = startHour * 60 + startMinutePart;
    const endMinute = startMinute + tripDurationMinutes(trip);

    if (operatingNow.dayKey > tripDayKey) {
      return "ENDED";
    }
    if (operatingNow.dayKey === tripDayKey) {
      if (operatingNow.minuteOfDay >= endMinute) {
        return "ENDED";
      }
      if (operatingNow.minuteOfDay >= startMinute) {
        return "STARTED";
      }
    }

    const booked = trip.booked_pax_count ?? 0;
    if (booked >= trip.max_capacity) {
      return "NOT_STARTED_FULL";
    }

    return "NOT_STARTED_AVAILABLE";
  }

  function openTripActions(trip: Trip) {
    setSelectedTrip(trip);
    setTripActionOpen(true);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-hidden">
      {pageErrorMessage && (
        <p className="rounded bg-rose-700 px-4 py-2 text-sm text-white">
          {pageErrorMessage}
        </p>
      )}

      <section className="flex min-h-0 flex-1 flex-col rounded-lg bg-white p-4 shadow">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">View Trips</h2>
          <div className="flex flex-wrap items-center gap-2">
            {canCreate && (
              <button
                className="mr-3 rounded bg-emerald-700 px-4 py-2 text-sm text-white"
                onClick={() => setCreateTripOpen(true)}
                type="button"
              >
                Create Trip
              </button>
            )}
            <span className="text-sm text-slate-600">Boat</span>
            <select
              className="rounded border px-3 py-2"
              value={boatFilter}
              onChange={(e) => setBoatFilter(e.target.value as BoatFilter)}
            >
              <option value="ALL">All Boats</option>
              {BOATS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <button
              className="rounded border px-3 py-2 text-sm"
              type="button"
              onClick={() =>
                setWindowStartDayKey((prev) =>
                  addDaysToDayKey(prev, -visibleDayCount),
                )
              }
            >
              Previous
            </button>
            <button
              className="rounded border px-3 py-2 text-sm"
              type="button"
              onClick={() => setWindowStartDayKey(operatingTodayDayKey())}
            >
              Today
            </button>
            <button
              className="rounded border px-3 py-2 text-sm"
              type="button"
              onClick={() =>
                setWindowStartDayKey((prev) =>
                  addDaysToDayKey(prev, visibleDayCount),
                )
              }
            >
              Next
            </button>
          </div>
        </div>

        <p className="mt-2 text-sm text-slate-600">{rangeLabel}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          <span className="rounded border border-emerald-400 bg-emerald-100 px-2 py-1">
            Not Started
          </span>
          <span className="rounded border border-rose-400 bg-rose-100 px-2 py-1">
            Not Started - Full
          </span>
          <span className="rounded border border-sky-400 bg-sky-100 px-2 py-1">
            Started
          </span>
          <span className="rounded border border-slate-400 bg-slate-200 px-2 py-1">
            Ended
          </span>
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-auto" ref={calendarViewportRef}>
          <div className="w-full">
            <div
              className="sticky top-0 z-20 grid border-b bg-slate-50 shadow-sm"
              style={{
                gridTemplateColumns: `84px repeat(${calendarColumns.length}, minmax(${DAY_COLUMN_MIN_WIDTH}px, 1fr))`,
              }}
            >
              <div className="border-r px-2 py-2 text-xs text-slate-500">GMT +5</div>
              {calendarColumns.map((column) => {
                const header = formatDayHeader(column.dayKey);
                const isToday = column.dayKey === operatingNow.dayKey;
                return (
                  <div
                    className={`border-r px-2 py-2 text-center ${
                      isToday ? "bg-indigo-50 text-indigo-700" : ""
                    }`}
                    key={column.key}
                  >
                    <div className="text-sm font-bold tracking-wide">{header.weekday}</div>
                    <div className="text-2xl font-semibold">{header.dayNumber}</div>
                    <div className="mt-1 rounded bg-slate-100 px-2 py-1 text-sm font-bold text-slate-800">
                      {column.boat}
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              className="grid"
              style={{
                gridTemplateColumns: `84px repeat(${calendarColumns.length}, minmax(${DAY_COLUMN_MIN_WIDTH}px, 1fr))`,
              }}
            >
              <div className="relative border-r bg-white" style={{ height: `${scheduleHeight}px` }}>
                {hourMarks.map((hour) => {
                  const top =
                    ((hour * 60 - scheduleStartMinute) / 60) * PIXELS_PER_HOUR;
                  return (
                    <div
                      className="absolute left-0 right-0 border-t border-slate-200 px-2 text-xs text-slate-500"
                      key={hour}
                      style={{ top: `${top}px` }}
                    >
                      {formatHourLabel(hour)}
                    </div>
                  );
                })}
              </div>

              {calendarColumns.map((column) => {
                const dayEvents = eventsByColumn.get(column.key) ?? [];
                return (
                  <div
                    className="relative border-r bg-white"
                    key={column.key}
                    style={{
                      height: `${scheduleHeight}px`,
                      backgroundImage: `repeating-linear-gradient(
                        to bottom,
                        transparent 0,
                        transparent ${PIXELS_PER_HOUR - 1}px,
                        #e2e8f0 ${PIXELS_PER_HOUR - 1}px,
                        #e2e8f0 ${PIXELS_PER_HOUR}px
                      )`,
                    }}
                  >
                    {dayEvents.map((event, idx) => {
                      const rawTop =
                        ((event.startMinute - scheduleStartMinute) / 60) *
                        PIXELS_PER_HOUR;
                      const rawBottom =
                        ((event.endMinute - scheduleStartMinute) / 60) *
                        PIXELS_PER_HOUR;
                      const clampedTop = Math.max(0, rawTop);
                      const clampedBottom = Math.min(scheduleHeight, rawBottom);
                      if (clampedBottom <= clampedTop) return null;

                      const leftPercent = (event.column / event.columns) * 100;
                      const widthPercent = 100 / event.columns;
                      const tripStatus = visualStatusForTrip(event.trip);

                      return (
                        <div
                          className="absolute p-1"
                          key={`${column.key}-${idx}`}
                          style={{
                            top: `${clampedTop}px`,
                            height: `${Math.max(24, clampedBottom - clampedTop)}px`,
                            left: `${leftPercent}%`,
                            width: `${widthPercent}%`,
                          }}
                        >
                          <div
                            className={`h-full cursor-pointer overflow-hidden rounded border p-1 ${tripCardStyle(
                              tripStatus,
                            )}`}
                            onClick={() => openTripActions(event.trip)}
                          >
                            <div className="truncate text-xs font-semibold">
                              {event.trip.trip_types.map((value) => value.name).join(", ")}
                            </div>
                            <div className="text-[11px]">
                              {formatMinuteLabel(event.startMinute)} -{" "}
                              {formatMinuteLabel(event.endMinute)}
                            </div>
                            <div className="text-[11px]">{tripStatusLabel(tripStatus)}</div>
                            <div className="text-[11px]">
                              Pax: {event.trip.booked_pax_count ?? 0}/{event.trip.max_capacity}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <CreateTripModal
        token={token}
        isOpen={canCreate && createTripOpen}
        onClose={() => setCreateTripOpen(false)}
        onSuccess={refreshTrips}
      />

      <TripActionModal
        isOpen={tripActionOpen}
        trip={selectedTrip}
        canManageTrip={canManageTrip}
        canManageBookings={canManageBookings}
        canScanBookings={canScanBookings}
        onClose={() => setTripActionOpen(false)}
        onOpenEditor={() => {
          setTripActionOpen(false);
          setManageTripEditorOpen(true);
        }}
        onOpenBookings={() => {
          setTripActionOpen(false);
          setManageTripBookingsOpen(true);
        }}
        onOpenScan={() => {
          setTripActionOpen(false);
          setScanBookingsOpen(true);
        }}
      />

      {canManageTrip && (
        <ManageTripEditorModal
          token={token}
          trip={selectedTrip}
          isOpen={manageTripEditorOpen}
          onClose={() => setManageTripEditorOpen(false)}
          onSuccess={refreshTrips}
        />
      )}

      {canManageBookings && (
        <ManageBookingsModal
          token={token}
          trip={selectedTrip}
          isOpen={manageTripBookingsOpen}
          onClose={() => setManageTripBookingsOpen(false)}
          onSuccess={refreshTrips}
        />
      )}

      {canScanBookings && (
        <ScanBookingsModal
          token={token}
          trip={selectedTrip}
          isOpen={scanBookingsOpen}
          onClose={() => setScanBookingsOpen(false)}
        />
      )}
    </div>
  );
}
