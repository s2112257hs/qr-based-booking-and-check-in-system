/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingStatus, TicketDeliveryStatus } from '@prisma/client';
import { BookingsService } from './bookings.service';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('qrcode', () => ({
  toDataURL: jest
    .fn()
    .mockResolvedValue(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5fNf0AAAAASUVORK5CYII=',
    ),
}));

describe('BookingsService', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    process.env.PROPERTY_NAME = 'Test Property';
  });

  it('creates booking, ticket hash and returns ticket url', async () => {
    const prisma: any = {
      trip: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ id: 'trip-1' })
          .mockResolvedValueOnce({ id: 'trip-1', max_capacity: 40 }),
      },
      booking: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'booking-1' }),
      },
      ticket: {
        create: jest.fn().mockResolvedValue({ booking_id: 'booking-1' }),
      },
    };
    const service = new BookingsService(prisma);

    const result = await service.createBooking({
      tripId: 'trip-1',
      guestName: 'Jane Doe',
      guestEmail: 'jane@example.com',
      adultPaxCount: 2,
      childrenPaxCount: 1,
      inhouse: true,
      createdByUserId: 'receptionist-1',
    });

    expect(prisma.booking.create).toHaveBeenCalledWith({
      data: {
        trip_id: 'trip-1',
        guest_name: 'Jane Doe',
        adult_pax_count: 2,
        children_pax_count: 1,
        inhouse: true,
        guesthouse_name: 'Test Property',
        guest_email: 'jane@example.com',
        status: BookingStatus.ACTIVE,
        ticket_delivery_status: TicketDeliveryStatus.NOT_REQUESTED,
        created_by_user_id: 'receptionist-1',
      },
    });
    expect(prisma.ticket.create).toHaveBeenCalledWith({
      data: {
        booking_id: 'booking-1',
        token_hash: expect.any(String),
      },
    });
    const tokenHash = prisma.ticket.create.mock.calls[0][0].data.token_hash;
    expect(tokenHash).toHaveLength(64);
    expect(result).toEqual({
      booking: { id: 'booking-1' },
      token: expect.any(String),
      ticketUrl: '/api/bookings/booking-1/ticket',
      emailDelivery: {
        status: TicketDeliveryStatus.NOT_REQUESTED,
        message: 'Ticket email not requested.',
      },
    });
    expect(result.token).toHaveLength(64);
  });

  it('queues ticket email to outbox when requested during booking creation', async () => {
    const prisma: any = {
      trip: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'trip-1',
            date: new Date('2026-03-05'),
            start_time: new Date('1970-01-01T09:00:00.000Z'),
          })
          .mockResolvedValueOnce({ id: 'trip-1', max_capacity: 40 }),
      },
      booking: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({
          id: 'booking-1',
          guest_name: 'Jane Doe',
        }),
        update: jest.fn().mockResolvedValue({ id: 'booking-1' }),
      },
      ticket: {
        create: jest.fn().mockResolvedValue({ booking_id: 'booking-1' }),
      },
    };
    const service = new BookingsService(prisma);

    const result = await service.createBooking({
      tripId: 'trip-1',
      guestName: 'Jane Doe',
      adultPaxCount: 2,
      childrenPaxCount: 0,
      inhouse: true,
      guestEmail: 'guest@example.com',
      sendTicketEmail: true,
      createdByUserId: 'receptionist-1',
    });

    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: expect.objectContaining({
        guest_email: 'guest@example.com',
        ticket_delivery_status: TicketDeliveryStatus.SENT,
      }),
    });
    expect(result.emailDelivery).toEqual(
      expect.objectContaining({
        status: TicketDeliveryStatus.SENT,
        recipient: 'guest@example.com',
      }),
    );
  });

  it('throws NotFoundException when trip does not exist', async () => {
    const prisma: any = {
      trip: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new BookingsService(prisma);

    await expect(
      service.createBooking({
        tripId: 'missing-trip',
        guestName: 'Jane Doe',
        guestEmail: 'jane@example.com',
        adultPaxCount: 2,
        childrenPaxCount: 0,
        inhouse: true,
        createdByUserId: 'u1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws BadRequestException when guesthouse is missing for non-inhouse booking', async () => {
    const prisma: any = {
      trip: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ id: 'trip-1' })
          .mockResolvedValueOnce({ id: 'trip-1', max_capacity: 40 }),
      },
      booking: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new BookingsService(prisma);

    await expect(
      service.createBooking({
        tripId: 'trip-1',
        guestName: 'Jane Doe',
        guestEmail: 'jane@example.com',
        adultPaxCount: 2,
        childrenPaxCount: 0,
        inhouse: false,
        guesthouseName: '   ',
        createdByUserId: 'u1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws BadRequestException when guest email is missing', async () => {
    const prisma: any = {
      trip: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ id: 'trip-1' })
          .mockResolvedValueOnce({ id: 'trip-1', max_capacity: 40 }),
      },
      booking: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new BookingsService(prisma);

    await expect(
      service.createBooking({
        tripId: 'trip-1',
        guestName: 'Jane Doe',
        guestEmail: '',
        adultPaxCount: 1,
        childrenPaxCount: 0,
        inhouse: true,
        createdByUserId: 'u1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cancels active booking', async () => {
    const prisma: any = {
      booking: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'booking-1', status: BookingStatus.ACTIVE }),
        update: jest.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.CANCELLED,
        }),
      },
    };
    const service = new BookingsService(prisma);

    const result = await service.cancelBooking('booking-1', 'u2');

    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: expect.objectContaining({
        status: BookingStatus.CANCELLED,
        cancelled_by_user_id: 'u2',
      }),
    });
    expect(result.status).toBe(BookingStatus.CANCELLED);
  });

  it('rejects cancellation for non-active booking', async () => {
    const prisma: any = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.CHECKED_IN,
        }),
      },
    };
    const service = new BookingsService(prisma);

    await expect(
      service.cancelBooking('booking-1', 'u2'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns ticket path for existing booking', async () => {
    const prisma: any = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({ id: 'booking-1' }),
      },
    };
    const service = new BookingsService(prisma);

    const path = await service.getTicketPath('booking-1');

    expect(
      path.endsWith('tickets\\booking-1.pdf') ||
        path.endsWith('tickets/booking-1.pdf'),
    ).toBe(true);
  });

  it('throws NotFoundException when ticket booking does not exist', async () => {
    const prisma: any = {
      booking: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const service = new BookingsService(prisma);

    await expect(service.getTicketPath('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('sends ticket email for existing booking', async () => {
    const prisma: any = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-1',
          guest_name: 'Guest One',
          guest_email: 'guest@example.com',
          trip: {
            date: new Date('2026-03-05'),
            start_time: new Date('1970-01-01T09:00:00.000Z'),
          },
        }),
        update: jest.fn().mockResolvedValue({ id: 'booking-1' }),
      },
    };
    const service = new BookingsService(prisma);

    const result = await service.sendTicketEmail('booking-1');

    expect(result.status).toBe(TicketDeliveryStatus.SENT);
    expect(prisma.booking.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 'booking-1' },
        data: expect.objectContaining({
          ticket_delivery_status: TicketDeliveryStatus.PENDING,
        }),
      }),
    );
    expect(prisma.booking.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 'booking-1' },
        data: expect.objectContaining({
          ticket_delivery_status: TicketDeliveryStatus.SENT,
        }),
      }),
    );
  });
});
