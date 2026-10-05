import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../common/rbac/permissions.guard';
import { RequirePermission } from '../common/rbac/require-permission.decorator';
import { Permission } from '../common/rbac/permissions.enum';
import { Audit } from '../common/audit/audit.decorator';
import { ProductsService } from './products.service';

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @RequirePermission(Permission.PREP_RECORD)
  @Audit({ action: 'product.list', entityType: 'Product' })
  @Get()
  list() {
    return this.products.listActive();
  }
}
