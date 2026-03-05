/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { BookingStatus, CheckinResult, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('qrcode', () => ({
  toString: jest.fn().mockResolvedValue('<svg></svg>'),
}));

type TestUser = {
  id: string;
  username: string;
  password_hash: string;
  role: UserRole;
  is_active: boolean;
};

const users: Record<string, TestUser> = {
  reception_user: {
    id: 'receptionist',
    username: 'reception_user',
    password_hash: bcrypt.hashSync('pass123', 4),
    role: UserRole.receptionist,
    is_active: true,
  },
  scanner_user: {
    id: 'scanner',
    username: 'scanner_user',
    password_hash: bcrypt.hashSync('pass123', 4),
    role: UserRole.staff_scanner,
    is_active: true,
  },
  admin_user: {
    id: 'admin',
    username: 'admin_user',
    password_hash: bcrypt.hashSync('pass123', 4),
    role: UserRole.super_admin,
    is_active: true,
  },
  inactive_user: {
    id: 'inactive',
    username: 'inactive_user',
    password_hash: bcrypt.hashSync('pass123', 4),
    role: UserRole.receptionist,
    is_active: false,
  },
};

const createMockPrisma = () => ({
  user: { findUnique: jest.fn() },
  activityType: { findMany: jest.fn() },
  trip: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
  booking: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  ticket: { create: jest.fn(), findUnique: jest.fn() },
  checkin: { create: jest.fn() },
  $transaction: jest.fn(),
});

describe('Backend API (e2e)', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof createMockPrisma>;

  const loginAs = async (
    username: string,
    password = 'pass123',
  ): Promise<string> => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username, password })
      .expect(201);
    return res.body.access_token as string;
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'change-me';
    process.env.PROPERTY_NAME = 'Test Property';
    prisma = createMockPrisma();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    prisma.user.findUnique.mockImplementation(
      async ({ where }: { where: { username: string } }) =>
        users[where.username] ?? null,
    );
    prisma.activityType.findMany.mockResolvedValue([
      {
        id: 'activity-1',
        code: 'DOLPHIN_CRUISE',
        name: 'Dolphin Cruise',
      },
    ]);

    prisma.trip.create.mockImplementation(async ({ data }: any) => ({
      id: 'trip-1',
      ...data,
      created_at: new Date(),
    }));
    prisma.trip.findMany.mockResolvedValue([]);
    prisma.trip.findUnique.mockResolvedValue({ id: 'trip-1' });

    prisma.booking.create.mockImplementation(async ({ data }: any) => ({
      id: 'booking-1',
      ...data,
      created_at: new Date(),
    }));
    prisma.booking.findMany.mockResolvedValue([]);
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking-1',
      status: BookingStatus.ACTIVE,
    });
    prisma.booking.update.mockImplementation(async ({ data }: any) => ({
      id: 'booking-1',
      ...data,
    }));

    prisma.ticket.create.mockResolvedValue({
      booking_id: 'booking-1',
      token_hash: 'hash',
    });
    prisma.ticket.findUnique.mockResolvedValue(null);

    prisma.checkin.create.mockResolvedValue({
      id: 'checkin-1',
      result: CheckinResult.INVALID,
      reason: 'TOKEN_NOT_FOUND',
    });

    prisma.$transaction.mockImplementation(async (work: any) => {
      if (typeof work === 'function') {
        return work({
          checkin: { create: jest.fn().mockResolvedValue({ id: 'checkin-2' }) },
          booking: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
        });
      }
      return Promise.all(work);
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Auth', () => {
    it('POST /auth/login returns 400 for missing username/password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({})
        .expect(400);
    });

    it('POST /auth/login returns 401 for inactive user', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'inactive_user', password: 'pass123' })
        .expect(401);
    });

    it('POST /auth/login returns access token for active user', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'reception_user', password: 'pass123' })
        .expect(201);

      expect(res.body.access_token).toEqual(expect.any(String));
      expect(res.body.user.role).toBe(UserRole.receptionist);
    });
  });

  describe('Trips', () => {
    it('GET /trips returns 401 when no token is provided', async () => {
      await request(app.getHttpServer()).get('/trips').expect(401);
    });

    it('POST /trips returns 403 for staff_scanner role', async () => {
      const token = await loginAs('scanner_user');
      await request(app.getHttpServer())
        .post('/trips')
        .set('Authorization', `Bearer ${token}`)
        .send({
          date: '2026-03-04',
          startTime: '10:00',
          tripTypeCodes: ['DOLPHIN_CRUISE'],
        })
        .expect(403);
    });

    it('POST /trips validates date and time format', async () => {
      const token = await loginAs('reception_user');

      await request(app.getHttpServer())
        .post('/trips')
        .set('Authorization', `Bearer ${token}`)
        .send({
          date: '03/04/2026',
          startTime: '10:00',
          tripTypeCodes: ['DOLPHIN_CRUISE'],
        })
        .expect(400);

      await request(app.getHttpServer())
        .post('/trips')
        .set('Authorization', `Bearer ${token}`)
        .send({
          date: '2026-03-04',
          startTime: '10',
          tripTypeCodes: ['DOLPHIN_CRUISE'],
        })
        .expect(400);
    });

    it('POST /trips creates a trip for receptionist', async () => {
      const token = await loginAs('reception_user');
      const res = await request(app.getHttpServer())
        .post('/trips')
        .set('Authorization', `Bearer ${token}`)
        .send({
          date: '2026-03-04',
          startTime: '10:00',
          boat: 'W_speed',
          tripTypeCodes: ['DOLPHIN_CRUISE'],
        })
        .expect(201);

      expect(res.body.id).toBe('trip-1');
      expect(prisma.trip.create).toHaveBeenCalled();
    });

    it('GET /trips returns trip list', async () => {
      prisma.trip.findMany.mockResolvedValue([
        {
          id: 'trip-1',
          date: new Date('2026-03-04'),
          start_time: new Date(),
          boat: 'W_speed',
          max_capacity: 20,
          created_by_user_id: 'admin',
          created_at: new Date(),
          bookings: [],
          activityTypes: [
            {
              activityType: {
                code: 'DOLPHIN_CRUISE',
                name: 'Dolphin Cruise',
              },
            },
          ],
        },
      ]);
      const token = await loginAs('admin_user');

      const res = await request(app.getHttpServer())
        .get('/trips')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe('trip-1');
    });
  });

  describe('Bookings', () => {
    it('POST /bookings returns 403 for staff_scanner role', async () => {
      const token = await loginAs('scanner_user');
      await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          tripId: 'trip-1',
          guestName: 'Jane',
          adultPaxCount: 1,
          childrenPaxCount: 0,
          inhouse: true,
        })
        .expect(403);
    });

    it('POST /bookings validates required fields and pax counts', async () => {
      const token = await loginAs('reception_user');

      await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({ tripId: 'trip-1' })
        .expect(400);

      await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          tripId: 'trip-1',
          guestName: 'Jane',
          adultPaxCount: 0,
          childrenPaxCount: 0,
          inhouse: true,
        })
        .expect(400);
    });

    it('POST /bookings requires guesthouse_name when inhouse is false', async () => {
      const token = await loginAs('reception_user');

      await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          tripId: 'trip-1',
          guestName: 'Jane',
          adultPaxCount: 2,
          childrenPaxCount: 0,
          inhouse: false,
        })
        .expect(400);
    });

    it('POST /bookings creates booking and uses property name when inhouse is true', async () => {
      const token = await loginAs('reception_user');
      const res = await request(app.getHttpServer())
        .post('/bookings')
        .set('Authorization', `Bearer ${token}`)
        .send({
          tripId: 'trip-1',
          guestName: 'Jane',
          adultPaxCount: 2,
          childrenPaxCount: 1,
          inhouse: true,
        })
        .expect(201);

      expect(res.body.booking.id).toBe('booking-1');
      expect(res.body.ticketUrl).toBe('/api/bookings/booking-1/ticket');
      expect(res.body.token).toEqual(expect.any(String));
      expect(prisma.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            guesthouse_name: 'Test Property',
          }),
        }),
      );
      expect(prisma.ticket.create).toHaveBeenCalled();
    });

    it('PATCH /bookings/:bookingId/cancel cancels an active booking', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.ACTIVE,
      });
      prisma.booking.update.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.CANCELLED,
      });
      const token = await loginAs('reception_user');

      const res = await request(app.getHttpServer())
        .patch('/bookings/booking-1/cancel')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.status).toBe(BookingStatus.CANCELLED);
    });

    it('PATCH /bookings/:bookingId/cancel rejects non-active booking', async () => {
      prisma.booking.findUnique.mockResolvedValue({
        id: 'booking-1',
        status: BookingStatus.CHECKED_IN,
      });
      const token = await loginAs('reception_user');

      await request(app.getHttpServer())
        .patch('/bookings/booking-1/cancel')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });
  });

  describe('Scan', () => {
    const activeTicket = {
      booking: {
        id: 'booking-1',
        status: BookingStatus.ACTIVE,
        trip_id: 'trip-1',
        trip: { id: 'trip-1', date: new Date() },
      },
    };

    it('POST /scan returns 400 for missing payload', async () => {
      const token = await loginAs('scanner_user');
      await request(app.getHttpServer())
        .post('/scan')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(400);
    });

    it('POST /scan returns 403 for receptionist role', async () => {
      const token = await loginAs('reception_user');
      await request(app.getHttpServer())
        .post('/scan')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: 'abc', selectedTripId: 'trip-1' })
        .expect(403);
    });

    it('POST /scan returns TOKEN_NOT_FOUND for unknown token', async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);
      const token = await loginAs('scanner_user');
      const res = await request(app.getHttpServer())
        .post('/scan')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: 'missing', selectedTripId: 'trip-1' })
        .expect(201);

      expect(res.body).toEqual({
        result: CheckinResult.INVALID,
        reason: 'TOKEN_NOT_FOUND',
      });
    });

    it('POST /scan returns SELECTED_TRIP_NOT_FOUND', async () => {
      prisma.ticket.findUnique.mockResolvedValue(activeTicket);
      prisma.trip.findUnique.mockResolvedValue(null);
      const token = await loginAs('scanner_user');
      const res = await request(app.getHttpServer())
        .post('/scan')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: 'ok', selectedTripId: 'trip-x' })
        .expect(201);

      expect(res.body.reason).toBe('SELECTED_TRIP_NOT_FOUND');
    });

    it('POST /scan returns CANCELLED and logs invalid checkin', async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        booking: {
          ...activeTicket.booking,
          status: BookingStatus.CANCELLED,
        },
      });
      prisma.trip.findUnique.mockResolvedValue({ id: 'trip-1' });
      const token = await loginAs('scanner_user');
      const res = await request(app.getHttpServer())
        .post('/scan')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: 'ok', selectedTripId: 'trip-1' })
        .expect(201);

      expect(res.body.reason).toBe('CANCELLED');
      expect(prisma.checkin.create).toHaveBeenCalled();
    });

    it('POST /scan returns WRONG_TRIP', async () => {
      prisma.ticket.findUnique.mockResolvedValue(activeTicket);
      prisma.trip.findUnique.mockResolvedValue({ id: 'trip-2' });
      const token = await loginAs('scanner_user');
      const res = await request(app.getHttpServer())
        .post('/scan')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: 'ok', selectedTripId: 'trip-2' })
        .expect(201);

      expect(res.body.reason).toBe('WRONG_TRIP');
    });

    it('POST /scan returns WRONG_DAY', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      prisma.ticket.findUnique.mockResolvedValue({
        booking: {
          ...activeTicket.booking,
          trip: { id: 'trip-1', date: yesterday },
        },
      });
      prisma.trip.findUnique.mockResolvedValue({ id: 'trip-1' });

      const token = await loginAs('scanner_user');
      const res = await request(app.getHttpServer())
        .post('/scan')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: 'ok', selectedTripId: 'trip-1' })
        .expect(201);

      expect(res.body.reason).toBe('WRONG_DAY');
    });

    it('POST /scan returns VALID and performs transaction', async () => {
      prisma.ticket.findUnique.mockResolvedValue(activeTicket);
      prisma.trip.findUnique.mockResolvedValue({ id: 'trip-1' });
      const token = await loginAs('scanner_user');
      const res = await request(app.getHttpServer())
        .post('/scan')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: 'ok', selectedTripId: 'trip-1' })
        .expect(201);

      expect(res.body).toEqual({
        result: CheckinResult.VALID,
        reason: 'VALID',
      });
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('POST /scan returns DUPLICATE_VALID_CHECKIN on race/duplicate', async () => {
      prisma.ticket.findUnique.mockResolvedValue(activeTicket);
      prisma.trip.findUnique.mockResolvedValue({ id: 'trip-1' });
      prisma.$transaction.mockImplementation(async (work: any) =>
        work({
          checkin: {
            create: jest.fn().mockResolvedValue({ id: 'checkin-valid' }),
          },
          booking: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
        }),
      );
      const token = await loginAs('scanner_user');
      const res = await request(app.getHttpServer())
        .post('/scan')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: 'ok', selectedTripId: 'trip-1' })
        .expect(201);

      expect(res.body.reason).toBe('DUPLICATE_VALID_CHECKIN');
      expect(prisma.checkin.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            result: CheckinResult.INVALID,
            reason: 'DUPLICATE_VALID_CHECKIN',
          }),
        }),
      );
    });
  });
});
