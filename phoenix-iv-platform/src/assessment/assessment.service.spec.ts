import { BadRequestException } from '@nestjs/common';
import { AssessmentService } from './assessment.service';

describe('AssessmentService — cannot bypass unacknowledged screening flags', () => {
  let service: AssessmentService;
  let prisma: any;
  let audit: any;
  let visits: any;
  let screening: any;

  beforeEach(() => {
    prisma = {
      vitalSet: { create: jest.fn() },
      assessment: { upsert: jest.fn().mockResolvedValue({ visitId: 'v1', decision: 'Proceed' }) },
    };
    audit = { write: jest.fn().mockResolvedValue(undefined) };
    visits = { transition: jest.fn().mockResolvedValue(undefined) };
    screening = { allFlagsAcknowledged: jest.fn() };
    service = new AssessmentService(prisma, audit, visits, screening);
  });

  const input = {
    reasonForVisit: 'Wellness',
    decision: 'Proceed' as const,
    vitals: { bpSystolic: 118, bpDiastolic: 74, heartRate: 70 },
  };

  it('refuses to record when an unacknowledged flag exists', async () => {
    screening.allFlagsAcknowledged.mockResolvedValue(false);

    await expect(service.record('v1', input, 'nurse-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.assessment.upsert).not.toHaveBeenCalled();
    expect(visits.transition).not.toHaveBeenCalled();
  });

  it('records and transitions to ORDER_AUTHORIZATION when decision is Proceed and all flags are acknowledged', async () => {
    screening.allFlagsAcknowledged.mockResolvedValue(true);

    await service.record('v1', input, 'nurse-1');

    expect(prisma.assessment.upsert).toHaveBeenCalled();
    expect(visits.transition).toHaveBeenCalledWith('v1', 'ORDER_AUTHORIZATION', 'nurse-1', expect.any(String));
  });

  it('transitions to NOT_PROCEEDING when the clinician decides not to proceed', async () => {
    screening.allFlagsAcknowledged.mockResolvedValue(true);

    await service.record('v1', { ...input, decision: 'Do not proceed' }, 'nurse-1');

    expect(visits.transition).toHaveBeenCalledWith('v1', 'NOT_PROCEEDING', 'nurse-1', expect.any(String));
  });
});
