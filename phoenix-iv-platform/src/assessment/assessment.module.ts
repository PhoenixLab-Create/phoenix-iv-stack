import { Module } from '@nestjs/common';
import { AssessmentService } from './assessment.service';
import { AssessmentController } from './assessment.controller';
import { VisitsModule } from '../visits/visits.module';
import { ScreeningModule } from '../screening/screening.module';

@Module({
  imports: [VisitsModule, ScreeningModule],
  providers: [AssessmentService],
  controllers: [AssessmentController],
  exports: [AssessmentService],
})
export class AssessmentModule {}
