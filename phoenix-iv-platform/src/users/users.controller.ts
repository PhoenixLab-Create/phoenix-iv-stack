import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ArrayMinSize, IsArray, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../common/rbac/permissions.guard';
import { RequirePermission } from '../common/rbac/require-permission.decorator';
import { Permission } from '../common/rbac/permissions.enum';
import { Audit } from '../common/audit/audit.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { UsersService } from './users.service';

class CreateUserDto {
  @IsString() firstName!: string;
  @IsString() lastName!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(12) password!: string; // stronger min length for staff accounts
  @IsOptional() @IsString() professionalDesignation?: string;
  @IsOptional() @IsString() collegeRegistrationNo?: string;
  @IsArray() @ArrayMinSize(1) roleNames!: string[];
}

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @RequirePermission(Permission.USER_MANAGE)
  @Audit({ action: 'user.create', entityType: 'User', entityIdFromResult: (r) => r?.id ?? null })
  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() user: { id: string }) {
    return this.users.create(dto, user.id);
  }
}
