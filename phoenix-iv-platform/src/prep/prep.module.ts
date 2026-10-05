import { Module } from '@nestjs/common';
import { PrepService } from './prep.service';
import { PrepController } from './prep.controller';
import { VisitsModule } from '../visits/visits.module';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [VisitsModule, ProductsModule],
  providers: [PrepService],
  controllers: [PrepController],
  exports: [PrepService],
})
export class PrepModule {}
