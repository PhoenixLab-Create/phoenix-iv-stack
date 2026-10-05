import { RecordService } from './record.service';

describe('RecordService', () => {
  let service: RecordService;

  beforeEach(() => {
    service = new RecordService({} as any);
  });

  it('produces the same canonical string regardless of input key order', () => {
    const a = { b: 1, a: 2, nested: { y: 1, x: 2 } };
    const b = { a: 2, b: 1, nested: { x: 2, y: 1 } };
    expect(service.canonicalize(a)).toEqual(service.canonicalize(b));
  });

  it('hashes identical canonical strings identically and different ones differently', () => {
    const h1 = service.hash(service.canonicalize({ a: 1 }));
    const h2 = service.hash(service.canonicalize({ a: 1 }));
    const h3 = service.hash(service.canonicalize({ a: 2 }));
    expect(h1).toEqual(h2);
    expect(h1).not.toEqual(h3);
  });

  it('getCurrentView only applies amendments that have an approved decision', async () => {
    (service as any).prisma = {
      visit: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'v1',
          assessment: { visitId: 'v1', notes: 'original note' },
        }),
      },
      amendment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'am-1',
            targetTable: 'assessments',
            targetId: 'v1',
            field: 'notes',
            newValue: 'corrected note',
            approvals: [{ decision: 'approved' }],
          },
          {
            id: 'am-2',
            targetTable: 'assessments',
            targetId: 'v1',
            field: 'notes',
            newValue: 'should not apply',
            approvals: [],
          },
        ]),
      },
    };

    const result = await service.getCurrentView('v1');
    expect(result.record.assessment.notes).toBe('corrected note');
    expect(result.appliedAmendments).toHaveLength(1);
    expect(result.pendingAmendments).toHaveLength(1);
  });
});
