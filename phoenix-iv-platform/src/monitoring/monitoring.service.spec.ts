import { BadRequestException } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';

describe('MonitoringService', () => {
  let service: MonitoringService;
  let prisma: any;
  let audit: any;
  let visits: any;

  beforeEach(() => {
    prisma = {
      vitalSet: { create: jest.fn().mockResolvedValue({ id: 'vs-1' }) },
      infusionMonitoringEntry: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'entry-1', ...data })),
        findMany: jest.fn(),
      },
    };
    audit = { write: jest.fn().mockResolvedValue(undefined) };
    visits = { transition: jest.fn().mockResolvedValue(undefined) };
    service = new MonitoringService(prisma, audit, visits);
  });

  it('does not transition the visit when tolerating is true', async () => {
    await service.addEntry('v1', { tolerating: true, symptomsObservation: 'Comfortable' }, 'nurse-1');
    expect(visits.transition).not.toHaveBeenCalled();
  });

  it('auto-transitions to ADVERSE_EVENT when tolerating is false', async () => {
    await service.addEntry('v1', { tolerating: false, symptomsObservation: 'Hives, itching' }, 'nurse-1');
    expect(visits.transition).toHaveBeenCalledWith('v1', 'ADVERSE_EVENT', 'nurse-1', expect.any(String));
  });

  it('refuses to complete monitoring with zero entries', async () => {
    prisma.infusionMonitoringEntry.findMany.mockResolvedValue([]);
    await expect(service.completeMonitoring('v1', 'nurse-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses to complete monitoring when the latest entry reported intolerance', async () => {
    prisma.infusionMonitoringEntry.findMany.mockResolvedValue([
      { tolerating: true },
      { tolerating: false },
    ]);
    await expect(service.completeMonitoring('v1', 'nurse-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('completes monitoring when the latest entry reported tolerance', async () => {
    prisma.infusionMonitoringEntry.findMany.mockResolvedValue([
      { tolerating: false },
      { tolerating: true },
    ]);
    await service.completeMonitoring('v1', 'nurse-1');
    expect(visits.transition).toHaveBeenCalledWith('v1', 'TREATMENT_COMPLETION', 'nurse-1', expect.any(String));
  });
});
