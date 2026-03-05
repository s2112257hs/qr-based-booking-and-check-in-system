import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, boatName } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const BOAT_DEFAULT_CAPACITY: Record<boatName, number> = {
  [boatName.W_speed]: 20,
  [boatName.Hiriwave]: 25,
  [boatName.Small_speed]: 9,
};

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

  private defaultCapacity(boat: boatName): number {
    return BOAT_DEFAULT_CAPACITY[boat];
  }

  private resolveCapacityForBoat(boat: boatName, requested?: number): number {
    const limit = this.defaultCapacity(boat);
    const value = requested ?? limit;

    if (!Number.isInteger(value) || value < 1) {
      throw new BadRequestException('maxCapacity must be an integer >= 1');
    }
    if (value > limit) {
      throw new BadRequestException(
        `maxCapacity cannot exceed ${limit} for boat ${boat}`,
      );
    }

    return value;
  }

  private async resolveActivityTypes(activityTypeCodes: string[]) {
    const uniqueCodes = Array.from(new Set(activityTypeCodes));
    if (uniqueCodes.length < 1 || uniqueCodes.length > 2) {
      throw new BadRequestException(
        'tripTypeCodes must include 1 or 2 activity codes',
      );
    }

    const rows = await this.prisma.activityType.findMany({
      where: { code: { in: uniqueCodes } },
      select: { id: true, code: true, name: true },
    });

    if (rows.length !== uniqueCodes.length) {
      throw new BadRequestException('One or more tripTypeCodes are invalid');
    }

    return rows;
  }

  private async bookedPaxCountForTrip(tripId: string): Promise<number> {
    const bookings = await this.prisma.booking.findMany({
      where: {
        trip_id: tripId,
        status: { not: BookingStatus.CANCELLED },
      },
      select: {
        adult_pax_count: true,
        children_pax_count: true,
      },
    });

    return bookings.reduce(
      (sum, booking) => sum + booking.adult_pax_count + booking.children_pax_count,
      0,
    );
  }

  createTrip(data: {
    date: string;
    startTime: string;
    boat?: boatName;
    tripTypeCodes: string[];
    maxCapacity?: number;
    createdByUserId: string;
  }) {
    return this.createTripInternal(data);
  }

  private async createTripInternal(data: {
    date: string;
    startTime: string;
    boat?: boatName;
    tripTypeCodes: string[];
    maxCapacity?: number;
    createdByUserId: string;
  }) {
    const selectedBoat = data.boat ?? boatName.W_speed;
    const maxCapacity = this.resolveCapacityForBoat(
      selectedBoat,
      data.maxCapacity,
    );
    const activityTypes = await this.resolveActivityTypes(data.tripTypeCodes);

    return this.prisma.trip.create({
      data: {
        date: new Date(data.date),
        start_time: new Date(`1970-01-01T${data.startTime}:00.000Z`),
        boat: selectedBoat,
        max_capacity: maxCapacity,
        created_by_user_id: data.createdByUserId,
        activityTypes: {
          create: activityTypes.map((activityType) => ({
            activity_type_id: activityType.id,
          })),
        },
      },
      include: {
        activityTypes: {
          include: { activityType: true },
        },
      },
    });
  }

  async listTrips(boat?: boatName) {
    const trips = await this.prisma.trip.findMany({
      where: boat ? { boat } : undefined,
      include: {
        bookings: {
          select: {
            adult_pax_count: true,
            children_pax_count: true,
            status: true,
          },
        },
        activityTypes: {
          include: { activityType: true },
        },
      },
      orderBy: [{ date: 'asc' }, { start_time: 'asc' }],
    });

    return trips.map((trip) => {
      const bookedPaxCount = trip.bookings
        .filter((booking) => booking.status !== BookingStatus.CANCELLED)
        .reduce(
          (sum, booking) =>
            sum + booking.adult_pax_count + booking.children_pax_count,
          0,
        );

      return {
        id: trip.id,
        date: trip.date,
        start_time: trip.start_time,
        boat: trip.boat,
        max_capacity: trip.max_capacity,
        created_by_user_id: trip.created_by_user_id,
        created_at: trip.created_at,
        trip_types: trip.activityTypes.map((item) => ({
          code: item.activityType.code,
          name: item.activityType.name,
        })),
        booked_pax_count: bookedPaxCount,
      };
    });
  }

  async getTripDetails(tripId: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        bookings: {
          include: { ticket: true },
          orderBy: { created_at: 'asc' },
        },
        checkinsByTrip: {
          include: {
            booking: true,
            scannedBy: true,
            selectedTrip: true,
          },
          orderBy: { scanned_at: 'desc' },
        },
        activityTypes: {
          include: { activityType: true },
        },
      },
    });
    if (!trip) {
      throw new NotFoundException('Trip not found');
    }
    return {
      ...trip,
      trip_types: trip.activityTypes.map((item) => ({
        code: item.activityType.code,
        name: item.activityType.name,
      })),
    };
  }

  async updateTrip(
    tripId: string,
    input: {
      date?: string;
      startTime?: string;
      boat?: boatName;
      tripTypeCodes?: string[];
      maxCapacity?: number;
    },
  ) {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    const nextBoat = input.boat ?? trip.boat;
    const nextMaxCapacity =
      input.maxCapacity !== undefined
        ? this.resolveCapacityForBoat(nextBoat, input.maxCapacity)
        : input.boat
          ? this.defaultCapacity(nextBoat)
          : undefined;
    const nextActivityTypes = input.tripTypeCodes
      ? await this.resolveActivityTypes(input.tripTypeCodes)
      : undefined;

    if (nextMaxCapacity !== undefined) {
      const bookedPaxCount = await this.bookedPaxCountForTrip(tripId);
      if (bookedPaxCount > nextMaxCapacity) {
        throw new BadRequestException(
          `Cannot set capacity to ${nextMaxCapacity}. Current non-cancelled bookings total ${bookedPaxCount} pax.`,
        );
      }
    }

    return this.prisma.trip.update({
      where: { id: tripId },
      data: {
        date: input.date ? new Date(input.date) : undefined,
        start_time: input.startTime
          ? new Date(`1970-01-01T${input.startTime}:00.000Z`)
          : undefined,
        boat: input.boat,
        max_capacity: nextMaxCapacity,
        activityTypes: nextActivityTypes
          ? {
              set: nextActivityTypes.map((activityType) => ({
                trip_id_activity_type_id: {
                  trip_id: tripId,
                  activity_type_id: activityType.id,
                },
              })),
            }
          : undefined,
      },
      include: {
        activityTypes: {
          include: { activityType: true },
        },
      },
    });
  }

  async deleteTrip(tripId: string) {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    await this.prisma.$transaction(async (tx) => {
      const bookings = await tx.booking.findMany({
        where: { trip_id: tripId },
        select: { id: true },
      });
      const bookingIds = bookings.map((item) => item.id);

      await tx.checkin.deleteMany({
        where: {
          OR: [
            { trip_id: tripId },
            { selected_trip_id: tripId },
            ...(bookingIds.length > 0 ? [{ booking_id: { in: bookingIds } }] : []),
          ],
        },
      });

      if (bookingIds.length > 0) {
        await tx.ticket.deleteMany({
          where: { booking_id: { in: bookingIds } },
        });
      }

      await tx.booking.deleteMany({ where: { trip_id: tripId } });
      await tx.trip.delete({ where: { id: tripId } });
    });

    return { deleted: true, tripId };
  }
}
