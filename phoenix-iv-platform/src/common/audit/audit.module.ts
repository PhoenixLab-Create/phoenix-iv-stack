import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

// Global so AuditService can be injected anywhere (controllers, other
// services, the AuditInterceptor) without re-importing this module everywhere.
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
