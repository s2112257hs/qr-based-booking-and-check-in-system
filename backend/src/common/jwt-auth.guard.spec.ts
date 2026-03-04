import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  it('is constructible and exposes canActivate from AuthGuard mixin', () => {
    const guard = new JwtAuthGuard();

    expect(guard).toBeDefined();
    expect(
      typeof (guard as unknown as { canActivate: unknown }).canActivate,
    ).toBe('function');
  });
});
