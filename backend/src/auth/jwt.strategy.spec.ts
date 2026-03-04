import { UserRole } from '@prisma/client';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  it('maps payload to request user shape', () => {
    const strategy = new JwtStrategy();

    const result = strategy.validate({
      sub: 'user-1',
      role: UserRole.super_admin,
    });

    expect(result).toEqual({ id: 'user-1', role: UserRole.super_admin });
  });
});
