import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../common/rbac/permissions.guard';
import { RequirePermission } from '../common/rbac/require-permission.decorator';
import { Permission } from '../common/rbac/permissions.enum';
import { Audit } from '../common/audit/audit.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { AdverseEventService } from './adverse-event.service';

class VitalsDto {
  @IsOptional() @IsNumber() bpSystolic?: number;
  @IsOptional() @IsNumber() bpDiastolic?: number;
  @IsOptional() @IsNumber() heartRate?: number;
  @IsOptional() @IsNumber() respRate?: number;
  @IsOptional() @IsNumber() temperature?: number;
  @IsOptional() @IsNumber() spo2?: number;
}

class RecordAdverseEventDto {
  @IsISO8601() onsetTime!: string;
  @IsString() @MinLength(1) signsSymptoms!: string;
  @IsIn(['stopped', 'modified', 'continued']) infusionAction!: 'stopped' | 'modified' | 'continued';
  @IsOptional() @IsObject() @ValidateNested() @Type(() => VitalsDto) vitals?: VitalsDto;
  @IsOptional() @IsString() interventions?: string;
  @IsOptional() @IsString() medicationGiven?: string;
  @IsOptional() @IsString() prescriberContacted?: string;
  @IsOptional() @IsISO8601() prescriberContactedAt?: string;
  @IsBoolean() emsContacted!: boolean;
  @IsOptional() @IsISO8601() emsContactedAt?: string;
  @IsOptional() @IsString() patientResponse?: string;
  @IsString() @MinLength(1) outcome!: string;
  @IsBoolean() hospitalTransfer!: boolean;
  @IsIn(['resume_monitoring', 'move_to_completion']) resolution!: 'resume_monitoring' | 'move_to_completion';
}

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('visits/:visitId/adverse-events')
export class AdverseEventController {
  constructor(private readonly adverseEvents: AdverseEventService) {}

  @RequirePermission(Permission.ADVERSE_EVENT_RECORD)
  @Audit({ action: 'adverse_event.record', entityType: 'AdverseEvent' })
  @Post()
  record(
    @Param('visitId') visitId: string,
    @Body() dto: RecordAdverseEventDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.adverseEvents.record(visitId, dto, user.id);
  }

  @RequirePermission(Permission.VISIT_VIEW_CLINICAL)
  @Audit({ action: 'adverse_event.view', entityType: 'AdverseEvent' })
  @Get()
  list(@Param('visitId') visitId: string) {
    return this.adverseEvents.list(visitId);
  }
}
