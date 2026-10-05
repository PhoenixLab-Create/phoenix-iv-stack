import { ForbiddenException } from '@nestjs/common';
import { VisitStatus } from '@prisma/client';
import { VisitsService } from './visits.service';

describe('VisitsService — signing can only happen through signVisit()', () => {
  let service: VisitsService;
  let prisma: any;
  let audit: any;

  beforeEach(() => {
    prisma = {
      visit: { findUnique: jest.fn(), update: jest.fn() },
      visitStatusHistory: { create: jest.fn() },
      $transaction: jest.fn(async (fn) => fn(prisma)),
    };
    audit = { write: jest.fn().mockResolvedValue(undefined) };
    service = new VisitsService(prisma, audit);
  });

  it('rejects any attempt to reach SIGNED via the generic transition()', async () => {
    await expect(
      service.transition('v1', VisitStatus.SIGNED, 'nurse-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.visit.update).not.toHaveBeenCalled();
  });

  it('signVisit() sets signedAt and status atomically', async () => {
    prisma.visit.findUnique.mockResolvedValue({ id: 'v1', status: VisitStatus.PENDING_SIGNOFF, signedAt: null, patientId: 'p1' });
    prisma.visit.update.mockResolvedValue({ id: 'v1', status: VisitStatus.SIGNED, signedAt: new Date() });

    await service.signVisit('v1', 'nurse-1');

    expect(prisma.visit.update).toHaveBeenCalledWith({
      where: { id: 'v1' },
      data: expect.objectContaining({ status: VisitStatus.SIGNED, signedAt: expect.any(Date) }),
    });
  });

  it('signVisit() refuses an already-signed visit', async () => {
    prisma.visit.findUnique.mockResolvedValue({ id: 'v1', status: VisitStatus.SIGNED, signedAt: new Date() });
    await expect(service.signVisit('v1', 'nurse-1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('signVisit() refuses from a non-PENDING_SIGNOFF status', async () => {
    prisma.visit.findUnique.mockResolvedValue({ id: 'v1', status: VisitStatus.INTAKE, signedAt: null });
    await expect(service.signVisit('v1', 'nurse-1')).rejects.toThrow();
  });
});
