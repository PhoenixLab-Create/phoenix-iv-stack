import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../common/rbac/permissions.guard';
import { RequirePermission } from '../common/rbac/require-permission.decorator';
import { Permission } from '../common/rbac/permissions.enum';
import { Audit } from '../common/audit/audit.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { PrepService } from './prep.service';

class PrepItemDto {
  @IsString() productId!: string;
  @IsNumber() doseValue!: number;
  @IsString() doseUnit!: string;
  @IsString() lotId!: string;
  @IsOptional() @IsBoolean() isAdditional?: boolean;
  @IsOptional() @IsString() addedReason?: string;
  @IsOptional() @IsString() expiredLotOverrideReason?: string;
}

class RecordPrepDto {
  @IsString() baseProductId!: string;
  @IsNumber() baseVolumeMl!: number;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => PrepItemDto) items!: PrepItemDto[];
}

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('visits/:visitId/prep')
export class PrepController {
  constructor(private readonly prep: PrepService) {}

  @RequirePermission(Permission.PREP_RECORD)
  @Audit({ action: 'prep.record', entityType: 'VisitPreparation' })
  @Post()
  record(
    @Param('visitId') visitId: string,
    @Body() dto: RecordPrepDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.prep.record(visitId, dto, user.id);
  }

  @RequirePermission(Permission.VISIT_VIEW_CLINICAL)
  @Audit({ action: 'prep.view', entityType: 'VisitPreparation' })
  @Get()
  get(@Param('visitId') visitId: string) {
    return this.prep.get(visitId);
  }
}
