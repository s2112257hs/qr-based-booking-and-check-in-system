/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { TripsService } from './trips.service';

describe('TripsService', () => {
  it('creates trip with normalized date and time values', async () => {
    const prisma: any = {
      trip: {
        create: jest.fn().mockResolvedValue({ id: 'trip-1' }),
      },
    };
    const service = new TripsService(prisma);

    await service.createTrip({
      date: '2026-03-04',
      startTime: '10:30',
      boat: 'Blue Pearl',
      createdByUserId: 'user-1',
    });

    expect(prisma.trip.create).toHaveBeenCalledWith({
      data: {
        date: new Date('2026-03-04'),
        start_time: new Date('1970-01-01T10:30:00.000Z'),
        boat: 'Blue Pearl',
        created_by_user_id: 'user-1',
      },
    });
  });

  it('lists trips ordered by date then start_time', async () => {
    const prisma: any = {
      trip: {
        findMany: jest.fn().mockResolvedValue([{ id: 'trip-1' }]),
      },
    };
    const service = new TripsService(prisma);

    const result = await service.listTrips();

    expect(prisma.trip.findMany).toHaveBeenCalledWith({
      orderBy: [{ date: 'asc' }, { start_time: 'asc' }],
    });
    expect(result).toEqual([{ id: 'trip-1' }]);
  });
});
