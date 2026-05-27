import {
  CHARACTER_EVENT_DEFINITIONS_BY_ID,
  type CharacterEventActivity,
  type CharacterEventDefinition,
  type CharacterEventPresentationVariant,
} from '~/constants/charactarEventsDefinitions';
import type { CharacterEventCandidate, CharacterEventDecisionInput } from '~/services/characterEvents/types';
import {
  createCharacterEventRuleContext,
  matchesCharacterEventClauses,
} from '~/services/characterEvents/rules';
import type { CharacterContext } from '~/stateMachines/gameFlow/context';
import type { OfflineNumericPatchPreview, OfflineStatusPatchPreview } from '../types';
import { OFFLINE_SIMULATION_POLICY } from '../offlineSimulationPolicy';
import { isOfflineActivityAvailableAt } from '../offlineTimeOfDay';

export interface OfflineResolverContext {
  candidate: CharacterEventCandidate;
  character: CharacterContext;
  input: CharacterEventDecisionInput;
  contexts: readonly CharacterContext[];
}

export interface ResolvedOfflineActivity {
  definition: CharacterEventDefinition;
  variant: CharacterEventPresentationVariant;
  activity: CharacterEventActivity;
}

export function getCandidateDefinition(
  candidate: CharacterEventCandidate,
): CharacterEventDefinition | undefined {
  return CHARACTER_EVENT_DEFINITIONS_BY_ID[candidate.id];
}

export function resolveOfflineActivity(
  context: OfflineResolverContext,
): ResolvedOfflineActivity | null {
  const definition = getCandidateDefinition(context.candidate);
  const variant = definition?.presentationVariants
    ?.filter(hasActivity)
    .filter(candidateVariant => matchesVariantConditions(candidateVariant, context))
    .filter(candidateVariant => isOfflineActivityAvailableAt(
      candidateVariant.activity,
      context.input.timestamp ?? Date.now(),
      OFFLINE_SIMULATION_POLICY,
    ))
    .sort((left, right) => right.baseWeight - left.baseWeight)[0];

  if (!definition || !variant?.activity) {
    return null;
  }

  return {
    definition,
    variant,
    activity: variant.activity,
  };
}

export function createStatusPatch(
  patch: OfflineStatusPatchPreview,
): OfflineStatusPatchPreview | null {
  return Object.keys(patch).length > 0 ? patch : null;
}

export function createNumericPatch(
  from: number,
  rawTo: number,
  clampTarget: 0 | 100,
): OfflineNumericPatchPreview {
  const to = clampTarget === 100
    ? Math.min(100, rawTo)
    : Math.max(0, rawTo);

  return {
    from,
    to,
    delta: to - from,
  };
}

export function getContextName(
  contexts: readonly CharacterContext[],
  characterId: string | undefined,
  fallback: string,
): string {
  return contexts.find(context => context.id === characterId)?.name ?? fallback;
}

function hasActivity(
  variant: CharacterEventPresentationVariant,
): variant is CharacterEventPresentationVariant & { activity: CharacterEventActivity } {
  return Boolean(variant.activity);
}

function matchesVariantConditions(
  variant: CharacterEventPresentationVariant,
  context: OfflineResolverContext,
): boolean {
  return matchesCharacterEventClauses(
    variant.conditions,
    variant.conditionMode,
    createCharacterEventRuleContext(
      context.character,
      context.character.utilityScores,
      context.input,
    ),
  );
}
