import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { CurrentUser } from '../common/current-user.decorator';
import { Audit } from '../common/audit/audit.decorator';

class LoginDto {
  @IsString()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

class MfaVerifyDto {
  @IsString()
  mfaChallengeToken!: string;

  @IsString()
  @MinLength(6)
  totpCode!: string;
}

class MfaEnrollConfirmDto {
  @IsString()
  enrollmentToken!: string;

  @IsString()
  @MinLength(6)
  totpCode!: string;
}

class RefreshDto {
  @IsString()
  refreshToken!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Rate-limited against credential-stuffing / brute force, per security architecture.
  @Throttle({ default: { limit: 5, ttl: 60 } })
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Throttle({ default: { limit: 10, ttl: 60 } })
  @HttpCode(200)
  @Post('mfa/verify')
  verifyMfa(@Body() dto: MfaVerifyDto) {
    return this.auth.verifyMfaAndIssueTokens(dto.mfaChallengeToken, dto.totpCode);
  }

  // Completes first-time MFA setup for a user whose account exists but has
  // never enrolled. login() returns the enrollmentToken this endpoint needs —
  // there is no way to get a session for such a user without passing through
  // here with a valid TOTP code.
  @Throttle({ default: { limit: 10, ttl: 60 } })
  @HttpCode(200)
  @Post('mfa/enroll/confirm')
  confirmEnrollment(@Body() dto: MfaEnrollConfirmDto) {
    return this.auth.confirmMfaEnrollment(dto.enrollmentToken, dto.totpCode);
  }

  @Throttle({ default: { limit: 20, ttl: 60 } })
  @HttpCode(200)
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  // Immediate, server-side revocation — see the comment on
  // AuthService.issueTokens for why this is a DB row and not just "let the
  // token expire".
  @UseGuards(AuthGuard('jwt'))
  @Audit({ action: 'auth.logout', entityType: 'Session' })
  @HttpCode(200)
  @Post('logout')
  logout(@CurrentUser() user: { id: string; sid: string }) {
    return this.auth.logout(user.sid, user.id);
  }
}
