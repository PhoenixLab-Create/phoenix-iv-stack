import { Module } from '@nestjs/common';
import { ScreeningService } from './screening.service';
import { ScreeningController } from './screening.controller';
import { VisitsModule } from '../visits/visits.module';

@Module({
  imports: [VisitsModule],
  providers: [ScreeningService],
  controllers: [ScreeningController],
  exports: [ScreeningService],
})
export class ScreeningModule {}
