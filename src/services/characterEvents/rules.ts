import type { ComparisonOperator } from '~/constants/event';
import type {
  CharacterContext,
  CharacterUtilityScores,
} from '~/stateMachines/gameFlow/context';
import type { CharacterEventDecisionInput } from './types';

export type CharacterEventRulePath =
  | `character.${string}`
  | `utility.${string}`
  | `input.${string}`;

export type CharacterEventRuleValue = string | number | boolean | null | CharacterEventRuleValue[];
export type CharacterEventClauseMode = 'all' | 'some';

export interface CharacterEventRuleClause {
  path: CharacterEventRulePath;
  operator: ComparisonOperator;
  value: CharacterEventRuleValue;
}

export interface CharacterEventWeightModifier extends CharacterEventRuleClause {
  add?: number;
  multiplier?: number;
}

export interface CharacterEventRuleContext {
  character: CharacterContext;
  utility: CharacterUtilityScores;
  input: CharacterEventRuleInputSnapshot;
}

interface CharacterEventRuleInputSnapshot {
  nearbyCharacterIds: string[];
  nearbyCharacterCount: number;
  nearbyRelationshipFeelings: string[];
  nearbyRelationshipIntimacies: number[];
  nearbySocialStatuses: string[];
  nearbyJoinableActivityCount: number;
  ownItemIds: readonly string[];
  ownItemCount: number;
  globalEventTags: string[];
}

export function createCharacterEventRuleContext(
  character: CharacterContext,
  utility: CharacterUtilityScores,
  input: CharacterEventDecisionInput,
): CharacterEventRuleContext {
  const nearbyCharacterIds = input.nearbyCharacterIds ?? [];
  const nearbyRelationships = input.nearbyRelationships ?? [];
  const nearbyJoinableActivities = input.nearbyJoinableActivities ?? [];
  const globalEventTags = input.globalEventTags ?? [];
  const ownItemIds = input.ownItemIds ?? character.ownItems.map(item => item.definitionId);

  return {
    character,
    utility,
    input: {
      nearbyCharacterIds,
      nearbyCharacterCount: nearbyCharacterIds.length,
      nearbyRelationshipFeelings: nearbyRelationships.map(relationship => relationship.feeling),
      nearbyRelationshipIntimacies: nearbyRelationships.map(relationship => relationship.intimacy),
      nearbySocialStatuses: nearbyRelationships.map(relationship => relationship.socialStatus),
      nearbyJoinableActivityCount: nearbyJoinableActivities.length,
      ownItemIds,
      ownItemCount: ownItemIds.length,
      globalEventTags,
    },
  };
}

export function matchesCharacterEventClauses(
  clauses: readonly CharacterEventRuleClause[] | undefined,
  mode: CharacterEventClauseMode | undefined,
  context: CharacterEventRuleContext,
): boolean {
  if (!clauses?.length) {
    return true;
  }

  if (mode === 'some') {
    return clauses.some(clause => matchesCharacterEventClause(clause, context));
  }

  return clauses.every(clause => matchesCharacterEventClause(clause, context));
}

export function applyCharacterEventWeightModifiers(
  baseWeight: number,
  modifiers: readonly CharacterEventWeightModifier[] | undefined,
  context: CharacterEventRuleContext,
): number {
  if (!modifiers?.length) {
    return baseWeight;
  }

  return modifiers.reduce((weight, modifier) => {
    if (!matchesCharacterEventClause(modifier, context)) {
      return weight;
    }

    return Math.max(0, weight * (modifier.multiplier ?? 1) + (modifier.add ?? 0));
  }, baseWeight);
}

function matchesCharacterEventClause(
  clause: CharacterEventRuleClause,
  context: CharacterEventRuleContext,
): boolean {
  const actual = readCharacterEventRuleValue(clause.path, context);
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
      return Array.isArray(expected) && expected.includes(actual as CharacterEventRuleValue);
    case 'includes':
      return Array.isArray(actual) && actual.includes(expected);
    default:
      return false;
  }
}

function readCharacterEventRuleValue(
  path: CharacterEventRulePath,
  context: CharacterEventRuleContext,
): unknown {
  const [scope, ...segments] = path.split('.');
  const source = getPathSource(scope, context);

  return segments.reduce<unknown>((value, segment) => {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    return (value as Record<string, unknown>)[segment];
  }, source);
}

function getPathSource(scope: string, context: CharacterEventRuleContext): unknown {
  switch (scope) {
    case 'character':
      return context.character;
    case 'utility':
      return context.utility;
    case 'input':
      return context.input;
    default:
      return undefined;
  }
}
