/**
 * Safe evaluator for clinic-authored screening rules. There is deliberately
 * no `eval`, no Function() construction, and no arbitrary code execution —
 * a rule is a JSON tree built from this fixed grammar, matched against a
 * flattened view of the patient's intake answers. This is what "the clinic
 * supplies screening rules, the software never invents them" looks like in
 * code: the engine can only ever test conditions someone explicitly wrote
 * down and the Medical Director approved (ScreeningRule.approvedBy), never
 * derive a new one.
 *
 * Grammar:
 *   { field: "conditions.Heart disease", op: "truthy" }
 *   { field: "allergyYN", op: "eq", value: true }
 *   { any: [rule, rule, ...] }
 *   { all: [rule, rule, ...] }
 *   { not: rule }
 *
 * `field` is a dot path evaluated against the IntakeData object built by
 * buildIntakeDataView() below.
 */

export type RuleExpression =
  | { field: string; op: 'truthy' | 'falsy' | 'exists'; value?: never }
  | { field: string; op: 'eq' | 'neq'; value: unknown }
  | { field: string; op: 'in'; value: unknown[] }
  | { any: RuleExpression[] }
  | { all: RuleExpression[] }
  | { not: RuleExpression };

export interface IntakeDataView {
  conditions: Record<string, boolean>;
  otherConditions?: string;
  allergyYN?: boolean;
  pregnant?: boolean;
  mightBePregnant?: boolean;
  breastfeeding?: boolean;
  priorIV?: boolean;
  priorReaction?: boolean;
  priorAccessIssue?: boolean;
  [key: string]: unknown;
}

function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

const MAX_DEPTH = 8; // guards against a pathological/misconfigured rule tree

export function evaluateRule(expr: RuleExpression, data: IntakeDataView, depth = 0): boolean {
  if (depth > MAX_DEPTH) {
    throw new Error('Screening rule expression exceeds maximum nesting depth');
  }

  if ('any' in expr) return expr.any.some((e) => evaluateRule(e, data, depth + 1));
  if ('all' in expr) return expr.all.every((e) => evaluateRule(e, data, depth + 1));
  if ('not' in expr) return !evaluateRule(expr.not, data, depth + 1);

  const actual = getPath(data, expr.field);
  switch (expr.op) {
    case 'truthy':
      return !!actual;
    case 'falsy':
      return !actual;
    case 'exists':
      return actual !== undefined && actual !== null;
    case 'eq':
      return actual === expr.value;
    case 'neq':
      return actual !== expr.value;
    case 'in':
      return Array.isArray(expr.value) && expr.value.includes(actual);
    default:
      // Unknown operator — fail safe by NOT matching, but this should be
      // caught at rule-authoring time (ScreeningRulesService.validate), not
      // silently ignored in production.
      return false;
  }
}
