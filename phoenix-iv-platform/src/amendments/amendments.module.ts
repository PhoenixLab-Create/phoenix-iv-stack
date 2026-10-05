import { Module } from '@nestjs/common';
import { AmendmentsService } from './amendments.service';
import { AmendmentsController } from './amendments.controller';
import { RecordModule } from '../record/record.module';

@Module({
  imports: [RecordModule],
  providers: [AmendmentsService],
  controllers: [AmendmentsController],
  exports: [AmendmentsService],
})
export class AmendmentsModule {}
