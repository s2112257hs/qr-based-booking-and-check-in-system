import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
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
    @Body() body: { date?: string; startTime?: string; boat?: string },
  ) {
    if (!body.date || !body.startTime)
      throw new BadRequestException('date and startTime are required');
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
}
