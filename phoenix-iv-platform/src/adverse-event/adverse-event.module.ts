import { Module } from '@nestjs/common';
import { AdverseEventService } from './adverse-event.service';
import { AdverseEventController } from './adverse-event.controller';
import { VisitsModule } from '../visits/visits.module';

@Module({
  imports: [VisitsModule],
  providers: [AdverseEventService],
  controllers: [AdverseEventController],
  exports: [AdverseEventService],
})
export class AdverseEventModule {}
