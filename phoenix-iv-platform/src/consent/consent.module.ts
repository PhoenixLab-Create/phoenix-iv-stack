import { Module } from '@nestjs/common';
import { ConsentService } from './consent.service';
import { ConsentController } from './consent.controller';
import { VisitsModule } from '../visits/visits.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [VisitsModule, AuthModule],
  providers: [ConsentService],
  controllers: [ConsentController],
  exports: [ConsentService],
})
export class ConsentModule {}
