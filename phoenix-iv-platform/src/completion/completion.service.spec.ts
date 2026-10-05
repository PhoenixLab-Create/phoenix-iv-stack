import { BadRequestException } from '@nestjs/common';
import { CompletionService } from './completion.service';

describe('CompletionService — adverse event consistency', () => {
  let service: CompletionService;
  let prisma: any;
  let audit: any;
  let visits: any;

  beforeEach(() => {
    prisma = {
      adverseEvent: { findMany: jest.fn() },
      treatmentCompletion: { upsert: jest.fn().mockResolvedValue({ visitId: 'v1' }) },
    };
    audit = { write: jest.fn().mockResolvedValue(undefined) };
    visits = { transition: jest.fn().mockResolvedValue(undefined) };
    service = new CompletionService(prisma, audit, visits);
  });

  const base = { adverseEventOccurred: false, aftercareProvided: true };

  it('requires aftercare to be provided', async () => {
    await expect(service.record('v1', { ...base, aftercareProvided: false }, 'nurse-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects adverseEventOccurred=true with no adverse event record', async () => {
    prisma.adverseEvent.findMany.mockResolvedValue([]);
    await expect(
      service.record('v1', { ...base, adverseEventOccurred: true }, 'nurse-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects adverseEventOccurred=false when an adverse event record exists', async () => {
    prisma.adverseEvent.findMany.mockResolvedValue([{ id: 'ae-1' }]);
    await expect(
      service.record('v1', { ...base, adverseEventOccurred: false }, 'nurse-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('succeeds and transitions to PENDING_SIGNOFF when consistent', async () => {
    prisma.adverseEvent.findMany.mockResolvedValue([]);
    await service.record('v1', base, 'nurse-1');
    expect(visits.transition).toHaveBeenCalledWith('v1', 'PENDING_SIGNOFF', 'nurse-1', expect.any(String));
  });
});
