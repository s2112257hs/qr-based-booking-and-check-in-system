import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
    });
    if (!user || !user.is_active || !user.password_hash) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      throw new UnauthorizedException('Invalid username or password');
    }

    return {
      access_token: this.jwtService.sign({ sub: user.id, role: user.role }),
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        is_active: user.is_active,
      },
    };
  }
}
