import { BadRequestException } from '@nestjs/common';
import { SignoffService } from './signoff.service';

describe('SignoffService — completeness gate', () => {
  let service: SignoffService;
  let prisma: any;
  let audit: any;
  let visits: any;
  let record: any;

  const completeVisit = {
    id: 'v1',
    screeningFlags: [{ acknowledgedAt: new Date() }],
    assessment: { decision: 'Proceed' },
    order: { visitId: 'v1' },
    protocolSelection: { visitId: 'v1' },
    consent: { signedAt: new Date() },
    preparation: { items: [{ id: 'i1' }] },
    ivInsertion: { successful: true },
    monitoringEntries: [{ id: 'm1' }],
    adverseEvents: [],
    completion: { aftercareProvided: true, adverseEventOccurred: false },
  };

  beforeEach(() => {
    prisma = { visit: { findUnique: jest.fn() }, signoff: { create: jest.fn() }, recordSnapshot: { create: jest.fn() } };
    audit = { write: jest.fn().mockResolvedValue(undefined) };
    visits = { signVisit: jest.fn().mockResolvedValue(undefined) };
    record = {
      getCanonical: jest.fn().mockResolvedValue({ id: 'v1' }),
      canonicalize: jest.fn().mockReturnValue('{"id":"v1"}'),
      hash: jest.fn().mockReturnValue('deadbeef'),
    };
    service = new SignoffService(prisma, audit, visits, record);
  });

  it('reports no blocks for a fully complete visit and allows signing', async () => {
    prisma.visit.findUnique.mockResolvedValue(completeVisit);
    const summary = await service.getSummary('v1');
    expect(summary.canSign).toBe(true);
    expect(summary.blocks).toHaveLength(0);

    await service.sign('v1', { designation: 'RN', signatureBlobRef: 'sig-1' }, 'nurse-1');
    expect(visits.signVisit).toHaveBeenCalledWith('v1', 'nurse-1');
    expect(prisma.signoff.create).toHaveBeenCalled();
    expect(prisma.recordSnapshot.create).toHaveBeenCalled();
  });

  it('blocks on an unacknowledged screening flag', async () => {
    prisma.visit.findUnique.mockResolvedValue({ ...completeVisit, screeningFlags: [{ acknowledgedAt: null }] });
    const summary = await service.getSummary('v1');
    expect(summary.canSign).toBe(false);
    expect(summary.blocks[0]).toMatch(/unacknowledged screening flag/);
  });

  it('blocks on missing consent signature', async () => {
    prisma.visit.findUnique.mockResolvedValue({ ...completeVisit, consent: null });
    const summary = await service.getSummary('v1');
    expect(summary.blocks).toContain('Consent not signed');
  });

  it('blocks on missing lot items in preparation', async () => {
    prisma.visit.findUnique.mockResolvedValue({ ...completeVisit, preparation: { items: [] } });
    const summary = await service.getSummary('v1');
    expect(summary.blocks).toContain('IV preparation has no ingredients recorded');
  });

  it('refuses sign() outright when blocks exist, and never calls signVisit', async () => {
    prisma.visit.findUnique.mockResolvedValue({ ...completeVisit, completion: null });
    await expect(service.sign('v1', { designation: 'RN', signatureBlobRef: 'sig-1' }, 'nurse-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(visits.signVisit).not.toHaveBeenCalled();
  });

  it('does not require order/protocol/consent/etc. when the clinician decided not to proceed', async () => {
    prisma.visit.findUnique.mockResolvedValue({
      id: 'v1',
      screeningFlags: [],
      assessment: { decision: 'Do not proceed' },
      order: null,
      protocolSelection: null,
      consent: null,
      preparation: null,
      ivInsertion: null,
      monitoringEntries: [],
      adverseEvents: [],
      completion: null,
    });
    const summary = await service.getSummary('v1');
    expect(summary.canSign).toBe(true);
  });
});
