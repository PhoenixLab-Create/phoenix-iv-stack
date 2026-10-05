import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../common/rbac/permissions.guard';
import { RequirePermission } from '../common/rbac/require-permission.decorator';
import { Permission } from '../common/rbac/permissions.enum';
import { Audit } from '../common/audit/audit.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { CompletionService } from './completion.service';

class RecordCompletionDto {
  @IsOptional() @IsNumber() totalInfusedMl?: number;
  @IsOptional() @IsString() patientCondition?: string;
  @IsOptional() @IsBoolean() catheterRemoved?: boolean;
  @IsOptional() @IsBoolean() catheterIntact?: boolean;
  @IsOptional() @IsString() siteCondition?: string;
  @IsOptional() @IsBoolean() dressingApplied?: boolean;
  @IsBoolean() adverseEventOccurred!: boolean;
  @IsBoolean() aftercareProvided!: boolean;
}

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('visits/:visitId/completion')
export class CompletionController {
  constructor(private readonly completion: CompletionService) {}

  @RequirePermission(Permission.COMPLETION_RECORD)
  @Audit({ action: 'completion.record', entityType: 'TreatmentCompletion' })
  @Post()
  record(
    @Param('visitId') visitId: string,
    @Body() dto: RecordCompletionDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.completion.record(visitId, dto, user.id);
  }

  @RequirePermission(Permission.VISIT_VIEW_CLINICAL)
  @Audit({ action: 'completion.view', entityType: 'TreatmentCompletion' })
  @Get()
  get(@Param('visitId') visitId: string) {
    return this.completion.get(visitId);
  }
}
