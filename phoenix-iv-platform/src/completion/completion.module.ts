import { Module } from '@nestjs/common';
import { CompletionService } from './completion.service';
import { CompletionController } from './completion.controller';
import { VisitsModule } from '../visits/visits.module';

@Module({
  imports: [VisitsModule],
  providers: [CompletionService],
  controllers: [CompletionController],
  exports: [CompletionService],
})
export class CompletionModule {}
