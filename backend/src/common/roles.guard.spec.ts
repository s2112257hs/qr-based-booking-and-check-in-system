/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
import { UserRole } from '@prisma/client';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

const createContext = (user?: { role: UserRole }) =>
  ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  }) as any;

describe('RolesGuard', () => {
  it('allows when no roles are required', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('denies when roles are required but request has no user', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([UserRole.super_admin]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(guard.canActivate(createContext())).toBe(false);
  });

  it('allows when user role is in required roles', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue([UserRole.receptionist, UserRole.super_admin]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(
      guard.canActivate(createContext({ role: UserRole.receptionist })),
    ).toBe(true);
  });

  it('denies when user role is not in required roles', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([UserRole.super_admin]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(
      guard.canActivate(createContext({ role: UserRole.staff_scanner })),
    ).toBe(false);
  });
});
