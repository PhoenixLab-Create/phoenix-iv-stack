import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../common/rbac/permissions.guard';
import { RequirePermission } from '../common/rbac/require-permission.decorator';
import { Permission } from '../common/rbac/permissions.enum';
import { Audit } from '../common/audit/audit.decorator';
import { SystemSettingsService } from './system-settings.service';
import { CurrentUser } from '../common/current-user.decorator';

class SetVisibilityDto {
  @IsIn(['full', 'status_only'])
  mode!: 'full' | 'status_only';
}

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('system-settings')
export class SystemSettingsController {
  constructor(private readonly settings: SystemSettingsService) {}

  @RequirePermission(Permission.SETTINGS_MANAGE)
  @Audit({ action: 'settings.view', entityType: 'SystemSetting' })
  @Get('admin-clinical-visibility')
  get() {
    return this.settings.getAdminClinicalVisibility().then((mode) => ({ mode }));
  }

  @RequirePermission(Permission.SETTINGS_MANAGE)
  @Put('admin-clinical-visibility')
  async set(@Body() dto: SetVisibilityDto, @CurrentUser() user: { id: string }) {
    await this.settings.setAdminClinicalVisibility(dto.mode, user.id);
    return { mode: dto.mode };
  }
}
