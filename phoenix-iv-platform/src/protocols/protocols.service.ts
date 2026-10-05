import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { VisitsService } from '../visits/visits.service';

@Injectable()
export class ProtocolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly visits: VisitsService,
  ) {}

  /** Only active, Medical-Director-approved protocols are ever offered — nothing here is generated. */
  async listActive() {
    return this.prisma.protocol.findMany({
      where: { active: true, approvedAt: { not: null } },
      orderBy: { name: 'asc' },
    });
  }

  async select(visitId: string, protocolId: string, customDetails: string | undefined, actorId: string) {
    const protocol = await this.prisma.protocol.findUnique({ where: { id: protocolId } });
    if (!protocol || !protocol.active || !protocol.approvedAt) {
      throw new BadRequestException('Selected protocol is not an active, approved clinic protocol.');
    }
    if (protocol.isCustom && !customDetails?.trim()) {
      throw new BadRequestException(
        'Custom infusions require the exact ingredients/doses from the prescriber order — none were provided.',
      );
    }

    const selection = await this.prisma.visitProtocolSelection.upsert({
      where: { visitId },
      create: { visitId, protocolId, customDetails, selectedBy: actorId },
      update: { protocolId, customDetails, selectedBy: actorId, selectedAt: new Date() },
    });

    await this.audit.write({
      actorId,
      action: 'protocol.select',
      entityType: 'VisitProtocolSelection',
      entityId: visitId,
      visitId,
      after: { protocolId, isCustom: protocol.isCustom },
    });

    await this.visits.transition(visitId, 'CONSENT' as any, actorId, 'protocol selected');
    return selection;
  }
}
