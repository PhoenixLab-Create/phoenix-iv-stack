import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { AuditService } from '../common/audit/audit.service';

const MINIMUM_AGE_YEARS = 16; // per clinic decision

export interface RegisterPatientInput {
  firstName: string;
  lastName: string;
  dateOfBirth: string; // ISO date
  address?: string;
  phone?: string;
  email?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private calculateAge(dob: Date): number {
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const monthDiff = now.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age--;
    return age;
  }

  async register(input: RegisterPatientInput, registeredBy: string) {
    const dob = new Date(input.dateOfBirth);
    if (Number.isNaN(dob.getTime())) {
      throw new BadRequestException('Invalid date of birth');
    }
    const age = this.calculateAge(dob);
    if (age < MINIMUM_AGE_YEARS) {
      // This is a documentation-system policy gate (clinic-set minimum age),
      // not a clinical eligibility determination — it does not decide whether
      // treatment is appropriate, only whether intake can proceed at all.
      throw new BadRequestException(
        `Patients must be at least ${MINIMUM_AGE_YEARS} years old to register.`,
      );
    }

    // Basic duplicate check — production should also fuzzy-match on name+DOB
    // and surface possible matches to the admin rather than silently merging
    // or silently creating a duplicate.
    const possibleDuplicate = await this.prisma.patient.findFirst({
      where: {
        firstName: { equals: input.firstName, mode: 'insensitive' },
        lastName: { equals: input.lastName, mode: 'insensitive' },
        dateOfBirth: dob,
      },
    });
    if (possibleDuplicate) {
      throw new BadRequestException(
        'A patient with this name and date of birth already exists. Use patient search instead of creating a duplicate.',
      );
    }

    const patient = await this.prisma.patient.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        dateOfBirth: dob,
        address: input.address,
        phone: input.phone,
        email: input.email,
        createdBy: registeredBy,
        contacts: input.emergencyContactName
          ? {
              create: [
                {
                  name: input.emergencyContactName,
                  phone: input.emergencyContactPhone ?? '',
                  type: 'EMERGENCY',
                },
              ],
            }
          : undefined,
      },
    });

    await this.audit.write({
      actorId: registeredBy,
      action: 'patient.register',
      entityType: 'Patient',
      entityId: patient.id,
      patientId: patient.id,
      after: { firstName: patient.firstName, lastName: patient.lastName },
    });

    return patient;
  }

  async search(query: string) {
    return this.prisma.patient.findMany({
      where: {
        deletedAt: null,
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query } },
        ],
      },
      take: 25,
    });
  }
}
