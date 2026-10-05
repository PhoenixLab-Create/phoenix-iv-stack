import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../common/rbac/permissions.guard';
import { RequirePermission } from '../common/rbac/require-permission.decorator';
import { Permission } from '../common/rbac/permissions.enum';
import { Audit } from '../common/audit/audit.decorator';
import { AuditService } from '../common/audit/audit.service';
import { PrismaService } from '../config/prisma.service';

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('audit-log')
export class AuditLogController {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  @RequirePermission(Permission.AUDIT_VIEW)
  @Audit({ action: 'audit_log.view', entityType: 'AuditEntry' })
  @Get('patient/:patientId')
  forPatient(@Param('patientId') patientId: string) {
    // "A patient-level access report producible on request" (architecture
    // review §6.3) — this IS that report: every read and write touching
    // this patient, oldest first.
    return this.prisma.auditEntry.findMany({
      where: { patientId },
      orderBy: { occurredAt: 'asc' },
    });
  }

  @RequirePermission(Permission.AUDIT_VIEW)
  @Audit({ action: 'audit_log.verify', entityType: 'AuditEntry' })
  @Get('verify')
  verify(@Query('fromId') fromId?: string) {
    return this.audit.verifyChainIntegrity(fromId);
  }
}
