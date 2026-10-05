import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../common/rbac/permissions.guard';
import { RequirePermission } from '../common/rbac/require-permission.decorator';
import { Permission } from '../common/rbac/permissions.enum';
import { Audit } from '../common/audit/audit.decorator';
import { DashboardService } from './dashboard.service';

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  // visit.view.status is enough — the dashboard never shows clinical
  // content, only status/progress, so it doesn't need
  // admin_clinical_visibility to be "full" to be useful for front desk.
  @RequirePermission(Permission.VISIT_VIEW_STATUS, Permission.VISIT_VIEW_CLINICAL)
  @Audit({ action: 'dashboard.view', entityType: 'Visit' })
  @Get()
  get() {
    return this.dashboard.getSummary();
  }
}
