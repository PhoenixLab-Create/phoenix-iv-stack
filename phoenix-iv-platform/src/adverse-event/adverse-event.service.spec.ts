import { BadRequestException } from '@nestjs/common';
import { AdverseEventService } from './adverse-event.service';

describe('AdverseEventService', () => {
  let service: AdverseEventService;
  let prisma: any;
  let audit: any;
  let visits: any;

  beforeEach(() => {
    prisma = {
      vitalSet: { create: jest.fn().mockResolvedValue({ id: 'vs-1' }) },
      adverseEvent: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'ae-1', ...data })),
        findMany: jest.fn(),
      },
    };
    audit = { write: jest.fn().mockResolvedValue(undefined) };
    visits = { transition: jest.fn().mockResolvedValue(undefined) };
    service = new AdverseEventService(prisma, audit, visits);
  });

  const baseInput = {
    onsetTime: new Date().toISOString(),
    signsSymptoms: 'Hives, mild dyspnea',
    infusionAction: 'stopped' as const,
    emsContacted: false,
    hospitalTransfer: false,
    outcome: 'Resolved with diphenhydramine per order; vitals stable',
  };

  it('rejects an adverse event record with no outcome', async () => {
    await expect(
      service.record('v1', { ...baseInput, outcome: '  ', resolution: 'resume_monitoring' }, 'nurse-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('transitions back to INFUSION_MONITORING on resume_monitoring', async () => {
    await service.record('v1', { ...baseInput, resolution: 'resume_monitoring' }, 'nurse-1');
    expect(visits.transition).toHaveBeenCalledWith('v1', 'INFUSION_MONITORING', 'nurse-1', expect.any(String));
  });

  it('transitions to TREATMENT_COMPLETION on move_to_completion', async () => {
    await service.record('v1', { ...baseInput, resolution: 'move_to_completion' }, 'nurse-1');
    expect(visits.transition).toHaveBeenCalledWith('v1', 'TREATMENT_COMPLETION', 'nurse-1', expect.any(String));
  });
});
