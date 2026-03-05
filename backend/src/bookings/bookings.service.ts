/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, TicketDeliveryStatus } from '@prisma/client';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import { join } from 'path';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';

type TicketEmailDeliveryResult = {
  status: TicketDeliveryStatus;
  message: string;
  recipient?: string;
  outboxPath?: string;
};

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeGuestEmail(email?: string | null): string | undefined {
    const trimmed = email?.trim();
    if (!trimmed) {
      return undefined;
    }

    const normalized = trimmed.toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(normalized)) {
      throw new BadRequestException('guestEmail must be a valid email address');
    }
    return normalized;
  }

  private ticketBaseUrl() {
    const configuredBaseUrl = process.env.TICKET_PUBLIC_BASE_URL?.trim();
    if (configuredBaseUrl) {
      return configuredBaseUrl.replace(/\/+$/, '');
    }
    return `http://localhost:${process.env.PORT ?? '3001'}`;
  }

  private ticketTimezone() {
    return process.env.OPERATING_TIMEZONE?.trim() || 'Indian/Maldives';
  }

  private ticketTimezoneLabel() {
    return process.env.OPERATING_TIMEZONE_LABEL?.trim() || 'GMT+5';
  }

  private formatTripDate(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private formatTripStartTime(time: Date) {
    return time.toISOString().slice(11, 16);
  }

  private formatTicketDisplayDate(date: Date) {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: this.ticketTimezone(),
    }).format(date);
  }

  private formatTicketDisplayTime(time: Date) {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: this.ticketTimezone(),
    }).format(time);
  }

  private formatIssuedAt(issuedAt: Date) {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: this.ticketTimezone(),
    }).format(issuedAt);
  }

  private async deliverTicketToOutbox(input: {
    bookingId: string;
    recipient: string;
    guestName: string;
    tripDate: Date;
    tripStartTime: Date;
    ticketPath: string;
  }): Promise<TicketEmailDeliveryResult> {
    const ticketUrl = `${this.ticketBaseUrl()}/api/bookings/${input.bookingId}/ticket`;
    const outboxDir = join(process.cwd(), 'tickets', 'outbox');
    const createdAt = new Date();
    const payload = {
      to: input.recipient,
      subject: `Trip Ticket - ${input.guestName}`,
      body: [
        `Lead guest: ${input.guestName}`,
        `Trip date: ${this.formatTripDate(input.tripDate)}`,
        `Trip start time: ${this.formatTripStartTime(input.tripStartTime)}`,
        `Ticket URL: ${ticketUrl}`,
        `Ticket PDF path: ${input.ticketPath}`,
      ].join('\n'),
      attachmentPath: input.ticketPath,
      createdAt: createdAt.toISOString(),
    };

    try {
      await fs.mkdir(outboxDir, { recursive: true });
      const outboxFileName = `${createdAt
        .toISOString()
        .replace(/[:.]/g, '-')}-${input.bookingId}.json`;
      const outboxPath = join(outboxDir, outboxFileName);
      await fs.writeFile(outboxPath, JSON.stringify(payload, null, 2));

      await this.prisma.booking.update({
        where: { id: input.bookingId },
        data: {
          guest_email: input.recipient,
          ticket_delivery_status: TicketDeliveryStatus.SENT,
          ticket_delivery_last_attempt_at: createdAt,
          ticket_delivery_last_error: null,
        },
      });

      return {
        status: TicketDeliveryStatus.SENT,
        message: 'Ticket email queued to local outbox.',
        recipient: input.recipient,
        outboxPath,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to queue ticket email to outbox.';

      await this.prisma.booking
        .update({
          where: { id: input.bookingId },
          data: {
            guest_email: input.recipient,
            ticket_delivery_status: TicketDeliveryStatus.FAILED,
            ticket_delivery_last_attempt_at: new Date(),
            ticket_delivery_last_error: message,
          },
        })
        .catch(() => undefined);

      return {
        status: TicketDeliveryStatus.FAILED,
        message,
        recipient: input.recipient,
      };
    }
  }

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
    guestEmail: string;
    sendTicketEmail?: boolean;
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
    const guestEmail = this.normalizeGuestEmail(input.guestEmail);
    if (!guestEmail) {
      throw new BadRequestException('guestEmail is required');
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
        guest_email: guestEmail,
        status: BookingStatus.ACTIVE,
        ticket_delivery_status: input.sendTicketEmail
          ? TicketDeliveryStatus.PENDING
          : TicketDeliveryStatus.NOT_REQUESTED,
        created_by_user_id: input.createdByUserId,
      },
    });

    await this.prisma.ticket.create({
      data: {
        booking_id: booking.id,
        token_hash: tokenHash,
      },
    });

    const ticketPath = await this.generateTicketPdf({
      bookingId: booking.id,
      token: rawToken,
      guestName: booking.guest_name,
      guestEmail,
      tripDate: trip.date,
      tripStartTime: trip.start_time,
    });

    let emailDelivery: TicketEmailDeliveryResult = {
      status: TicketDeliveryStatus.NOT_REQUESTED,
      message: 'Ticket email not requested.',
    };

    if (input.sendTicketEmail) {
      emailDelivery = await this.deliverTicketToOutbox({
        bookingId: booking.id,
        recipient: guestEmail,
        guestName: booking.guest_name,
        tripDate: trip.date,
        tripStartTime: trip.start_time,
        ticketPath,
      });
    }

    return {
      booking,
      token: rawToken,
      ticketUrl: `/api/bookings/${booking.id}/ticket`,
      emailDelivery,
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
      guestEmail?: string;
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
    const nextGuestEmail =
      input.guestEmail === undefined
        ? undefined
        : this.normalizeGuestEmail(input.guestEmail);

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        trip_id: input.tripId,
        guest_name: input.guestName,
        adult_pax_count: input.adultPaxCount,
        children_pax_count: input.childrenPaxCount,
        inhouse: nextInhouse,
        guesthouse_name: nextGuesthouseName,
        guest_email:
          input.guestEmail === undefined ? undefined : (nextGuestEmail ?? null),
        status: input.status,
      },
    });
  }

  async sendTicketEmail(bookingId: string, email?: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        trip: true,
      },
    });
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const recipient = this.normalizeGuestEmail(email ?? booking.guest_email);
    if (!recipient) {
      throw new BadRequestException(
        'No guest email available. Provide email or update booking with guestEmail.',
      );
    }

    const ticketPath = join(process.cwd(), 'tickets', `${booking.id}.pdf`);
    try {
      await fs.access(ticketPath);
    } catch {
      throw new NotFoundException('Ticket PDF not found for booking');
    }

    await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        guest_email: recipient,
        ticket_delivery_status: TicketDeliveryStatus.PENDING,
      },
    });

    return this.deliverTicketToOutbox({
      bookingId: booking.id,
      recipient,
      guestName: booking.guest_name,
      tripDate: booking.trip.date,
      tripStartTime: booking.trip.start_time,
      ticketPath,
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

  private async generateTicketPdf(input: {
    bookingId: string;
    token: string;
    guestName: string;
    guestEmail: string;
    tripDate: Date;
    tripStartTime: Date;
  }) {
    await fs.mkdir(join(process.cwd(), 'tickets'), { recursive: true });
    const outputPath = join(process.cwd(), 'tickets', `${input.bookingId}.pdf`);
    const qrDataUrl = await QRCode.toDataURL(input.token, {
      type: 'image/png',
      margin: 1,
      width: 320,
    });
    const qrImageBase64 = qrDataUrl.split(',')[1];
    if (!qrImageBase64) {
      throw new BadRequestException('Failed to generate ticket QR code image');
    }
    const qrImageBuffer = Buffer.from(qrImageBase64, 'base64');

    const document = new PDFDocument({
      size: 'A4',
      margin: 48,
    });
    const chunks: Buffer[] = [];
    document.on('data', (chunk: Buffer) => chunks.push(chunk));

    const pageWidth = document.page.width;
    const pageHeight = document.page.height;
    const marginLeft = document.page.margins.left;
    const marginRight = document.page.margins.right;
    const contentWidth = pageWidth - marginLeft - marginRight;
    const qrSize = 170;
    const qrX = pageWidth - marginRight - qrSize;
    const headerY = 52;
    const titleWidth = contentWidth - qrSize - 24;
    const propertyName = (process.env.PROPERTY_NAME ?? 'Trip Booking').trim();

    document
      .font('Helvetica-Bold')
      .fontSize(34)
      .fillColor('#0f172a')
      .text(propertyName, marginLeft, headerY, {
        width: titleWidth,
      });

    document
      .font('Helvetica')
      .fontSize(13)
      .fillColor('#334155')
      .text('Boarding Pass Ticket', marginLeft, headerY + 52, {
        width: titleWidth,
      });

    document
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#64748b')
      .text('Please present this QR code before boarding.', marginLeft, headerY + 72, {
        width: titleWidth,
      });

    document
      .roundedRect(qrX - 8, headerY - 8, qrSize + 16, qrSize + 16, 8)
      .lineWidth(1)
      .strokeColor('#cbd5e1')
      .stroke();
    document.image(qrImageBuffer, qrX, headerY, {
      fit: [qrSize, qrSize],
      align: 'right',
    });

    const dividerY = headerY + qrSize + 24;
    document
      .moveTo(marginLeft, dividerY)
      .lineTo(pageWidth - marginRight, dividerY)
      .lineWidth(1)
      .strokeColor('#e2e8f0')
      .stroke();

    let cursorY = dividerY + 24;
    const labelWidth = 120;
    const lineHeight = 24;
    const field = (label: string, value: string) => {
      document
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#334155')
        .text(label, marginLeft, cursorY, {
          width: labelWidth,
        });
      document
        .font('Helvetica')
        .fontSize(12)
        .fillColor('#0f172a')
        .text(value, marginLeft + labelWidth, cursorY, {
          width: contentWidth - labelWidth,
        });
      cursorY += lineHeight;
    };

    field('Guest Name', input.guestName);
    field('Guest Email', input.guestEmail);
    field('Trip Date', this.formatTicketDisplayDate(input.tripDate));
    field(
      `Trip Time (${this.ticketTimezoneLabel()})`,
      this.formatTicketDisplayTime(input.tripStartTime),
    );

    cursorY += 14;
    document
      .roundedRect(marginLeft, cursorY, contentWidth, 84, 8)
      .fillAndStroke('#f8fafc', '#e2e8f0');
    document
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor('#334155')
      .text('Ticket Information', marginLeft + 14, cursorY + 12);
    document
      .font('Helvetica')
      .fontSize(11)
      .fillColor('#0f172a')
      .text(`Reference: ${input.bookingId}`, marginLeft + 14, cursorY + 32);
    document.text(
      `Issued: ${this.formatIssuedAt(new Date())} (${this.ticketTimezoneLabel()})`,
      marginLeft + 14,
      cursorY + 50,
    );

    const footerY = pageHeight - document.page.margins.bottom - 24;
    document
      .font('Helvetica')
      .fontSize(9)
      .fillColor('#64748b')
      .text(
        'This ticket is valid only for the scheduled trip date and selected trip.',
        marginLeft,
        footerY,
        { width: contentWidth, align: 'left' },
      );

    document.end();
    await new Promise<void>((resolve, reject) => {
      document.once('end', () => resolve());
      document.once('error', (error) => reject(error));
    });
    await fs.writeFile(outputPath, Buffer.concat(chunks));

    return outputPath;
  }
}
