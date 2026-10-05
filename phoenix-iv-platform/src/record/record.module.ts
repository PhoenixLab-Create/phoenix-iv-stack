import { Module } from '@nestjs/common';
import { RecordService } from './record.service';
import { RecordPdfService } from './record-pdf.service';
import { RecordController } from './record.controller';

@Module({
  providers: [RecordService, RecordPdfService],
  controllers: [RecordController],
  exports: [RecordService],
})
export class RecordModule {}
