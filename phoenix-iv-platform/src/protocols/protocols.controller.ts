import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../common/rbac/permissions.guard';
import { RequirePermission } from '../common/rbac/require-permission.decorator';
import { Permission } from '../common/rbac/permissions.enum';
import { Audit } from '../common/audit/audit.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { ProtocolsService } from './protocols.service';

class SelectProtocolDto {
  @IsUUID() protocolId!: string;
  @IsOptional() @IsString() customDetails?: string;
}

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller()
export class ProtocolsController {
  constructor(private readonly protocols: ProtocolsService) {}

  @RequirePermission(Permission.PROTOCOL_SELECT)
  @Audit({ action: 'protocol.list', entityType: 'Protocol' })
  @Get('protocols')
  list() {
    return this.protocols.listActive();
  }

  @RequirePermission(Permission.PROTOCOL_SELECT)
  @Audit({ action: 'protocol.select', entityType: 'VisitProtocolSelection' })
  @Post('visits/:visitId/protocol')
  select(
    @Param('visitId') visitId: string,
    @Body() dto: SelectProtocolDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.protocols.select(visitId, dto.protocolId, dto.customDetails, user.id);
  }
}
