import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsArray, IsBoolean, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AuthGuard } from '@nestjs/passport';
import { PatientSessionGuard } from '../auth/patient-session.guard';
import { PermissionsGuard } from '../common/rbac/permissions.guard';
import { RequirePermission } from '../common/rbac/require-permission.decorator';
import { Permission } from '../common/rbac/permissions.enum';
import { Audit } from '../common/audit/audit.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { IntakeService } from './intake.service';

class MedicationDto {
  @IsString() name!: string;
  @IsOptional() @IsString() dose?: string;
  @IsOptional() @IsString() frequency?: string;
}

class AllergyDto {
  @IsBoolean() hasAllergy!: boolean;
  @IsOptional() @IsString() description?: string;
}

class SubmitIntakeDto {
  @IsObject() answers!: Record<string, unknown>;
  @IsArray() @ValidateNested({ each: true }) @Type(() => MedicationDto) medications!: MedicationDto[];
  @ValidateNested() @Type(() => AllergyDto) allergy!: AllergyDto;
}

@Controller('visits/:visitId/intake')
export class IntakeController {
  constructor(private readonly intake: IntakeService) {}

  // Form schema is structural (clinic-supplied question keys/labels/types),
  // never a clinical rule — same category as ConsentController's
  // GET template route. Available to whichever guard is presenting the
  // form: a patient filling it in themselves, or staff doing the
  // accessibility-accommodation on-behalf entry.
  @UseGuards(PatientSessionGuard)
  @Get('form')
  getFormAsPatient() {
    return this.intake.getActiveForm();
  }

  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission(Permission.INTAKE_RECORD)
  @Get('form/staff')
  getFormAsStaff() {
    return this.intake.getActiveForm();
  }

  // Patient-facing: no user account, validated via single-visit session token.
  @UseGuards(PatientSessionGuard)
  @Post()
  submitAsPatient(
    @Param('visitId') visitId: string,
    @Body() dto: SubmitIntakeDto,
    @Req() req: any,
  ) {
    return this.intake.submit(visitId, dto, 'patient', req.patientSession.sessionId);
  }

  // Staff fallback (e.g. accessibility accommodation) — explicitly a
  // different action so the record always shows who really entered it.
  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission(Permission.INTAKE_RECORD)
  @Audit({ action: 'intake.submit.staff_on_behalf', entityType: 'IntakeForm' })
  @Post('staff-entry')
  submitAsStaff(
    @Param('visitId') visitId: string,
    @Body() dto: SubmitIntakeDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.intake.submit(visitId, dto, 'staff_on_behalf', user.id);
  }

  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission(Permission.VISIT_VIEW_CLINICAL)
  @Audit({ action: 'intake.view', entityType: 'IntakeForm' })
  @Get()
  get(@Param('visitId') visitId: string) {
    return this.intake.get(visitId);
  }
}
