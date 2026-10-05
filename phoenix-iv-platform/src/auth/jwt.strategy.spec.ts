import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy — session revocation enforced on every request', () => {
  let strategy: JwtStrategy;
  let prisma: any;
  let config: any;

  const payload = { sub: 'user-1', sid: 'session-1', roles: ['NURSE_CLINICIAN'], permissions: ['visit.start'] };

  beforeEach(() => {
    config = { get: jest.fn().mockReturnValue(undefined) };
    prisma = { session: { findUnique: jest.fn(), update: jest.fn() } };
    strategy = new JwtStrategy(config, prisma);
  });

  it('rejects when the session has been revoked, even though the JWT itself is still validly signed', async () => {
    prisma.session.findUnique.mockResolvedValue({
      id: 'session-1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 100000),
    });
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects when the session has idle-timed-out', async () => {
    prisma.session.findUnique.mockResolvedValue({
      id: 'session-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    });
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects when no session row exists at all', async () => {
    prisma.session.findUnique.mockResolvedValue(null);
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('extends the session idle window on a valid request and returns req.user with sid attached', async () => {
    prisma.session.findUnique.mockResolvedValue({
      id: 'session-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 100000),
    });
    const result = await strategy.validate(payload);
    expect(prisma.session.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { expiresAt: expect.any(Date) },
    });
    expect(result).toMatchObject({ id: 'user-1', sid: 'session-1', role: 'NURSE_CLINICIAN' });
  });
});
