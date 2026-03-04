import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { ScanService } from './scan.service';

@Controller('scan')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScanController {
  constructor(private readonly scanService: ScanService) {}

  @Post()
  @Roles(UserRole.staff_scanner, UserRole.super_admin)
  scan(
    @Request() req: { user: { id: string } },
    @Body() body: { token?: string; selectedTripId?: string },
  ) {
    if (!body.token || !body.selectedTripId) {
      throw new BadRequestException('token and selectedTripId are required');
    }

    return this.scanService.scan({
      token: body.token,
      selectedTripId: body.selectedTripId,
      scannedByUserId: req.user.id,
    });
  }
}
