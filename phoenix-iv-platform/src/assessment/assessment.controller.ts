import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsNumber, IsObject, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../common/rbac/permissions.guard';
import { RequirePermission } from '../common/rbac/require-permission.decorator';
import { Permission } from '../common/rbac/permissions.enum';
import { Audit } from '../common/audit/audit.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { AssessmentService } from './assessment.service';

class VitalsDto {
  @IsOptional() @IsNumber() bpSystolic?: number;
  @IsOptional() @IsNumber() bpDiastolic?: number;
  @IsOptional() @IsNumber() heartRate?: number;
  @IsOptional() @IsNumber() respRate?: number;
  @IsOptional() @IsNumber() temperature?: number;
  @IsOptional() @IsNumber() spo2?: number;
}

class RecordAssessmentDto {
  @IsString() @MinLength(1) reasonForVisit!: string;
  @IsOptional() @IsString() notes?: string;
  @IsIn(['Proceed', 'Do not proceed']) decision!: 'Proceed' | 'Do not proceed';
  @IsObject() @ValidateNested() @Type(() => VitalsDto) vitals!: VitalsDto;
}

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('visits/:visitId/assessment')
export class AssessmentController {
  constructor(private readonly assessment: AssessmentService) {}

  @RequirePermission(Permission.ASSESSMENT_RECORD)
  @Audit({ action: 'assessment.record', entityType: 'Assessment' })
  @Post()
  record(
    @Param('visitId') visitId: string,
    @Body() dto: RecordAssessmentDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.assessment.record(visitId, dto, user.id);
  }
}
