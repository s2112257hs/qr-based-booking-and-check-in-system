import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { boatName, UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { TripsService } from './trips.service';

@Controller('trips')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post()
  @Roles(UserRole.receptionist, UserRole.super_admin)
  create(
    @Request() req: { user: { id: string } },
    @Body() body: { date?: string; startTime?: string; boat?: boatName },
  ) {
    if (!body.date || !body.startTime)
      throw new BadRequestException('date and startTime are required');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      throw new BadRequestException('date must be in YYYY-MM-DD format');
    }
    if (!/^\d{2}:\d{2}$/.test(body.startTime)) {
      throw new BadRequestException('startTime must be in HH:mm format');
    }
    if (body.boat && !Object.values(boatName).includes(body.boat)) {
      throw new BadRequestException(
        `boat must be one of: ${Object.values(boatName).join(', ')}`,
      );
    }
    return this.tripsService.createTrip({
      date: body.date,
      startTime: body.startTime,
      boat: body.boat,
      createdByUserId: req.user.id,
    });
  }

  @Get()
  @Roles(UserRole.receptionist, UserRole.super_admin)
  list() {
    return this.tripsService.listTrips();
  }

  @Get(':tripId')
  @Roles(UserRole.super_admin)
  details(@Param('tripId') tripId: string) {
    return this.tripsService.getTripDetails(tripId);
  }

  @Patch(':tripId')
  @Roles(UserRole.super_admin)
  update(
    @Param('tripId') tripId: string,
    @Body() body: { date?: string; startTime?: string; boat?: boatName },
  ) {
    if (body.date && !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
      throw new BadRequestException('date must be in YYYY-MM-DD format');
    }
    if (body.startTime && !/^\d{2}:\d{2}$/.test(body.startTime)) {
      throw new BadRequestException('startTime must be in HH:mm format');
    }
    if (body.boat && !Object.values(boatName).includes(body.boat)) {
      throw new BadRequestException(
        `boat must be one of: ${Object.values(boatName).join(', ')}`,
      );
    }

    return this.tripsService.updateTrip(tripId, body);
  }

  @Delete(':tripId')
  @Roles(UserRole.super_admin)
  remove(@Param('tripId') tripId: string) {
    return this.tripsService.deleteTrip(tripId);
  }
}
