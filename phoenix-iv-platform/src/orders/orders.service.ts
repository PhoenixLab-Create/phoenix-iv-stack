import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { VisitsService } from '../visits/visits.service';

export interface RecordOrderInput {
  orderType: 'directive' | 'patient_specific';
  directiveRefId?: string;
  prescriberName?: string;
  prescriberCollegeNo?: string;
  orderDetails?: string;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly visits: VisitsService,
  ) {}

  async record(visitId: string, input: RecordOrderInput, actorId: string) {
    if (input.orderType === 'directive' && !input.directiveRefId) {
      throw new BadRequestException('A directive reference is required for a standing-directive order.');
    }
    if (input.orderType === 'patient_specific' && !input.prescriberName) {
      throw new BadRequestException('A prescriber name is required for a patient-specific order.');
    }

    const order = await this.prisma.order.upsert({
      where: { visitId },
      create: { visitId, ...input },
      update: { ...input },
    });

    await this.audit.write({
      actorId,
      action: 'order.record',
      entityType: 'Order',
      entityId: visitId,
      visitId,
      after: { orderType: input.orderType },
    });

    await this.visits.transition(visitId, 'PROTOCOL_SELECTED' as any, actorId, 'order authorized');
    return order;
  }
}
