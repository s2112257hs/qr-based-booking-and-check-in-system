/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { BookingStatus, CheckinResult } from '@prisma/client';
import { ScanService } from './scan.service';

describe('ScanService', () => {
  it('returns invalid when token does not exist', async () => {
    const prisma: any = {
      ticket: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new ScanService(prisma);
    await expect(
      service.scan({
        token: 'missing',
        selectedTripId: 'trip',
        scannedByUserId: 'scanner',
      }),
    ).resolves.toEqual({
      result: CheckinResult.INVALID,
      reason: 'TOKEN_NOT_FOUND',
    });
  });

  it('returns invalid for trip mismatch and logs checkin', async () => {
    const prisma: any = {
      ticket: {
        findUnique: jest.fn().mockResolvedValue({
          booking: {
            id: 'booking',
            status: BookingStatus.ACTIVE,
            trip_id: 'trip-1',
            trip: { date: new Date() },
          },
        }),
      },
      trip: {
        findUnique: jest.fn().mockResolvedValue({ id: 'trip-2' }),
      },
      checkin: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new ScanService(prisma);

    const result = await service.scan({
      token: 'ok',
      selectedTripId: 'trip-2',
      scannedByUserId: 'scanner',
    });
    expect(result).toEqual({
      result: CheckinResult.INVALID,
      reason: 'WRONG_TRIP',
    });
    expect(prisma.checkin.create).toHaveBeenCalled();
  });
});
