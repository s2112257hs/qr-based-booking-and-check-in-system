/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import { join } from 'path';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  private async bookedPaxForTrip(tripId: string, excludeBookingId?: string) {
    const bookings = await this.prisma.booking.findMany({
      where: {
        trip_id: tripId,
        status: { not: BookingStatus.CANCELLED },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
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

  private async assertCapacityAvailable(input: {
    tripId: string;
    adultPaxCount: number;
    childrenPaxCount: number;
    excludeBookingId?: string;
  }) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: input.tripId },
      select: { id: true, max_capacity: true },
    });
    if (!trip) {
      throw new NotFoundException('Trip not found');
    }

    const requestedPax = input.adultPaxCount + input.childrenPaxCount;
    const bookedPax = await this.bookedPaxForTrip(
      input.tripId,
      input.excludeBookingId,
    );
    if (bookedPax + requestedPax > trip.max_capacity) {
      throw new BadRequestException(
        `Trip capacity exceeded. Requested ${requestedPax}, available ${
          trip.max_capacity - bookedPax
        }`,
      );
    }
  }

  listBookings(tripId?: string) {
    return this.prisma.booking.findMany({
      where: tripId ? { trip_id: tripId } : undefined,
      include: {
        trip: true,
        ticket: true,
        checkins: {
          orderBy: { scanned_at: 'desc' },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async createBooking(input: {
    tripId: string;
    guestName: string;
    adultPaxCount: number;
    childrenPaxCount: number;
    inhouse: boolean;
    guesthouseName?: string;
    createdByUserId: string;
  }) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: input.tripId },
    });
    if (!trip) throw new NotFoundException('Trip not found');

    await this.assertCapacityAvailable({
      tripId: input.tripId,
      adultPaxCount: input.adultPaxCount,
      childrenPaxCount: input.childrenPaxCount,
    });

    const propertyName = process.env.PROPERTY_NAME ?? 'Property';
    const guesthouseName = input.inhouse
      ? propertyName
      : input.guesthouseName?.trim();

    if (!guesthouseName) {
      throw new BadRequestException(
        'guesthouse_name is required when inhouse is false',
      );
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const booking = await this.prisma.booking.create({
      data: {
        trip_id: input.tripId,
        guest_name: input.guestName,
        adult_pax_count: input.adultPaxCount,
        children_pax_count: input.childrenPaxCount,
        inhouse: input.inhouse,
        guesthouse_name: guesthouseName,
        status: BookingStatus.ACTIVE,
        created_by_user_id: input.createdByUserId,
      },
    });

    await this.prisma.ticket.create({
      data: {
        booking_id: booking.id,
        token_hash: tokenHash,
      },
    });

    await this.generateTicketPdf(booking.id, rawToken);

    return {
      booking,
      token: rawToken,
      ticketUrl: `/api/bookings/${booking.id}/ticket`,
    };
  }

  async cancelBooking(bookingId: string, cancelledByUserId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== BookingStatus.ACTIVE) {
      throw new BadRequestException('Only ACTIVE bookings can be cancelled');
    }

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
        cancelled_by_user_id: cancelledByUserId,
        cancelled_at: new Date(),
      },
    });
  }

  async getTicketPath(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    return join(process.cwd(), 'tickets', `${bookingId}.pdf`);
  }

  async updateBooking(
    bookingId: string,
    input: {
      tripId?: string;
      guestName?: string;
      adultPaxCount?: number;
      childrenPaxCount?: number;
      inhouse?: boolean;
      guesthouseName?: string;
      status?: BookingStatus;
    },
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (input.tripId) {
      const trip = await this.prisma.trip.findUnique({
        where: { id: input.tripId },
        select: { id: true },
      });
      if (!trip) {
        throw new NotFoundException('Trip not found');
      }
    }

    if (input.adultPaxCount !== undefined) {
      if (!Number.isInteger(input.adultPaxCount) || input.adultPaxCount < 1) {
        throw new BadRequestException('adultPaxCount must be an integer >= 1');
      }
    }
    if (input.childrenPaxCount !== undefined) {
      if (
        !Number.isInteger(input.childrenPaxCount) ||
        input.childrenPaxCount < 0
      ) {
        throw new BadRequestException(
          'childrenPaxCount must be an integer >= 0',
        );
      }
    }

    const nextInhouse = input.inhouse ?? booking.inhouse;
    const nextTripId = input.tripId ?? booking.trip_id;
    const nextAdultPaxCount = input.adultPaxCount ?? booking.adult_pax_count;
    const nextChildrenPaxCount =
      input.childrenPaxCount ?? booking.children_pax_count;

    await this.assertCapacityAvailable({
      tripId: nextTripId,
      adultPaxCount: nextAdultPaxCount,
      childrenPaxCount: nextChildrenPaxCount,
      excludeBookingId: booking.id,
    });

    const propertyName = process.env.PROPERTY_NAME ?? 'Property';
    const nextGuesthouseName = nextInhouse
      ? propertyName
      : (input.guesthouseName ?? booking.guesthouse_name).trim();

    if (!nextGuesthouseName) {
      throw new BadRequestException(
        'guesthouse_name is required when inhouse is false',
      );
    }

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        trip_id: input.tripId,
        guest_name: input.guestName,
        adult_pax_count: input.adultPaxCount,
        children_pax_count: input.childrenPaxCount,
        inhouse: nextInhouse,
        guesthouse_name: nextGuesthouseName,
        status: input.status,
      },
    });
  }

  async deleteBooking(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.checkin.deleteMany({ where: { booking_id: bookingId } });
      await tx.ticket.deleteMany({ where: { booking_id: bookingId } });
      await tx.booking.delete({ where: { id: bookingId } });
    });

    return { deleted: true, bookingId };
  }

  private async generateTicketPdf(bookingId: string, token: string) {
    await fs.mkdir(join(process.cwd(), 'tickets'), { recursive: true });
    const outputPath = join(process.cwd(), 'tickets', `${bookingId}.pdf`);
    const qrSvg: string = await QRCode.toString(token, { type: 'svg' });

    const escaped = (value: string) => value.replace(/[()]/g, '');
    const content = `BT /F1 12 Tf 50 780 Td (${escaped(`Booking ${bookingId}`)}) Tj T* (${escaped(`Token ${token}`)}) Tj ET`;
    const pdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj
4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
5 0 obj<</Length ${content.length}>>stream
${content}
endstream
endobj
6 0 obj<</Type/Metadata/Subtype/XML/Length ${qrSvg.length}>>stream
${qrSvg}
endstream
endobj
xref
0 7
0000000000 65535 f 
trailer<</Size 7/Root 1 0 R>>
startxref
0
%%EOF`;

    await fs.writeFile(outputPath, pdf);
  }
}
