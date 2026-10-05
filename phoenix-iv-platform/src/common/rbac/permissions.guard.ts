import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_META_KEY } from './require-permission.decorator';
import { Permission } from './permissions.enum';
import { PrismaService } from '../../config/prisma.service';
import { AuditService } from '../audit/audit.service';

/**
 * Enforces, in order:
 *  1. The user holds at least one of the required permissions for the route.
 *  2. Special case: VISIT_VIEW_CLINICAL for an ADMIN role additionally checks
 *     the `admin_clinical_visibility` system setting. If it is "status_only",
 *     an admin is downgraded to VISIT_VIEW_STATUS even though their role
 *     would otherwise carry the permission — this is what makes the flag a
 *     real, enforced switch rather than documentation.
 *  3. Care-relationship check for clinicians: a NURSE_CLINICIAN / PRESCRIBER
 *     can only act on a visit currently assigned to them, unless they invoke
 *     break-glass (logged, reason required).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.get<Permission[] | undefined>(
      PERMISSION_META_KEY,
      context.getHandler(),
    );
    if (!required || required.length === 0) return true; // route opted out of RBAC (public/health-check only)

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) throw new ForbiddenException('Not authenticated');

    const userPermissions: Set<Permission> = new Set(user.permissions ?? []);

    // --- admin_clinical_visibility flag enforcement ---
    if (
      required.includes(Permission.VISIT_VIEW_CLINICAL) &&
      user.role === 'ADMIN'
    ) {
      const setting = await this.prisma.systemSetting.findUnique({
        where: { key: 'admin_clinical_visibility' },
      });
      const mode = (setting?.value as any)?.mode ?? 'full'; // MVP default per clinic decision
      if (mode !== 'full') {
        throw new ForbiddenException(
          'Clinical record view is restricted for this role (admin_clinical_visibility = status_only)',
        );
      }
    }

    const hasPermission = required.some((p) => userPermissions.has(p));
    const usingBreakGlass =
      !hasPermission && req.headers['x-break-glass-reason'] && userPermissions.has(Permission.BREAK_GLASS);

    if (!hasPermission && !usingBreakGlass) {
      throw new ForbiddenException('Insufficient permissions');
    }

    // --- care-relationship check for clinical actions on a specific visit ---
    const visitId = req.params?.visitId;
    if (
      visitId &&
      (user.role === 'NURSE_CLINICIAN' || user.role === 'PRESCRIBER') &&
      !usingBreakGlass
    ) {
      const visit = await this.prisma.visit.findUnique({ where: { id: visitId } });
      if (visit && visit.assignedClinicianId && visit.assignedClinicianId !== user.id) {
        throw new ForbiddenException(
          'This visit is assigned to a different clinician. Use break-glass if urgent access is required.',
        );
      }
    }

    if (usingBreakGlass) {
      await this.audit.write({
        actorId: user.id,
        actorRole: user.role,
        action: 'break_glass.use',
        entityType: 'Visit',
        entityId: visitId ?? null,
        visitId: visitId ?? null,
        reason: req.headers['x-break-glass-reason'],
        ip: req.ip,
      });
      // Production: also fire a real-time alert to the Privacy Officer, not just an audit row.
    }

    return true;
  }
}
