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
    @Body()
    body: {
      date?: string;
      startTime?: string;
      boat?: boatName;
      tripTypeCodes?: string[];
      maxCapacity?: number;
    },
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
    if (!Array.isArray(body.tripTypeCodes)) {
      throw new BadRequestException('tripTypeCodes must be an array');
    }
    if (
      body.tripTypeCodes.length < 1 ||
      body.tripTypeCodes.length > 2 ||
      new Set(body.tripTypeCodes).size !== body.tripTypeCodes.length ||
      body.tripTypeCodes.some((value) => !value || typeof value !== 'string')
    ) {
      throw new BadRequestException(
        'tripTypeCodes must contain 1 or 2 unique non-empty strings',
      );
    }
    if (body.maxCapacity !== undefined) {
      if (!Number.isInteger(body.maxCapacity) || body.maxCapacity < 1) {
        throw new BadRequestException('maxCapacity must be an integer >= 1');
      }
    }
    return this.tripsService.createTrip({
      date: body.date,
      startTime: body.startTime,
      boat: body.boat,
      tripTypeCodes: body.tripTypeCodes,
      maxCapacity: body.maxCapacity,
      createdByUserId: req.user.id,
    });
  }

  @Get()
  @Roles(UserRole.receptionist, UserRole.super_admin, UserRole.staff_scanner)
  list(@Query('boat') boat?: boatName) {
    if (boat && !Object.values(boatName).includes(boat)) {
      throw new BadRequestException(
        `boat must be one of: ${Object.values(boatName).join(', ')}`,
      );
    }
    return this.tripsService.listTrips(boat);
  }

  @Get(':tripId')
  @Roles(UserRole.super_admin)
  details(@Param('tripId') tripId: string) {
    return this.tripsService.getTripDetails(tripId);
  }

  @Patch(':tripId')
  @Roles(UserRole.receptionist, UserRole.super_admin)
  update(
    @Param('tripId') tripId: string,
    @Body()
    body: {
      date?: string;
      startTime?: string;
      boat?: boatName;
      tripTypeCodes?: string[];
      maxCapacity?: number;
    },
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
    if (body.tripTypeCodes !== undefined) {
      if (!Array.isArray(body.tripTypeCodes)) {
        throw new BadRequestException('tripTypeCodes must be an array');
      }
      if (
        body.tripTypeCodes.length < 1 ||
        body.tripTypeCodes.length > 2 ||
        new Set(body.tripTypeCodes).size !== body.tripTypeCodes.length ||
        body.tripTypeCodes.some((value) => !value || typeof value !== 'string')
      ) {
        throw new BadRequestException(
          'tripTypeCodes must contain 1 or 2 unique non-empty strings',
        );
      }
    }
    if (body.maxCapacity !== undefined) {
      if (!Number.isInteger(body.maxCapacity) || body.maxCapacity < 1) {
        throw new BadRequestException('maxCapacity must be an integer >= 1');
      }
    }

    return this.tripsService.updateTrip(tripId, body);
  }

  @Delete(':tripId')
  @Roles(UserRole.super_admin)
  remove(@Param('tripId') tripId: string) {
    return this.tripsService.deleteTrip(tripId);
  }
}
