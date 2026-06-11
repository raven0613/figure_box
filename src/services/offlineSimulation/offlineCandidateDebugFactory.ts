import type { CharacterContext } from '~/stateMachines/gameFlow/context';
import type {
  CharacterEventCandidate,
  CharacterEventDecisionInput,
} from '~/services/characterEvents/types';
import {
  OFFLINE_SIMULATION_POLICY,
  resolveOfflineEventPolicy,
} from './offlineSimulationPolicy';
import { resolveOfflineEventPreview } from './offlineEventResolver';
import {
  getOfflineCandidateActivityType,
  resolveOfflineRecapTemplate,
} from './offlineRecapTemplates';
import type {
  OfflineCharacterCandidateDebug,
  OfflineRecapPreview,
} from './types';

export function createOfflineCandidateDebug(
  candidate: CharacterEventCandidate,
  context: CharacterContext,
  input: CharacterEventDecisionInput,
  contexts: readonly CharacterContext[],
): OfflineCharacterCandidateDebug {
  const policy = resolveOfflineEventPolicy(OFFLINE_SIMULATION_POLICY, candidate);
  const offlineWeight = policy.enabled ? candidate.weight * policy.weightMultiplier : 0;
  const resolutionPreview = resolveOfflineEventPreview(candidate, context, input, contexts);
  const activityType = resolutionPreview.kind === 'group'
    ? resolutionPreview.activityType
    : getOfflineCandidateActivityType(candidate);

  return {
    id: candidate.id,
    bucketId: candidate.bucketId,
    motivation: candidate.motivation,
    onlineWeight: roundWeight(candidate.weight),
    offlineWeight: roundWeight(offlineWeight),
    policy,
    eventType: candidate.event.type,
    activityType,
    recapPreview: policy.recap === 'none'
      ? null
      : createRecapPreview(candidate, context, input, contexts, resolutionPreview),
    resolutionPreview,
  };
}

function createRecapPreview(
  candidate: CharacterEventCandidate,
  context: CharacterContext,
  input: CharacterEventDecisionInput,
  contexts: readonly CharacterContext[],
  resolutionPreview: ReturnType<typeof resolveOfflineEventPreview>,
): OfflineRecapPreview {
  const resolvedTemplate = resolveOfflineRecapTemplate(candidate, resolutionPreview);
  const variables = {
    ...createTemplateVariables(context, input, contexts),
    ...(resolutionPreview.kind === 'unsupported'
      ? resolutionPreview.variables ?? {}
      : resolutionPreview.variables),
  };

  return {
    templateSource: resolvedTemplate.source,
    summary: formatTemplate(resolvedTemplate.template.summary, variables),
    detail: resolvedTemplate.template.detail
      ? formatTemplate(resolvedTemplate.template.detail, variables)
      : undefined,
    quote: resolvedTemplate.template.quote
      ? formatTemplate(resolvedTemplate.template.quote, variables)
      : undefined,
    priority: resolvedTemplate.template.priority ?? 0,
    sequenceKey: resolvedTemplate.template.sequenceKey,
    sequenceOrder: resolvedTemplate.template.sequenceOrder,
  };
}

function createTemplateVariables(
  context: CharacterContext,
  input: CharacterEventDecisionInput,
  contexts: readonly CharacterContext[],
): Record<string, string> {
  const targetCharacterId = input.nearbyCharacterIds?.[0] ?? '';
  const targetContext = contexts.find(candidate => candidate.id === targetCharacterId);
  const itemName = input.ownItemIds?.[0] ?? input.nearbyVisibleItems?.[0]?.definitionId ?? '物品';

  return {
    characterName: context.name,
    initiatorName: context.name,
    participantNames: context.name,
    participantNameList: context.name,
    participantCount: '1',
    targetName: targetContext?.name ?? '附近的人',
    itemName,
    locationName: '附近',
  };
}

function formatTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => variables[key] ?? `{${key}}`);
}

function roundWeight(value: number): number {
  return Math.round(value * 1000) / 1000;
}
