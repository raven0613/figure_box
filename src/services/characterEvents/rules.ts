import type {
  CharacterContext,
  CharacterUtilityScores,
} from '~/stateMachines/gameFlow/context';
import type { CharacterEventDecisionInput } from './types';
import {
  applyRuleWeightModifiers,
  matchesRuleClauses,
  type RuleClause,
  type RuleClauseMode,
  type RuleValue,
  type RuleWeightModifier,
} from '~/services/ruleEvaluator';

export type CharacterEventRulePath =
  | `character.${string}`
  | `utility.${string}`
  | `input.${string}`;

export type CharacterEventRuleValue = RuleValue;
export type CharacterEventClauseMode = RuleClauseMode;

export type CharacterEventRuleClause = RuleClause<CharacterEventRulePath>;
export type CharacterEventWeightModifier = RuleWeightModifier<CharacterEventRulePath>;

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
  nearbyVisibleItemDefinitionIds: string[];
  nearbyVisibleItemCategories: string[];
  nearbyVisibleItemTags: string[];
  nearbyVisibleItemRarities: string[];
  nearbyVisibleItemCount: number;
  nearbyObservableObjectIds: string[];
  nearbyObservableObjectKinds: string[];
  nearbyObservableObjectCount: number;
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
  const nearbyVisibleItems = input.nearbyVisibleItems ?? [];
  const nearbyObservableObjects = input.nearbyObservableObjects ?? [];
  const globalEventTags = input.globalEventTags ?? [];
  const ownItemIds = input.ownItemIds ?? character.ownItems.map(item => item.definitionId);
  const nearbyVisibleItemTags = [...new Set(nearbyVisibleItems.flatMap(item => [...item.tags]))];

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
      nearbyVisibleItemDefinitionIds: nearbyVisibleItems.map(item => item.definitionId),
      nearbyVisibleItemCategories: nearbyVisibleItems.map(item => item.category),
      nearbyVisibleItemTags,
      nearbyVisibleItemRarities: nearbyVisibleItems.map(item => item.rarity),
      nearbyVisibleItemCount: nearbyVisibleItems.length,
      nearbyObservableObjectIds: nearbyObservableObjects.map(object => object.id),
      nearbyObservableObjectKinds: nearbyObservableObjects.map(object => object.kind),
      nearbyObservableObjectCount: nearbyObservableObjects.length,
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
  return matchesRuleClauses(
    clauses,
    mode,
    context,
    readCharacterEventRuleValue,
  );
}

export function applyCharacterEventWeightModifiers(
  baseWeight: number,
  modifiers: readonly CharacterEventWeightModifier[] | undefined,
  context: CharacterEventRuleContext,
): number {
  return applyRuleWeightModifiers(
    baseWeight,
    modifiers,
    context,
    readCharacterEventRuleValue,
  );
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
