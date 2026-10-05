import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../common/rbac/permissions.guard';
import { RequirePermission } from '../common/rbac/require-permission.decorator';
import { Permission } from '../common/rbac/permissions.enum';
import { Audit } from '../common/audit/audit.decorator';
import { RecordService } from './record.service';
import { RecordPdfService } from './record-pdf.service';

@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller('visits/:visitId/record')
export class RecordController {
  constructor(
    private readonly record: RecordService,
    private readonly pdf: RecordPdfService,
  ) {}

  @RequirePermission(Permission.VISIT_VIEW_CLINICAL)
  @Audit({ action: 'record.view', entityType: 'Visit' })
  @Get()
  async getCurrent(@Param('visitId') visitId: string) {
    return this.record.getCurrentView(visitId);
  }

  @RequirePermission(Permission.VISIT_VIEW_CLINICAL)
  @Audit({ action: 'record.view.pdf', entityType: 'Visit' })
  @Get('pdf')
  async getPdf(@Param('visitId') visitId: string, @Res() res: Response) {
    const view = await this.record.getCurrentView(visitId);
    const doc = this.pdf.render(view);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="visit-${visitId}-record.pdf"`);
    doc.pipe(res);
  }
}
