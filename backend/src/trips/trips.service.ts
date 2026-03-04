import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

  createTrip(data: {
    date: string;
    startTime: string;
    boat?: string;
    createdByUserId: string;
  }) {
    return this.prisma.trip.create({
      data: {
        date: new Date(data.date),
        start_time: new Date(`1970-01-01T${data.startTime}:00.000Z`),
        boat: data.boat,
        created_by_user_id: data.createdByUserId,
      },
    });
  }

  listTrips() {
    return this.prisma.trip.findMany({
      orderBy: [{ date: 'asc' }, { start_time: 'asc' }],
    });
  }
}
