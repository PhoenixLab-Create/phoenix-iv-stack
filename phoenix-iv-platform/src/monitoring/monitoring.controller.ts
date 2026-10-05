import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsISO8601, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../common/rbac/permissions.guard';
import { RequirePermission } from '../common/rbac/require-permission.decorator';
import { Permission } from '../common/rbac/permissions.enum';
import { Audit } from '../common/audit/audit.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { MonitoringService } from './monitoring.service';

class VitalsDto {
  @IsOptional() @IsNumber() bpSystolic?: number;
  @IsOptional() @IsNumber() bpDiastolic?: number;
  @IsOptional() @IsNumber() heartRate?: number;
  @IsOptional() @IsNumber() respRate?: number;
  @IsOptional() @IsNumber() temperature?: number;
  @IsOptional() @IsNumber() spo2?: number;
}

class AddEntryDto {
  @IsOptional() @IsISO8601() eventTime?: string;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => VitalsDto) vitals?: VitalsDto;
  @IsOptional() @IsString() symptomsObservation?: string;
  @IsBoolean() tolerating!: boolean;
}

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('visits/:visitId/monitoring')
export class MonitoringController {
  constructor(private readonly monitoring: MonitoringService) {}

  @RequirePermission(Permission.MONITORING_RECORD)
  @Audit({ action: 'monitoring.entry.record', entityType: 'InfusionMonitoringEntry' })
  @Post('entries')
  addEntry(
    @Param('visitId') visitId: string,
    @Body() dto: AddEntryDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.monitoring.addEntry(visitId, dto, user.id);
  }

  @RequirePermission(Permission.VISIT_VIEW_CLINICAL)
  @Audit({ action: 'monitoring.view', entityType: 'InfusionMonitoringEntry' })
  @Get('entries')
  list(@Param('visitId') visitId: string) {
    return this.monitoring.list(visitId);
  }

  @RequirePermission(Permission.MONITORING_RECORD)
  @Audit({ action: 'monitoring.complete', entityType: 'Visit' })
  @Post('complete')
  complete(@Param('visitId') visitId: string, @CurrentUser() user: { id: string }) {
    return this.monitoring.completeMonitoring(visitId, user.id);
  }
}
