import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../common/rbac/permissions.guard';
import { RequirePermission } from '../common/rbac/require-permission.decorator';
import { Permission } from '../common/rbac/permissions.enum';
import { Audit } from '../common/audit/audit.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { SignoffService } from './signoff.service';

class SignDto {
  @IsString() @MinLength(1) designation!: string;
  @IsString() @MinLength(1) signatureBlobRef!: string;
}

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('visits/:visitId/signoff')
export class SignoffController {
  constructor(private readonly signoff: SignoffService) {}

  @RequirePermission(Permission.VISIT_SIGN)
  @Audit({ action: 'signoff.summary.view', entityType: 'Visit' })
  @Get('summary')
  summary(@Param('visitId') visitId: string) {
    return this.signoff.getSummary(visitId);
  }

  @RequirePermission(Permission.VISIT_SIGN)
  @Audit({ action: 'visit.signoff', entityType: 'Signoff' })
  @Post()
  sign(
    @Param('visitId') visitId: string,
    @Body() dto: SignDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.signoff.sign(visitId, dto, user.id);
  }
}
