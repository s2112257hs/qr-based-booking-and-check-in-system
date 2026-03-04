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

  async createBooking(input: {
    tripId: string;
    guestName: string;
    paxCount: number;
    inhouse: boolean;
    guesthouseName?: string;
    createdByUserId: string;
  }) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: input.tripId },
    });
    if (!trip) throw new NotFoundException('Trip not found');

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
        pax_count: input.paxCount,
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
