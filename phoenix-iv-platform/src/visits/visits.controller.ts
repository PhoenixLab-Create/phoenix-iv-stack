import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { VisitStatus } from '@prisma/client';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../common/rbac/permissions.guard';
import { RequirePermission } from '../common/rbac/require-permission.decorator';
import { Permission } from '../common/rbac/permissions.enum';
import { Audit } from '../common/audit/audit.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { VisitsService } from './visits.service';
import { PatientSessionService } from '../auth/patient-session.service';

class StartVisitDto {
  @IsUUID() patientId!: string;
}

class TransitionDto {
  @IsEnum(VisitStatus) to!: VisitStatus;
  @IsOptional() @IsString() reason?: string;
}

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('visits')
export class VisitsController {
  constructor(
    private readonly visits: VisitsService,
    private readonly patientSessions: PatientSessionService,
  ) {}

  @RequirePermission(Permission.VISIT_START)
  @Audit({ action: 'visit.start', entityType: 'Visit', entityIdFromResult: (r) => r?.id ?? null })
  @Post()
  start(@Body() dto: StartVisitDto, @CurrentUser() user: { id: string }) {
    return this.visits.start(dto.patientId, user.id);
  }

  @RequirePermission(Permission.VISIT_VIEW_STATUS, Permission.VISIT_VIEW_CLINICAL)
  @Audit({ action: 'visit.view', entityType: 'Visit' })
  @Get(':visitId')
  findOne(@Param('visitId') visitId: string) {
    return this.visits.findOne(visitId);
  }

  @RequirePermission(Permission.VISIT_START)
  @Audit({ action: 'patient_session.issue', entityType: 'Session' })
  @Post(':visitId/patient-session')
  issuePatientSession(@Param('visitId') visitId: string, @CurrentUser() user: { id: string }) {
    // Staff-initiated only — this is how a patient gets handed a tablet or a
    // one-time link, never a patient-facing "log in" flow.
    return this.patientSessions.issueForVisit(visitId, user.id);
  }

  // Generic status transition endpoint — now superseded for every step by
  // dedicated endpoints (intake, screening, assessment, order, protocol,
  // consent, prep, insertion, monitoring, adverse-event, completion), each
  // of which calls VisitsService.transition() internally alongside writing
  // its own clinical fields in the same DB transaction. This endpoint
  // remains only as a narrow escape hatch for cancellation; it can never
  // reach SIGNED (VisitsService.transition() rejects that outright — see
  // signVisit() / SignoffService for the only real path to signing).
  @RequirePermission(
    Permission.ASSESSMENT_RECORD,
    Permission.ORDER_RECORD,
    Permission.PREP_RECORD,
    Permission.INSERTION_RECORD,
    Permission.MONITORING_RECORD,
    Permission.COMPLETION_RECORD,
  )
  @Audit({ action: 'visit.status.change', entityType: 'Visit' })
  @Post(':visitId/transition')
  transition(
    @Param('visitId') visitId: string,
    @Body() dto: TransitionDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.visits.transition(visitId, dto.to, user.id, dto.reason);
  }
}
