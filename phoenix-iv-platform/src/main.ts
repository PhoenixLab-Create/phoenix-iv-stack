import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(
    helmet({
      // This API serves JSON, not HTML — no inline scripts/styles to allow,
      // so the CSP is deliberately locked to "nothing loads from anywhere
      // except same-origin". Tighten further (e.g. frame-ancestors 'none')
      // is already implied by default-src 'none'.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      hsts: { maxAge: 63072000, includeSubDomains: true, preload: true }, // 2 years, per HSTS preload list requirements
      referrerPolicy: { policy: 'no-referrer' },
      crossOriginResourcePolicy: { policy: 'same-origin' },
    }),
  );
  app.enableCors({
    // Production: restrict to the clinic's actual staff/patient front-end
    // origins — never "*" for a system handling PHI.
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strips any field not declared in a DTO
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Session idle-timeout (staff 15 min / patient 5 min, per architecture
  // review) — CLOSED in Sprint 6. Both staff and patient sessions are now
  // backed by real, revocable Session rows: JwtStrategy checks and extends
  // the staff session's expiresAt on every authenticated request
  // (src/auth/jwt.strategy.ts), and PatientSessionGuard does the same for
  // patient sessions (src/auth/patient-session.guard.ts). A JWT's own
  // expiry is no longer the only thing standing between a stolen token and
  // continued access — logout() and admin-initiated revocation now take
  // effect immediately rather than waiting out the token's lifetime.

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
