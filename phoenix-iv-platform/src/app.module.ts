import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './config/prisma.module';
import { AuditModule } from './common/audit/audit.module';
import { AuditInterceptor } from './common/audit/audit.interceptor';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SystemSettingsModule } from './system-settings/system-settings.module';
import { PatientsModule } from './patients/patients.module';
import { VisitsModule } from './visits/visits.module';
import { IntakeModule } from './intake/intake.module';
import { ScreeningModule } from './screening/screening.module';
import { AssessmentModule } from './assessment/assessment.module';
import { OrdersModule } from './orders/orders.module';
import { ProtocolsModule } from './protocols/protocols.module';
import { ConsentModule } from './consent/consent.module';
import { ProductsModule } from './products/products.module';
import { PrepModule } from './prep/prep.module';
import { InsertionModule } from './insertion/insertion.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { AdverseEventModule } from './adverse-event/adverse-event.module';
import { CompletionModule } from './completion/completion.module';
import { RecordModule } from './record/record.module';
import { SignoffModule } from './signoff/signoff.module';
import { AmendmentsModule } from './amendments/amendments.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AuditLogModule } from './audit-log/audit-log.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]), // global default; auth routes tighten further
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    SystemSettingsModule,
    PatientsModule,
    VisitsModule,
    IntakeModule,
    ScreeningModule,
    AssessmentModule,
    OrdersModule,
    ProtocolsModule,
    ConsentModule,
    ProductsModule,
    PrepModule,
    InsertionModule,
    MonitoringModule,
    AdverseEventModule,
    CompletionModule,
    RecordModule,
    SignoffModule,
    AmendmentsModule,
    DashboardModule,
    AuditLogModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
