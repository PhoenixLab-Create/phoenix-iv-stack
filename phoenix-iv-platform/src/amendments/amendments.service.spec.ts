import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AmendmentsService } from './amendments.service';

describe('AmendmentsService', () => {
  let service: AmendmentsService;
  let prisma: any;
  let audit: any;
  let record: any;

  const validInput = {
    targetTable: 'assessments',
    targetId: 'v1',
    field: 'notes',
    oldValue: 'old',
    newValue: 'new',
    reason: 'Typo correction confirmed with clinician',
    signatureBlobRef: 'sig-1',
  };

  beforeEach(() => {
    prisma = {
      visit: { findUnique: jest.fn() },
      recordSnapshot: { findFirst: jest.fn().mockResolvedValue({ versionNo: 1 }), create: jest.fn() },
      amendment: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'am-1', ...data })),
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null), // no prior approved amendment by default
      },
      amendmentApproval: { findMany: jest.fn(), create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'ap-1', ...data })) },
      assessment: { findUnique: jest.fn().mockResolvedValue({ visitId: 'v1', notes: 'old' }) },
    };
    audit = { write: jest.fn().mockResolvedValue(undefined) };
    record = {
      getCurrentView: jest.fn().mockResolvedValue({ record: {} }),
      canonicalize: jest.fn().mockReturnValue('{}'),
      hash: jest.fn().mockReturnValue('hash'),
    };
    service = new AmendmentsService(prisma, audit, record);
  });

  it('refuses to amend an unsigned visit', async () => {
    prisma.visit.findUnique.mockResolvedValue({ id: 'v1', signedAt: null });
    await expect(service.create('v1', validInput, 'nurse-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses a non-whitelisted target table', async () => {
    prisma.visit.findUnique.mockResolvedValue({ id: 'v1', signedAt: new Date() });
    await expect(
      service.create('v1', { ...validInput, targetTable: 'audit_log' }, 'nurse-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts a valid amendment when the claimed oldValue matches the stored value', async () => {
    prisma.visit.findUnique.mockResolvedValue({ id: 'v1', signedAt: new Date() });
    prisma.assessment.findUnique.mockResolvedValue({ visitId: 'v1', notes: 'old' });
    const result = await service.create('v1', validInput, 'nurse-1');
    expect(result.resultingSnapshotVersion).toBe(2);
    expect(prisma.amendment.create).toHaveBeenCalled();
  });

  it('rejects when the claimed oldValue does not match what is actually stored', async () => {
    prisma.visit.findUnique.mockResolvedValue({ id: 'v1', signedAt: new Date() });
    prisma.assessment.findUnique.mockResolvedValue({ visitId: 'v1', notes: 'something completely different' });
    await expect(service.create('v1', validInput, 'nurse-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.amendment.create).not.toHaveBeenCalled();
  });

  it('compares against the most recent approved prior amendment instead of the original row, when one exists', async () => {
    prisma.visit.findUnique.mockResolvedValue({ id: 'v1', signedAt: new Date() });
    // The row itself still says 'old', but a prior amendment already moved
    // this field to 'intermediate' and was approved — the new amendment's
    // claimed oldValue must match THAT, not the stale original row.
    prisma.amendment.findFirst.mockResolvedValue({ newValue: 'intermediate' });
    prisma.assessment.findUnique.mockResolvedValue({ visitId: 'v1', notes: 'old' });

    await expect(
      service.create('v1', { ...validInput, oldValue: 'old' }, 'nurse-1'),
    ).rejects.toBeInstanceOf(BadRequestException);

    await service.create('v1', { ...validInput, oldValue: 'intermediate' }, 'nurse-1');
    expect(prisma.amendment.create).toHaveBeenCalled();
  });

  it('refuses to approve an amendment twice', async () => {
    prisma.amendment.findUnique.mockResolvedValue({ id: 'am-1', visitId: 'v1', resultingSnapshotVersion: 2 });
    prisma.amendmentApproval.findMany.mockResolvedValue([{ decision: 'approved' }]);
    await expect(service.approve('am-1', { decision: 'approved' }, 'director-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('creates a new record snapshot only when the decision is approved', async () => {
    prisma.amendment.findUnique.mockResolvedValue({ id: 'am-1', visitId: 'v1', resultingSnapshotVersion: 2 });
    prisma.amendmentApproval.findMany.mockResolvedValue([]);

    await service.approve('am-1', { decision: 'rejected' }, 'director-1');
    expect(prisma.recordSnapshot.create).not.toHaveBeenCalled();

    await service.approve('am-1', { decision: 'approved' }, 'director-1');
    expect(prisma.recordSnapshot.create).toHaveBeenCalled();
  });
});
