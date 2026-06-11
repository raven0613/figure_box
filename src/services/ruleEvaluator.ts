import type { ComparisonOperator } from '~/constants/event';

export type RuleValue = string | number | boolean | null | RuleValue[];
export type RuleClauseMode = 'all' | 'some';

export interface RuleClause<Path extends string = string> {
  path: Path;
  operator: ComparisonOperator;
  value: RuleValue;
}

export interface RuleWeightModifier<Path extends string = string>
  extends RuleClause<Path> {
  add?: number;
  multiplier?: number;
}

export function matchesRuleClauses<Path extends string, Context>(
  clauses: readonly RuleClause<Path>[] | undefined,
  mode: RuleClauseMode | undefined,
  context: Context,
  readValue: (path: Path, context: Context) => unknown,
): boolean {
  if (!clauses?.length) {
    return true;
  }

  if (mode === 'some') {
    return clauses.some(clause => matchesRuleClause(clause, context, readValue));
  }

  return clauses.every(clause => matchesRuleClause(clause, context, readValue));
}

export function applyRuleWeightModifiers<Path extends string, Context>(
  baseWeight: number,
  modifiers: readonly RuleWeightModifier<Path>[] | undefined,
  context: Context,
  readValue: (path: Path, context: Context) => unknown,
): number {
  return modifiers?.reduce((weight, modifier) => {
    if (!matchesRuleClause(modifier, context, readValue)) {
      return weight;
    }

    return Math.max(0, weight * (modifier.multiplier ?? 1) + (modifier.add ?? 0));
  }, baseWeight) ?? baseWeight;
}

function matchesRuleClause<Path extends string, Context>(
  clause: RuleClause<Path>,
  context: Context,
  readValue: (path: Path, context: Context) => unknown,
): boolean {
  const actual = readValue(clause.path, context);
  const expected = clause.value;

  switch (clause.operator) {
    case '==':
      return actual === expected;
    case '!=':
      return actual !== expected;
    case '>':
      return Number(actual) > Number(expected);
    case '>=':
      return Number(actual) >= Number(expected);
    case '<':
      return Number(actual) < Number(expected);
    case '<=':
      return Number(actual) <= Number(expected);
    case 'in':
      return Array.isArray(expected) && expected.some(value => value === actual);
    case 'includes':
      return Array.isArray(actual) && actual.some(value => value === expected);
    default:
      return false;
  }
}
