import { Injectable } from '@nestjs/common';
import { BookingStatus, CheckinResult, Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ScanService {
  constructor(private readonly prisma: PrismaService) {}

  async scan(input: {
    token: string;
    selectedTripId: string;
    scannedByUserId: string;
  }) {
    const tokenHash = crypto
      .createHash('sha256')
      .update(input.token)
      .digest('hex');
    const ticket = await this.prisma.ticket.findUnique({
      where: { token_hash: tokenHash },
      include: { booking: { include: { trip: true } } },
    });

    if (!ticket) {
      return { result: CheckinResult.INVALID, reason: 'TOKEN_NOT_FOUND' };
    }

    const booking = ticket.booking;
    const today = new Date().toISOString().split('T')[0];
    let reason: string | null = null;

    if (booking.status !== BookingStatus.ACTIVE) reason = 'BOOKING_NOT_ACTIVE';
    else if (booking.trip_id !== input.selectedTripId) reason = 'TRIP_MISMATCH';
    else if (booking.trip.date.toISOString().split('T')[0] !== today)
      reason = 'TRIP_NOT_TODAY';

    if (reason) {
      await this.prisma.checkin.create({
        data: {
          booking_id: booking.id,
          trip_id: booking.trip_id,
          selected_trip_id: input.selectedTripId,
          scanned_by_user_id: input.scannedByUserId,
          result: CheckinResult.INVALID,
          reason,
        },
      });

      return { result: CheckinResult.INVALID, reason };
    }

    try {
      await this.prisma.$transaction([
        this.prisma.checkin.create({
          data: {
            booking_id: booking.id,
            trip_id: booking.trip_id,
            selected_trip_id: input.selectedTripId,
            scanned_by_user_id: input.scannedByUserId,
            result: CheckinResult.VALID,
            reason: 'VALID',
          },
        }),
        this.prisma.booking.update({
          where: { id: booking.id },
          data: { status: BookingStatus.CHECKED_IN },
        }),
      ]);

      return { result: CheckinResult.VALID, reason: 'VALID' };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        await this.prisma.checkin.create({
          data: {
            booking_id: booking.id,
            trip_id: booking.trip_id,
            selected_trip_id: input.selectedTripId,
            scanned_by_user_id: input.scannedByUserId,
            result: CheckinResult.INVALID,
            reason: 'DUPLICATE_VALID_CHECKIN',
          },
        });
        return {
          result: CheckinResult.INVALID,
          reason: 'DUPLICATE_VALID_CHECKIN',
        };
      }
      throw error;
    }
  }
}
