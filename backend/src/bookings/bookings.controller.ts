import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { BookingsService } from './bookings.service';

@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

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
      !body.paxCount ||
      body.inhouse === undefined
    ) {
      throw new BadRequestException(
        'tripId, guestName, paxCount, inhouse are required',
      );
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

  @Get(':bookingId/ticket')
  @Roles(UserRole.receptionist, UserRole.super_admin)
  async ticket(@Param('bookingId') bookingId: string, @Res() res: Response) {
    const path = await this.bookingsService.getTicketPath(bookingId);
    return res.sendFile(path);
  }
}
