import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { AuditService } from './audit.service';
import { AUDIT_META_KEY, AuditMeta } from './audit.decorator';

/**
 * Applied globally (see app.module.ts). Any handler decorated with @Audit(...)
 * gets an automatic audit_log entry after it completes successfully — including
 * reads (action: "*.view"), per the architecture requirement that every read of
 * a patient record is logged, not just writes.
 *
 * This does NOT replace manual AuditService calls inside business logic for
 * fine-grained events (e.g. "which screening flag was acknowledged") — those
 * still call AuditService directly. This interceptor's job is to make sure
 * no controller can expose patient data without at least a request-level
 * audit entry, even if the developer forgets to log.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const meta = this.reflector.get<AuditMeta | undefined>(
      AUDIT_META_KEY,
      context.getHandler(),
    );
    if (!meta) return next.handle();

    const req = context.switchToHttp().getRequest();
    const user = req.user; // populated by JwtStrategy / patient-session guard

    return next.handle().pipe(
      tap((result) => {
        void this.audit.write({
          actorId: user?.id ?? null,
          actorRole: user?.role ?? (req.patientSession ? 'PATIENT_SESSION' : null),
          action: meta.action,
          entityType: meta.entityType,
          entityId:
            typeof meta.entityIdFromResult === 'function'
              ? meta.entityIdFromResult(result)
              : req.params?.id ?? null,
          patientId: req.params?.patientId ?? req.body?.patientId ?? null,
          visitId: req.params?.visitId ?? req.body?.visitId ?? null,
          ip: req.ip,
          deviceId: req.headers['x-device-id'] ?? null,
          requestId: req.headers['x-request-id'] ?? null,
        });
      }),
    );
  }
}
