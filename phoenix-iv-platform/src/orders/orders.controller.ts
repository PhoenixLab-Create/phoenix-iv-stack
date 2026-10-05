import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../common/rbac/permissions.guard';
import { RequirePermission } from '../common/rbac/require-permission.decorator';
import { Permission } from '../common/rbac/permissions.enum';
import { Audit } from '../common/audit/audit.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { OrdersService } from './orders.service';

class RecordOrderDto {
  @IsIn(['directive', 'patient_specific']) orderType!: 'directive' | 'patient_specific';
  @IsOptional() @IsString() directiveRefId?: string;
  @IsOptional() @IsString() prescriberName?: string;
  @IsOptional() @IsString() prescriberCollegeNo?: string;
  @IsOptional() @IsString() orderDetails?: string;
}

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('visits/:visitId/order')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @RequirePermission(Permission.ORDER_RECORD)
  @Audit({ action: 'order.record', entityType: 'Order' })
  @Post()
  record(
    @Param('visitId') visitId: string,
    @Body() dto: RecordOrderDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.orders.record(visitId, dto, user.id);
  }
}
