import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../config/prisma.service';

/**
 * Pure catalog lookup — never decides what to use or how much. Doses are
 * entered per-prep (PrepService) from clinic configuration or a typed
 * prescriber order, never read from or computed by this service.
 */
@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async listActive() {
    return this.prisma.product.findMany({
      where: { active: true },
      include: { lots: { orderBy: { expiryDate: 'asc' } } },
      orderBy: { name: 'asc' },
    });
  }

  /** Used by PrepService to validate a lot belongs to the chosen product and check expiry — never to silently pick one for the nurse. */
  async getLot(lotId: string) {
    const lot = await this.prisma.productLot.findUnique({ where: { id: lotId }, include: { product: true } });
    if (!lot) throw new BadRequestException('Unknown product lot');
    return lot;
  }
}
