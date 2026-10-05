import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../common/rbac/permissions.guard';
import { RequirePermission } from '../common/rbac/require-permission.decorator';
import { Permission } from '../common/rbac/permissions.enum';
import { Audit } from '../common/audit/audit.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { AmendmentsService } from './amendments.service';

class CreateAmendmentDto {
  @IsString() targetTable!: string;
  @IsString() targetId!: string;
  @IsString() field!: string;
  @IsString() oldValue!: string;
  @IsString() newValue!: string;
  @IsString() @MinLength(1) reason!: string;
  @IsString() @MinLength(1) signatureBlobRef!: string;
}

class ApproveAmendmentDto {
  @IsIn(['approved', 'rejected']) decision!: 'approved' | 'rejected';
  @IsOptional() @IsString() note?: string;
}

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller()
export class AmendmentsController {
  constructor(private readonly amendments: AmendmentsService) {}

  @RequirePermission(Permission.AMENDMENT_CREATE)
  @Audit({ action: 'amendment.create', entityType: 'Amendment', entityIdFromResult: (r) => r?.id ?? null })
  @Post('visits/:visitId/amendments')
  create(
    @Param('visitId') visitId: string,
    @Body() dto: CreateAmendmentDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.amendments.create(visitId, dto, user.id);
  }

  @RequirePermission(Permission.VISIT_VIEW_CLINICAL)
  @Audit({ action: 'amendment.view', entityType: 'Amendment' })
  @Get('visits/:visitId/amendments')
  list(@Param('visitId') visitId: string) {
    return this.amendments.list(visitId);
  }

  @RequirePermission(Permission.AMENDMENT_APPROVE)
  @Audit({ action: 'amendment.approve', entityType: 'AmendmentApproval' })
  @Post('amendments/:amendmentId/approval')
  approve(
    @Param('amendmentId') amendmentId: string,
    @Body() dto: ApproveAmendmentDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.amendments.approve(amendmentId, dto, user.id);
  }
}
