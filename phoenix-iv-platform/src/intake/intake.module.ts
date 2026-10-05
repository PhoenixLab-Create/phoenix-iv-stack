import { Module } from '@nestjs/common';
import { IntakeService } from './intake.service';
import { IntakeController } from './intake.controller';
import { AuthModule } from '../auth/auth.module';
import { VisitsModule } from '../visits/visits.module';

@Module({
  imports: [AuthModule, VisitsModule],
  providers: [IntakeService],
  controllers: [IntakeController],
  exports: [IntakeService],
})
export class IntakeModule {}
