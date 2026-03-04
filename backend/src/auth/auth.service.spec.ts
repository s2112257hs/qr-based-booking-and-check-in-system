/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('returns access token and user for active user', async () => {
    const prisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'u1',
          role: UserRole.receptionist,
          is_active: true,
        }),
      },
    };
    const jwtService: any = {
      sign: jest.fn().mockReturnValue('token-123'),
    };
    const service = new AuthService(prisma, jwtService);

    const result = await service.login('u1');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'u1' },
    });
    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: 'u1',
      role: UserRole.receptionist,
    });
    expect(result).toEqual({
      access_token: 'token-123',
      user: {
        id: 'u1',
        role: UserRole.receptionist,
        is_active: true,
      },
    });
  });

  it('throws UnauthorizedException when user not found', async () => {
    const prisma: any = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const jwtService: any = { sign: jest.fn() };
    const service = new AuthService(prisma, jwtService);

    await expect(service.login('missing')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(jwtService.sign).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when user inactive', async () => {
    const prisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'u2',
          role: UserRole.staff_scanner,
          is_active: false,
        }),
      },
    };
    const jwtService: any = { sign: jest.fn() };
    const service = new AuthService(prisma, jwtService);

    await expect(service.login('u2')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(jwtService.sign).not.toHaveBeenCalled();
  });
});
