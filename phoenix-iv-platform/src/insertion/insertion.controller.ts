import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsInt, IsISO8601, IsOptional, IsString, Min } from 'class-validator';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../common/rbac/permissions.guard';
import { RequirePermission } from '../common/rbac/require-permission.decorator';
import { Permission } from '../common/rbac/permissions.enum';
import { Audit } from '../common/audit/audit.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { InsertionService } from './insertion.service';

class RecordInsertionDto {
  @IsOptional() @IsISO8601() eventTime?: string;
  @IsString() site!: string;
  @IsString() side!: string;
  @IsString() gauge!: string;
  @IsInt() @Min(1) attempts!: number;
  @IsBoolean() successful!: boolean;
  @IsOptional() @IsString() siteCondition?: string;
  @IsOptional() @IsString() note?: string;
}

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('visits/:visitId/insertion')
export class InsertionController {
  constructor(private readonly insertion: InsertionService) {}

  @RequirePermission(Permission.INSERTION_RECORD)
  @Audit({ action: 'insertion.record', entityType: 'IVInsertion' })
  @Post()
  record(
    @Param('visitId') visitId: string,
    @Body() dto: RecordInsertionDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.insertion.record(visitId, dto, user.id);
  }

  @RequirePermission(Permission.VISIT_VIEW_CLINICAL)
  @Audit({ action: 'insertion.view', entityType: 'IVInsertion' })
  @Get()
  get(@Param('visitId') visitId: string) {
    return this.insertion.get(visitId);
  }
}
