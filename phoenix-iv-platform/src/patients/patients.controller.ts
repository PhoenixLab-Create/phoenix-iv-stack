import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { IsEmail, IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../common/rbac/permissions.guard';
import { RequirePermission } from '../common/rbac/require-permission.decorator';
import { Permission } from '../common/rbac/permissions.enum';
import { Audit } from '../common/audit/audit.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { PatientsService } from './patients.service';

class RegisterPatientDto {
  @IsString() @MinLength(1) firstName!: string;
  @IsString() @MinLength(1) lastName!: string;
  @IsISO8601() dateOfBirth!: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() emergencyContactName?: string;
  @IsOptional() @IsString() emergencyContactPhone?: string;
}

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('patients')
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @RequirePermission(Permission.PATIENT_REGISTER)
  @Audit({ action: 'patient.register', entityType: 'Patient', entityIdFromResult: (r) => r?.id ?? null })
  @Post()
  register(@Body() dto: RegisterPatientDto, @CurrentUser() user: { id: string }) {
    return this.patients.register(dto, user.id);
  }

  @RequirePermission(Permission.PATIENT_SEARCH)
  @Audit({ action: 'patient.search', entityType: 'Patient' })
  @Get()
  search(@Query('q') q: string) {
    return this.patients.search(q ?? '');
  }
}
