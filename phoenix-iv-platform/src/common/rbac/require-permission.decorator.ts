import { SetMetadata } from '@nestjs/common';
import { Permission } from './permissions.enum';

export const PERMISSION_META_KEY = 'required_permission';

/** Usage: @RequirePermission(Permission.VISIT_SIGN) */
export const RequirePermission = (...permissions: Permission[]) =>
  SetMetadata(PERMISSION_META_KEY, permissions);
