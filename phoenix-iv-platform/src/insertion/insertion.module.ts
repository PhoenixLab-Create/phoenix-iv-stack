import { Module } from '@nestjs/common';
import { InsertionService } from './insertion.service';
import { InsertionController } from './insertion.controller';
import { VisitsModule } from '../visits/visits.module';

@Module({
  imports: [VisitsModule],
  providers: [InsertionService],
  controllers: [InsertionController],
  exports: [InsertionService],
})
export class InsertionModule {}
