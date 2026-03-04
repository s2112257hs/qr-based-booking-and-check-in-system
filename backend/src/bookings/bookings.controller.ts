import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { BookingStatus, UserRole } from '@prisma/client';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { BookingsService } from './bookings.service';

@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  @Roles(UserRole.receptionist, UserRole.super_admin)
  list(@Query('tripId') tripId?: string) {
    return this.bookingsService.listBookings(tripId);
  }

  @Post()
  @Roles(UserRole.receptionist, UserRole.super_admin)
  create(
    @Request() req: { user: { id: string } },
    @Body()
    body: {
      tripId?: string;
      guestName?: string;
      paxCount?: number;
      inhouse?: boolean;
      guesthouseName?: string;
    },
  ) {
    if (
      !body.tripId ||
      !body.guestName ||
      body.paxCount === undefined ||
      body.inhouse === undefined
    ) {
      throw new BadRequestException(
        'tripId, guestName, paxCount, inhouse are required',
      );
    }
    if (!Number.isInteger(body.paxCount) || body.paxCount < 1) {
      throw new BadRequestException('paxCount must be an integer >= 1');
    }

    return this.bookingsService.createBooking({
      tripId: body.tripId,
      guestName: body.guestName,
      paxCount: body.paxCount,
      inhouse: body.inhouse,
      guesthouseName: body.guesthouseName,
      createdByUserId: req.user.id,
    });
  }

  @Patch(':bookingId/cancel')
  @Roles(UserRole.receptionist, UserRole.super_admin)
  cancel(
    @Param('bookingId') bookingId: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.bookingsService.cancelBooking(bookingId, req.user.id);
  }

  @Patch(':bookingId')
  @Roles(UserRole.super_admin)
  update(
    @Param('bookingId') bookingId: string,
    @Body()
    body: {
      tripId?: string;
      guestName?: string;
      paxCount?: number;
      inhouse?: boolean;
      guesthouseName?: string;
      status?: BookingStatus;
    },
  ) {
    if (body.paxCount !== undefined) {
      if (!Number.isInteger(body.paxCount) || body.paxCount < 1) {
        throw new BadRequestException('paxCount must be an integer >= 1');
      }
    }
    if (body.status && !Object.values(BookingStatus).includes(body.status)) {
      throw new BadRequestException(
        `status must be one of: ${Object.values(BookingStatus).join(', ')}`,
      );
    }

    return this.bookingsService.updateBooking(bookingId, body);
  }

  @Delete(':bookingId')
  @Roles(UserRole.super_admin)
  remove(@Param('bookingId') bookingId: string) {
    return this.bookingsService.deleteBooking(bookingId);
  }

  @Get(':bookingId/ticket')
  @Roles(UserRole.receptionist, UserRole.super_admin)
  async ticket(@Param('bookingId') bookingId: string, @Res() res: Response) {
    const path = await this.bookingsService.getTicketPath(bookingId);
    return res.sendFile(path);
  }
}
