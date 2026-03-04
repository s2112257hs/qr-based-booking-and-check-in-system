import { Injectable } from '@nestjs/common';
import { BookingStatus, CheckinResult, Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const VALID_REASON = 'VALID';

class DuplicateValidCheckinError extends Error {}

@Injectable()
export class ScanService {
  constructor(private readonly prisma: PrismaService) {}

  private toDateOnlyString(value: Date): string {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private serverTodayDateString(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

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

    const selectedTrip = await this.prisma.trip.findUnique({
      where: { id: input.selectedTripId },
      select: { id: true },
    });
    if (!selectedTrip) {
      return {
        result: CheckinResult.INVALID,
        reason: 'SELECTED_TRIP_NOT_FOUND',
      };
    }

    const booking = ticket.booking;
    const today = this.serverTodayDateString();
    const tripDate = this.toDateOnlyString(booking.trip.date);
    let reason: string | null = null;

    if (booking.status === BookingStatus.CANCELLED) reason = 'CANCELLED';
    else if (booking.status === BookingStatus.CHECKED_IN)
      reason = 'ALREADY_CHECKED_IN';
    else if (booking.trip_id !== input.selectedTripId) reason = 'WRONG_TRIP';
    else if (tripDate !== today) reason = 'WRONG_DAY';

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
      await this.prisma.$transaction(async (tx) => {
        await tx.checkin.create({
          data: {
            booking_id: booking.id,
            trip_id: booking.trip_id,
            selected_trip_id: input.selectedTripId,
            scanned_by_user_id: input.scannedByUserId,
            result: CheckinResult.VALID,
            reason: VALID_REASON,
          },
        });

        const updated = await tx.booking.updateMany({
          where: { id: booking.id, status: BookingStatus.ACTIVE },
          data: { status: BookingStatus.CHECKED_IN },
        });
        if (updated.count !== 1) {
          throw new DuplicateValidCheckinError();
        }
      });

      return { result: CheckinResult.VALID, reason: VALID_REASON };
    } catch (error) {
      if (
        error instanceof DuplicateValidCheckinError ||
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2025') ||
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002')
      ) {
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
