import { Module } from '@nestjs/common';
import { SignoffService } from './signoff.service';
import { SignoffController } from './signoff.controller';
import { VisitsModule } from '../visits/visits.module';
import { RecordModule } from '../record/record.module';

@Module({
  imports: [VisitsModule, RecordModule],
  providers: [SignoffService],
  controllers: [SignoffController],
  exports: [SignoffService],
})
export class SignoffModule {}
