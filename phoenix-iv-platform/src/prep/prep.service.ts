import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { VisitsService } from '../visits/visits.service';
import { ProductsService } from '../products/products.service';

export interface PrepItemInput {
  productId: string;
  doseValue: number;
  doseUnit: string;
  lotId: string;
  isAdditional?: boolean;
  addedReason?: string;
  /** Required if the lot's expiry has passed — this is what makes an expired
   * lot a "hard flag + reason", not a silent block and not a silent pass. */
  expiredLotOverrideReason?: string;
}

export interface RecordPrepInput {
  baseProductId: string;
  baseVolumeMl: number;
  items: PrepItemInput[];
}

@Injectable()
export class PrepService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly visits: VisitsService,
    private readonly products: ProductsService,
  ) {}

  async record(visitId: string, input: RecordPrepInput, actorId: string) {
    if (input.items.length === 0) {
      throw new BadRequestException('At least one ingredient is required.');
    }

    // Validate every lot up front — including the expired-lot override — so
    // the whole prep either lands correctly or not at all (no half-written
    // ingredient list from a mid-loop failure).
    const expiredLotsOverridden: string[] = [];
    for (const item of input.items) {
      const lot = await this.products.getLot(item.lotId);
      if (lot.productId !== item.productId) {
        throw new BadRequestException(`Lot ${lot.lotNumber} does not belong to the selected product.`);
      }
      const isExpired = lot.expiryDate < new Date();
      if (isExpired) {
        if (!item.expiredLotOverrideReason?.trim()) {
          throw new BadRequestException(
            `Lot ${lot.lotNumber} for ${lot.product.name} expired on ${lot.expiryDate.toISOString().slice(0, 10)}. ` +
              `An expired lot cannot be used without an explicit, documented reason.`,
          );
        }
        expiredLotsOverridden.push(lot.lotNumber);
      }
    }

    const preparation = await this.prisma.$transaction(async (tx) => {
      await tx.visitPreparation.upsert({
        where: { visitId },
        create: { visitId, baseProductId: input.baseProductId, baseVolumeMl: input.baseVolumeMl, preparedBy: actorId },
        update: { baseProductId: input.baseProductId, baseVolumeMl: input.baseVolumeMl, preparedBy: actorId },
      });
      await tx.visitPrepItem.deleteMany({ where: { prepId: visitId } });
      await tx.visitPrepItem.createMany({
        data: input.items.map((i) => ({
          prepId: visitId,
          productId: i.productId,
          doseValue: i.doseValue,
          doseUnit: i.doseUnit,
          lotId: i.lotId,
          isAdditional: i.isAdditional ?? false,
          addedReason: i.addedReason,
        })),
      });
      return tx.visitPreparation.findUniqueOrThrow({ where: { visitId }, include: { items: true } });
    });

    await this.audit.write({
      actorId,
      action: 'prep.record',
      entityType: 'VisitPreparation',
      entityId: visitId,
      visitId,
      after: { itemCount: input.items.length, expiredLotsOverridden },
      reason: expiredLotsOverridden.length ? `Expired lot(s) used: ${expiredLotsOverridden.join(', ')}` : undefined,
    });

    if (expiredLotsOverridden.length) {
      // A separate, explicitly-flagged audit event — easy to find in review
      // without having to inspect every prep.record entry's payload.
      await this.audit.write({
        actorId,
        action: 'prep.expired_lot_used',
        entityType: 'VisitPreparation',
        entityId: visitId,
        visitId,
        reason: `Lots: ${expiredLotsOverridden.join(', ')}`,
      });
    }

    await this.visits.transition(visitId, 'IV_INSERTION' as any, actorId, 'preparation recorded');
    return preparation;
  }

  async get(visitId: string) {
    return this.prisma.visitPreparation.findUnique({
      where: { visitId },
      include: { items: { include: { product: true, lot: true } }, baseProduct: true },
    });
  }
}
