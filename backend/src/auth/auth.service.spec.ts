/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

describe('AuthService', () => {
  const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns access token and user for active user', async () => {
    const prisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'u1',
          username: 'reception',
          password_hash: '$2b$10$hash',
          role: UserRole.receptionist,
          is_active: true,
        }),
      },
    };
    const jwtService: any = {
      sign: jest.fn().mockReturnValue('token-123'),
    };
    const service = new AuthService(prisma, jwtService);

    mockedBcrypt.compare.mockResolvedValue(true);

    const result = await service.login('reception', 'secret123');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { username: 'reception' },
    });
    expect(mockedBcrypt.compare).toHaveBeenCalledWith('secret123', '$2b$10$hash');
    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: 'u1',
      role: UserRole.receptionist,
    });
    expect(result).toEqual({
      access_token: 'token-123',
      user: {
        id: 'u1',
        username: 'reception',
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

    await expect(service.login('missing', 'secret123')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    expect(jwtService.sign).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when user inactive', async () => {
    const prisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'u2',
          username: 'scanner',
          password_hash: '$2b$10$hash',
          role: UserRole.staff_scanner,
          is_active: false,
        }),
      },
    };
    const jwtService: any = { sign: jest.fn() };
    const service = new AuthService(prisma, jwtService);

    await expect(service.login('scanner', 'secret123')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    expect(jwtService.sign).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when password is invalid', async () => {
    const prisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'u3',
          username: 'admin',
          password_hash: '$2b$10$hash',
          role: UserRole.super_admin,
          is_active: true,
        }),
      },
    };
    const jwtService: any = { sign: jest.fn() };
    const service = new AuthService(prisma, jwtService);
    mockedBcrypt.compare.mockResolvedValue(false);

    await expect(service.login('admin', 'wrong-pass')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(jwtService.sign).not.toHaveBeenCalled();
  });
});
