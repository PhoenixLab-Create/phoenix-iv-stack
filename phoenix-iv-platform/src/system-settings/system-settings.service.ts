import { Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { AuditService } from '../common/audit/audit.service';

export const ADMIN_CLINICAL_VISIBILITY_KEY = 'admin_clinical_visibility';
type Visibility = 'full' | 'status_only';

@Injectable()
export class SystemSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getAdminClinicalVisibility(): Promise<Visibility> {
    const row = await this.prisma.systemSetting.findUnique({
      where: { key: ADMIN_CLINICAL_VISIBILITY_KEY },
    });
    return ((row?.value as any)?.mode as Visibility) ?? 'full'; // MVP default, per clinic decision
  }

  /**
   * Restricted to SYSTEM_ADMIN / MEDICAL_DIRECTOR at the route level
   * (RequirePermission(Permission.SETTINGS_MANAGE)) — this service does not
   * re-check the caller's role, so never expose it from an unprotected route.
   */
  async setAdminClinicalVisibility(mode: Visibility, actorId: string): Promise<void> {
    const before = await this.prisma.systemSetting.findUnique({
      where: { key: ADMIN_CLINICAL_VISIBILITY_KEY },
    });
    await this.prisma.systemSetting.upsert({
      where: { key: ADMIN_CLINICAL_VISIBILITY_KEY },
      create: { key: ADMIN_CLINICAL_VISIBILITY_KEY, value: { mode }, updatedBy: actorId },
      update: { value: { mode }, updatedBy: actorId },
    });
    // Changing who can see clinical content is exactly the kind of event the
    // architecture review calls out for explicit audit — not just "a row changed".
    await this.audit.write({
      actorId,
      action: 'settings.admin_clinical_visibility.change',
      entityType: 'SystemSetting',
      entityId: ADMIN_CLINICAL_VISIBILITY_KEY,
      before: before?.value ?? null,
      after: { mode },
    });
  }
}
