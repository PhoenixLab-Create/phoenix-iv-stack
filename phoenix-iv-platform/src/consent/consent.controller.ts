import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsBoolean, IsString, MinLength } from 'class-validator';
import { AuthGuard } from '@nestjs/passport';
import { PatientSessionGuard } from '../auth/patient-session.guard';
import { PermissionsGuard } from '../common/rbac/permissions.guard';
import { RequirePermission } from '../common/rbac/require-permission.decorator';
import { Permission } from '../common/rbac/permissions.enum';
import { Audit } from '../common/audit/audit.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { ConsentService } from './consent.service';

class SignConsentDto {
  @IsString() @MinLength(1) patientName!: string;
  @IsString() @MinLength(1) signatureBlobRef!: string;
  @IsBoolean() questionsAnsweredConfirmed!: boolean;
}

@Controller('visits/:visitId/consent')
export class ConsentController {
  constructor(private readonly consent: ConsentService) {}

  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission(Permission.VISIT_VIEW_CLINICAL, Permission.CONSENT_WITNESS)
  @Audit({ action: 'consent.view', entityType: 'Consent' })
  @Get('template')
  getTemplate() {
    return this.consent.getActiveTemplate();
  }

  // The approved consent body text is what the patient must actually read
  // before signing — without this there was no way for a patient session to
  // see it at all (the route above requires staff auth). Same category as
  // IntakeController's patient-facing form-schema route: approved,
  // clinic-supplied text, never generated or altered here.
  @UseGuards(PatientSessionGuard)
  @Get('template/patient')
  getTemplateAsPatient() {
    return this.consent.getActiveTemplate();
  }

  @UseGuards(PatientSessionGuard)
  @Post()
  signAsPatient(@Param('visitId') visitId: string, @Body() dto: SignConsentDto, @Req() req: any) {
    return this.consent.sign(visitId, dto, req.patientSession.sessionId);
  }

  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission(Permission.CONSENT_WITNESS)
  @Audit({ action: 'consent.witness', entityType: 'Consent' })
  @Post('witness')
  witness(@Param('visitId') visitId: string, @CurrentUser() user: { id: string }) {
    return this.consent.witness(visitId, user.id);
  }

  @UseGuards(AuthGuard('jwt'), PermissionsGuard)
  @RequirePermission(Permission.VISIT_VIEW_CLINICAL)
  @Audit({ action: 'consent.view', entityType: 'Consent' })
  @Get()
  get(@Param('visitId') visitId: string) {
    return this.consent.get(visitId);
  }
}
