import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() body: { userId?: string }) {
    if (!body.userId) throw new BadRequestException('userId is required');
    return this.authService.login(body.userId);
  }
}
