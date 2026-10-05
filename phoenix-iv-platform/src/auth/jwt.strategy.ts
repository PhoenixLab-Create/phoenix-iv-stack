import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../config/prisma.service';

interface JwtPayload {
  sub: string;
  sid: string;
  roles: string[];
  permissions: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly idleSeconds: number;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET'),
    });
    this.idleSeconds = Number(config.get('STAFF_IDLE_TIMEOUT_SECONDS') ?? 900);
  }

  // Whatever this returns becomes req.user — consumed by PermissionsGuard
  // and AuditInterceptor. Beyond verifying the JWT's signature and expiry
  // (handled by passport-jwt itself), this also checks the backing Session
  // row so logout() and admin-initiated revocation take effect immediately,
  // and extends the session's idle window on every authenticated request —
  // the actual idle-timeout enforcement the architecture review calls for,
  // not just a fixed-length access token.
  async validate(payload: JwtPayload) {
    const session = await this.prisma.session.findUnique({ where: { id: payload.sid } });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired or revoked. Please log in again.');
    }
    await this.prisma.session.update({
      where: { id: payload.sid },
      data: { expiresAt: new Date(Date.now() + this.idleSeconds * 1000) },
    });

    return {
      id: payload.sub,
      sid: payload.sid,
      role: payload.roles?.[0] ?? null, // primary role; a user could hold more than one
      roles: payload.roles ?? [],
      permissions: payload.permissions ?? [],
    };
  }
}
