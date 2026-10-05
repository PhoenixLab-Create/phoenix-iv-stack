import { SetMetadata } from '@nestjs/common';

export const AUDIT_META_KEY = 'audit_meta';

export interface AuditMeta {
  action: string;
  entityType: string;
  entityIdFromResult?: (result: any) => string | null;
}

/**
 * Usage:
 *   @Audit({ action: 'visit.view', entityType: 'Visit' })
 *   @Get(':id')
 *   findOne(@Param('id') id: string) { ... }
 *
 * Every read or write of clinical data should carry this decorator. Code
 * review / CI lint rule (TODO Sprint 2 stretch) should flag any controller
 * method touching Patient/Visit/* models without it.
 */
export const Audit = (meta: AuditMeta) => SetMetadata(AUDIT_META_KEY, meta);
