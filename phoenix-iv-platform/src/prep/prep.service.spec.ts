import { BadRequestException } from '@nestjs/common';
import { PrepService } from './prep.service';

describe('PrepService — expired lot handling', () => {
  let service: PrepService;
  let prisma: any;
  let audit: any;
  let visits: any;
  let products: any;

  const expiredLot = {
    id: 'lot-expired',
    lotNumber: 'EXP-001',
    productId: 'prod-1',
    expiryDate: new Date('2020-01-01'),
    product: { name: 'Vitamin C' },
  };
  const validLot = {
    id: 'lot-valid',
    lotNumber: 'OK-001',
    productId: 'prod-1',
    expiryDate: new Date('2999-01-01'),
    product: { name: 'Vitamin C' },
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn(async (fn) => fn(prisma)),
      visitPreparation: {
        upsert: jest.fn(),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ visitId: 'v1', items: [] }),
      },
      visitPrepItem: { deleteMany: jest.fn(), createMany: jest.fn() },
    };
    audit = { write: jest.fn().mockResolvedValue(undefined) };
    visits = { transition: jest.fn().mockResolvedValue(undefined) };
    products = { getLot: jest.fn() };
    service = new PrepService(prisma, audit, visits, products);
  });

  const baseInput = { baseProductId: 'saline-1', baseVolumeMl: 500 };

  it('rejects an expired lot with no override reason', async () => {
    products.getLot.mockResolvedValue(expiredLot);

    await expect(
      service.record(
        'v1',
        { ...baseInput, items: [{ productId: 'prod-1', doseValue: 1, doseUnit: 'mL', lotId: 'lot-expired' }] },
        'nurse-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.visitPrepItem.createMany).not.toHaveBeenCalled();
    expect(visits.transition).not.toHaveBeenCalled();
  });

  it('accepts an expired lot when an override reason is given, and logs it distinctly', async () => {
    products.getLot.mockResolvedValue(expiredLot);

    await service.record(
      'v1',
      {
        ...baseInput,
        items: [
          {
            productId: 'prod-1',
            doseValue: 1,
            doseUnit: 'mL',
            lotId: 'lot-expired',
            expiredLotOverrideReason: 'No alternative lot in stock; clinical director notified',
          },
        ],
      },
      'nurse-1',
    );

    expect(prisma.visitPrepItem.createMany).toHaveBeenCalled();
    expect(audit.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'prep.expired_lot_used' }));
    expect(visits.transition).toHaveBeenCalledWith('v1', 'IV_INSERTION', 'nurse-1', expect.any(String));
  });

  it('accepts a valid (non-expired) lot with no override needed', async () => {
    products.getLot.mockResolvedValue(validLot);

    await service.record(
      'v1',
      { ...baseInput, items: [{ productId: 'prod-1', doseValue: 1, doseUnit: 'mL', lotId: 'lot-valid' }] },
      'nurse-1',
    );

    expect(prisma.visitPrepItem.createMany).toHaveBeenCalled();
    const expiredCalls = audit.write.mock.calls.filter((c: any) => c[0].action === 'prep.expired_lot_used');
    expect(expiredCalls.length).toBe(0);
  });

  it('rejects when a lot does not belong to the selected product', async () => {
    products.getLot.mockResolvedValue({ ...validLot, productId: 'some-other-product' });

    await expect(
      service.record(
        'v1',
        { ...baseInput, items: [{ productId: 'prod-1', doseValue: 1, doseUnit: 'mL', lotId: 'lot-valid' }] },
        'nurse-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
