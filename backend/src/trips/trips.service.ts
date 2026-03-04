import { Injectable, NotFoundException } from '@nestjs/common';
import { boatName } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

  createTrip(data: {
    date: string;
    startTime: string;
    boat?: boatName;
    createdByUserId: string;
  }) {
    return this.prisma.trip.create({
      data: {
        date: new Date(data.date),
        start_time: new Date(`1970-01-01T${data.startTime}:00.000Z`),
        boat: data.boat ?? boatName.W_speed,
        created_by_user_id: data.createdByUserId,
      },
    });
  }

  listTrips() {
    return this.prisma.trip.findMany({
      orderBy: [{ date: 'asc' }, { start_time: 'asc' }],
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
      },
    });
    if (!trip) {
      throw new NotFoundException('Trip not found');
    }
    return trip;
  }

  async updateTrip(
    tripId: string,
    input: { date?: string; startTime?: string; boat?: boatName },
  ) {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    return this.prisma.trip.update({
      where: { id: tripId },
      data: {
        date: input.date ? new Date(input.date) : undefined,
        start_time: input.startTime
          ? new Date(`1970-01-01T${input.startTime}:00.000Z`)
          : undefined,
        boat: input.boat,
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
