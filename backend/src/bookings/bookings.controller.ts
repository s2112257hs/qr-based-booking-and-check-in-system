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
      adultPaxCount?: number;
      childrenPaxCount?: number;
      inhouse?: boolean;
      guesthouseName?: string;
      guestEmail?: string;
      sendTicketEmail?: boolean;
    },
  ) {
    if (
      !body.tripId ||
      !body.guestName ||
      body.adultPaxCount === undefined ||
      body.childrenPaxCount === undefined ||
      body.inhouse === undefined ||
      body.guestEmail === undefined
    ) {
      throw new BadRequestException(
        'tripId, guestName, guestEmail, adultPaxCount, childrenPaxCount, inhouse are required',
      );
    }
    if (!Number.isInteger(body.adultPaxCount) || body.adultPaxCount < 1) {
      throw new BadRequestException('adultPaxCount must be an integer >= 1');
    }
    if (!Number.isInteger(body.childrenPaxCount) || body.childrenPaxCount < 0) {
      throw new BadRequestException(
        'childrenPaxCount must be an integer >= 0',
      );
    }
    if (
      body.sendTicketEmail !== undefined &&
      typeof body.sendTicketEmail !== 'boolean'
    ) {
      throw new BadRequestException('sendTicketEmail must be a boolean');
    }

    return this.bookingsService.createBooking({
      tripId: body.tripId,
      guestName: body.guestName,
      adultPaxCount: body.adultPaxCount,
      childrenPaxCount: body.childrenPaxCount,
      inhouse: body.inhouse,
      guesthouseName: body.guesthouseName,
      guestEmail: body.guestEmail,
      sendTicketEmail: body.sendTicketEmail,
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
  @Roles(UserRole.receptionist, UserRole.super_admin)
  update(
    @Param('bookingId') bookingId: string,
    @Body()
    body: {
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
    if (body.adultPaxCount !== undefined) {
      if (!Number.isInteger(body.adultPaxCount) || body.adultPaxCount < 1) {
        throw new BadRequestException('adultPaxCount must be an integer >= 1');
      }
    }
    if (body.childrenPaxCount !== undefined) {
      if (
        !Number.isInteger(body.childrenPaxCount) ||
        body.childrenPaxCount < 0
      ) {
        throw new BadRequestException(
          'childrenPaxCount must be an integer >= 0',
        );
      }
    }
    if (body.status && !Object.values(BookingStatus).includes(body.status)) {
      throw new BadRequestException(
        `status must be one of: ${Object.values(BookingStatus).join(', ')}`,
      );
    }

    return this.bookingsService.updateBooking(bookingId, body);
  }

  @Post(':bookingId/send-ticket')
  @Roles(UserRole.receptionist, UserRole.super_admin)
  sendTicket(
    @Param('bookingId') bookingId: string,
    @Body() body: { email?: string },
  ) {
    return this.bookingsService.sendTicketEmail(bookingId, body.email);
  }

  @Delete(':bookingId')
  @Roles(UserRole.receptionist, UserRole.super_admin)
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
