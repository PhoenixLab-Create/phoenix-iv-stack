import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { AuthService } from '../auth/auth.service';
import { MfaService } from '../auth/mfa.service';
import { AuditService } from '../common/audit/audit.service';

export interface CreateUserInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  professionalDesignation?: string;
  collegeRegistrationNo?: string;
  roleNames: string[];
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly mfa: MfaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Creates a user and begins MFA enrollment (secret generated, not yet
   * confirmed). Per architecture review, login should be blocked until
   * enrollment completes — enforced in AuthService.login, not here.
   */
  async create(input: CreateUserInput, createdBy: string) {
    const passwordHash = await this.auth.hashPassword(input.password);
    const mfaSecret = this.mfa.generateSecret(); // TODO: encrypt via KMS wrapper before storing, in production

    const user = await this.prisma.user.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        passwordHash,
        professionalDesignation: input.professionalDesignation,
        collegeRegistrationNo: input.collegeRegistrationNo,
        mfaSecretEncrypted: mfaSecret,
        roles: {
          create: await Promise.all(
            input.roleNames.map(async (name) => {
              const role = await this.prisma.role.findUniqueOrThrow({ where: { name: name as any } });
              return { roleId: role.id };
            }),
          ),
        },
      },
    });

    await this.audit.write({
      actorId: createdBy,
      action: 'user.create',
      entityType: 'User',
      entityId: user.id,
      after: { email: user.email, roles: input.roleNames },
    });

    return {
      id: user.id,
      otpAuthUrl: this.mfa.getOtpAuthUrl(user.email, mfaSecret), // shown once, for authenticator app enrollment
    };
  }
}
