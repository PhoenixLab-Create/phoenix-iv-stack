import { evaluateRule, IntakeDataView, RuleExpression } from './rule-evaluator';

const baseData: IntakeDataView = {
  conditions: { 'Heart disease': false, 'Kidney disease': false, Diabetes: true },
  allergyYN: false,
  pregnant: false,
  mightBePregnant: false,
};

describe('screening rule evaluator', () => {
  it('matches a simple truthy condition field', () => {
    const rule: RuleExpression = { field: 'conditions.Diabetes', op: 'truthy' };
    expect(evaluateRule(rule, baseData)).toBe(true);
  });

  it('does not match a falsy condition field', () => {
    const rule: RuleExpression = { field: 'conditions.Heart disease', op: 'truthy' };
    expect(evaluateRule(rule, baseData)).toBe(false);
  });

  it('supports "any" across multiple fields', () => {
    const rule: RuleExpression = {
      any: [
        { field: 'conditions.Heart disease', op: 'truthy' },
        { field: 'conditions.Diabetes', op: 'truthy' },
      ],
    };
    expect(evaluateRule(rule, baseData)).toBe(true);
  });

  it('supports "all" requiring every condition', () => {
    const rule: RuleExpression = {
      all: [
        { field: 'conditions.Diabetes', op: 'truthy' },
        { field: 'allergyYN', op: 'truthy' },
      ],
    };
    expect(evaluateRule(rule, baseData)).toBe(false); // allergyYN is false
  });

  it('supports "not"', () => {
    const rule: RuleExpression = { not: { field: 'allergyYN', op: 'truthy' } };
    expect(evaluateRule(rule, baseData)).toBe(true);
  });

  it('supports eq/neq/in against non-boolean values', () => {
    const data: IntakeDataView = { ...baseData, reasonCode: 'wellness' } as any;
    expect(evaluateRule({ field: 'reasonCode', op: 'eq', value: 'wellness' }, data)).toBe(true);
    expect(evaluateRule({ field: 'reasonCode', op: 'neq', value: 'hydration' }, data)).toBe(true);
    expect(evaluateRule({ field: 'reasonCode', op: 'in', value: ['wellness', 'fatigue'] }, data)).toBe(true);
  });

  it('treats a missing field as non-matching rather than throwing', () => {
    const rule: RuleExpression = { field: 'conditions.Nonexistent', op: 'truthy' };
    expect(evaluateRule(rule, baseData)).toBe(false);
  });

  it('refuses to evaluate pathologically deep nested rules', () => {
    let rule: RuleExpression = { field: 'allergyYN', op: 'truthy' };
    for (let i = 0; i < 12; i++) rule = { not: rule };
    expect(() => evaluateRule(rule, baseData)).toThrow(/maximum nesting depth/);
  });
});
