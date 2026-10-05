import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../common/rbac/permissions.guard';
import { RequirePermission } from '../common/rbac/require-permission.decorator';
import { Permission } from '../common/rbac/permissions.enum';
import { Audit } from '../common/audit/audit.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { ScreeningService } from './screening.service';

class AcknowledgeDto {
  @IsString()
  @MinLength(1)
  clinicianResponse!: string;
}

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('visits/:visitId/screening')
export class ScreeningController {
  constructor(private readonly screening: ScreeningService) {}

  @RequirePermission(Permission.VISIT_VIEW_CLINICAL, Permission.SCREENING_ACKNOWLEDGE)
  @Audit({ action: 'screening.run', entityType: 'Visit' })
  @Post('run')
  run(@Param('visitId') visitId: string, @CurrentUser() user: { id: string }) {
    return this.screening.runScreening(visitId, user.id);
  }

  @RequirePermission(Permission.VISIT_VIEW_CLINICAL, Permission.SCREENING_ACKNOWLEDGE)
  @Audit({ action: 'screening.view', entityType: 'Visit' })
  @Get('flags')
  list(@Param('visitId') visitId: string) {
    return this.screening.listFlags(visitId);
  }

  @RequirePermission(Permission.SCREENING_ACKNOWLEDGE)
  @Audit({ action: 'screening_flag.acknowledge', entityType: 'ScreeningFlag' })
  @Post('flags/:flagId/acknowledge')
  acknowledge(
    @Param('flagId') flagId: string,
    @Body() dto: AcknowledgeDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.screening.acknowledge(flagId, dto.clinicianResponse, user.id);
  }

  @RequirePermission(Permission.SCREENING_ACKNOWLEDGE)
  @Audit({ action: 'screening.complete', entityType: 'Visit' })
  @Post('complete')
  complete(@Param('visitId') visitId: string, @CurrentUser() user: { id: string }) {
    return this.screening.completeScreening(visitId, user.id);
  }
}
