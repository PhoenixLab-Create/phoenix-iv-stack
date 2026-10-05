import { Module } from '@nestjs/common';
import { ProtocolsService } from './protocols.service';
import { ProtocolsController } from './protocols.controller';
import { VisitsModule } from '../visits/visits.module';

@Module({
  imports: [VisitsModule],
  providers: [ProtocolsService],
  controllers: [ProtocolsController],
  exports: [ProtocolsService],
})
export class ProtocolsModule {}
