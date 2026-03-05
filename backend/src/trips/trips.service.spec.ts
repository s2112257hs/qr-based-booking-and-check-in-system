/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { BadRequestException } from '@nestjs/common';
import { boatName } from '@prisma/client';
import { TripsService } from './trips.service';

describe('TripsService', () => {
  it('creates trip with normalized date and time values', async () => {
    const prisma: any = {
      activityType: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'activity-1', code: 'DOLPHIN_CRUISE', name: 'Dolphin Cruise' }]),
      },
      trip: {
        create: jest.fn().mockResolvedValue({ id: 'trip-1' }),
      },
    };
    const service = new TripsService(prisma);

    await service.createTrip({
      date: '2026-03-04',
      startTime: '10:30',
      boat: boatName.W_speed,
      tripTypeCodes: ['DOLPHIN_CRUISE'],
      createdByUserId: 'user-1',
    });

    expect(prisma.activityType.findMany).toHaveBeenCalledWith({
      where: { code: { in: ['DOLPHIN_CRUISE'] } },
      select: { id: true, code: true, name: true },
    });
    expect(prisma.trip.create).toHaveBeenCalledWith({
      data: {
        date: new Date('2026-03-04'),
        start_time: new Date('1970-01-01T10:30:00.000Z'),
        boat: boatName.W_speed,
        max_capacity: 20,
        created_by_user_id: 'user-1',
        activityTypes: {
          create: [{ activity_type_id: 'activity-1' }],
        },
      },
      include: {
        activityTypes: {
          include: { activityType: true },
        },
      },
    });
  });

  it('lists trips ordered by date then start_time with booked pax totals', async () => {
    const prisma: any = {
      trip: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'trip-1',
            bookings: [
              {
                adult_pax_count: 2,
                children_pax_count: 1,
                status: 'ACTIVE',
              },
              {
                adult_pax_count: 3,
                children_pax_count: 0,
                status: 'CANCELLED',
              },
            ],
            activityTypes: [
              {
                activityType: {
                  code: 'MANTA_SNORKELLING',
                  name: 'Manta Snorkelling',
                },
              },
            ],
            date: new Date('2026-03-04'),
            start_time: new Date('1970-01-01T10:30:00.000Z'),
            boat: boatName.W_speed,
            max_capacity: 20,
            created_by_user_id: 'user-1',
            created_at: new Date('2026-03-01T00:00:00.000Z'),
          },
        ]),
      },
    };
    const service = new TripsService(prisma);

    const result = await service.listTrips();

    expect(prisma.trip.findMany).toHaveBeenCalledWith({
      include: {
        activityTypes: {
          include: { activityType: true },
        },
        bookings: {
          select: {
            adult_pax_count: true,
            children_pax_count: true,
            status: true,
          },
        },
      },
      orderBy: [{ date: 'asc' }, { start_time: 'asc' }],
      where: undefined,
    });
    expect(result).toEqual([
      {
        id: 'trip-1',
        date: new Date('2026-03-04'),
        start_time: new Date('1970-01-01T10:30:00.000Z'),
        boat: boatName.W_speed,
        max_capacity: 20,
        created_by_user_id: 'user-1',
        created_at: new Date('2026-03-01T00:00:00.000Z'),
        trip_types: [
          {
            code: 'MANTA_SNORKELLING',
            name: 'Manta Snorkelling',
          },
        ],
        booked_pax_count: 3,
      },
    ]);
  });

  it('rejects boat update when current booked pax exceeds new boat capacity', async () => {
    const prisma: any = {
      trip: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'trip-1',
          boat: boatName.W_speed,
          max_capacity: 20,
        }),
        update: jest.fn(),
      },
      booking: {
        findMany: jest.fn().mockResolvedValue([
          { adult_pax_count: 10, children_pax_count: 2 },
          { adult_pax_count: 3, children_pax_count: 0 },
        ]),
      },
    };
    const service = new TripsService(prisma);

    await expect(
      service.updateTrip('trip-1', { boat: boatName.Small_speed }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.booking.findMany).toHaveBeenCalledWith({
      where: {
        trip_id: 'trip-1',
        status: { not: 'CANCELLED' },
      },
      select: {
        adult_pax_count: true,
        children_pax_count: true,
      },
    });
    expect(prisma.trip.update).not.toHaveBeenCalled();
  });

  it('allows boat update when current booked pax fits new boat capacity', async () => {
    const prisma: any = {
      trip: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'trip-1',
          boat: boatName.Hiriwave,
          max_capacity: 25,
        }),
        update: jest.fn().mockResolvedValue({ id: 'trip-1' }),
      },
      booking: {
        findMany: jest.fn().mockResolvedValue([
          { adult_pax_count: 4, children_pax_count: 2 },
        ]),
      },
    };
    const service = new TripsService(prisma);

    await service.updateTrip('trip-1', { boat: boatName.Small_speed });

    expect(prisma.trip.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'trip-1' },
        data: expect.objectContaining({
          boat: boatName.Small_speed,
          max_capacity: 9,
        }),
      }),
    );
  });
});
