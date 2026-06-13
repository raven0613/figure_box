import { Feeling, SocialStatus, type Position } from '~/constants/character';
import type {
  CharacterEventAcceptance,
  CharacterEventActivity,
  CharacterEventActivityEffects,
  CharacterEventActivityRollBranch,
  CharacterEventDefinition,
} from '~/constants/charactarEventsDefinitions';
import {
  createDefaultCharacterPersonality,
  type CharacterPersonality,
} from '~/constants/characterPersonality';
import {
  selectActivityRollBranch,
  type ActivityRollRuleContext,
  type ActivityRollSelection,
} from '~/services/characterEvents/activityRolls';
import { itemService } from '~/services/items/itemService';
import {
  applyCompletedActivityStatusEffects,
  resolveActivityEffectsForRole,
} from '~/services/characterEvents/activityCompletionEffects';
import { getPlayableCharacters } from '~/services/playableCharacterService';
import { relationshipStoreService } from '~/services/save/relationshipStoreService';
import { EventType } from '~/stateMachines/gameFlow/events';
import type { CharacterContext } from '~/stateMachines/gameFlow/context';
import type {
  OfflineParticipantResolutionPreview,
  OfflineRelationshipPatchPreview,
  OfflineResolutionPreview,
  OfflineStatusPatchPreview,
} from '../types';
import { createSeededRandom } from '../offlineRandom';
import {
  createOfflineDestinationPositionPatch,
  createOfflineNearbyDriftPositionPatch,
  getFirstDestinationTarget,
} from '../offlinePositionResolver';
import {
  createNumericPatch,
  createStatusPatch,
  getCandidateDefinition,
  getContextName,
  resolveOfflineActivity,
  type OfflineResolverContext,
} from './offlineResolverUtils';
import { OFFLINE_SIMULATION_POLICY } from '../offlineSimulationPolicy';
import { isOfflineActivityAvailableAt } from '../offlineTimeOfDay';

export function resolveOfflineActivityPreview(
  context: OfflineResolverContext,
): OfflineResolutionPreview | null {
  if (
    context.candidate.event.type !== EventType.StartActivity &&
    context.candidate.event.type !== EventType.JoinActivity
  ) {
    return null;
  }

  if (context.candidate.event.type === EventType.JoinActivity) {
    return {
      kind: 'unsupported',
      resolverSource: 'activity.joinActivity',
      reason: 'missingActiveActivityRoll',
      variables: createParticipantVariables(context),
    };
  }

  const resolvedActivity = resolveOfflineActivity(context);

  if (!resolvedActivity) {
    return {
      kind: 'unsupported',
      resolverSource: 'activity.unknown',
      reason: hasUnavailableActivityAtTimestamp(context)
        ? 'activityUnavailableAtTimestamp'
        : 'missingActivityMetadata',
      variables: createParticipantVariables(context),
    };
  }

  switch (resolvedActivity.activity.type) {
    case 'playWithItem':
      return resolveGroupActivity(
        context,
        resolvedActivity.definition,
        resolvedActivity.variant.id,
        resolvedActivity.activity,
      );
    case 'playAtLocation':
      return resolveGroupActivity(
        context,
        resolvedActivity.definition,
        resolvedActivity.variant.id,
        resolvedActivity.activity,
      );
    case 'chat':
      return resolveGroupActivity(
        context,
        resolvedActivity.definition,
        resolvedActivity.variant.id,
        resolvedActivity.activity,
      );
    default:
      return {
        kind: 'unsupported',
        resolverSource: `activity.${resolvedActivity.activity.type}`,
        reason: 'unsupportedActivityType',
        variables: createActivityVariables(context, resolvedActivity.activity),
      };
  }
}

function resolveGroupActivity(
  context: OfflineResolverContext,
  definition: CharacterEventDefinition,
  presentationVariantId: string,
  activity: CharacterEventActivity,
): OfflineResolutionPreview {
  const participantRoll = resolveActivityParticipants(context, definition, activity);

  if (!participantRoll.success) {
    return {
      kind: 'unsupported',
      resolverSource: `activity.${activity.type}`,
      reason: participantRoll.reason,
      variables: createActivityVariables(context, activity),
    };
  }

  const rollResolution = resolveOfflineActivityRolls(
    context,
    activity,
    participantRoll.participants,
  );

  if (!rollResolution.success) {
    return {
      kind: 'unsupported',
      resolverSource: `activity.${activity.type}`,
      reason: rollResolution.reason,
      variables: createActivityVariables(context, activity, participantRoll.participants),
    };
  }

  const outcomeEffects = rollResolution.outcomeBranch
    ? rollResolution.outcomeBranch.effects
    : activity.effects;
  const outcomeEffectsByRole = rollResolution.outcomeBranch
    ? rollResolution.outcomeBranch.effectsByRole
    : activity.effectsByRole;
  const participants = participantRoll.participants.map((participant, index) => (
    createParticipantResolution({
      context,
      definition,
      activity,
      effects: resolveActivityEffectsForRole(
        outcomeEffects,
        outcomeEffectsByRole,
        index === 0 ? 'initiator' : 'target',
      ),
      participant,
      participantIds: participantRoll.participants.map(item => item.id),
      role: index === 0 ? 'initiator' : 'target',
    })
  ));

  return {
    kind: 'group',
    resolverSource: `activity.${activity.type}`,
    activityType: activity.type,
    activityKey: activity.key,
    presentationVariantId,
    ...(rollResolution.outcomeBranch
      ? { outcomeId: rollResolution.outcomeBranch.id }
      : {}),
    rollSelections: Object.fromEntries(
      Object.entries(rollResolution.selections).map(([rollId, selection]) => [
        rollId,
        selection.selectedBranchId,
      ]),
    ),
    participantIds: participantRoll.participants.map(participant => participant.id),
    participants,
    variables: {
      ...createActivityVariables(context, activity, participantRoll.participants),
      activityOutcomeId: rollResolution.outcomeBranch?.id ?? 'completed',
    },
    notes: [
      '使用 activity.group 的通用離線參加者抽選。',
      '離線只套用完成後結果，不重跑 inviting/active/traveling 表演階段。',
      ...(activity.rolls?.length
        ? ['依照 activity.rolls 順序執行離線分支抽選。']
        : []),
    ],
  };
}

function hasUnavailableActivityAtTimestamp(context: OfflineResolverContext): boolean {
  const timestamp = context.input.timestamp ?? Date.now();
  const activityVariants = getCandidateDefinition(context.candidate)?.presentationVariants
    ?.filter(variant => variant.activity) ?? [];

  return activityVariants.length > 0 &&
    activityVariants.every(variant => (
      variant.activity &&
      !isOfflineActivityAvailableAt(variant.activity, timestamp, OFFLINE_SIMULATION_POLICY)
    ));
}

type ActivityParticipantRollResult =
  | {
    success: true;
    participants: readonly CharacterContext[];
  }
  | {
    success: false;
    reason: string;
  };

function resolveActivityParticipants(
  context: OfflineResolverContext,
  definition: CharacterEventDefinition,
  activity: CharacterEventActivity,
): ActivityParticipantRollResult {
  const minParticipants = getGroupMinParticipants(activity);
  const maxParticipants = getGroupMaxParticipants(activity);
  const random = createSeededRandom([
    'offline-activity-participants',
    String(context.input.timestamp ?? 0),
    context.candidate.id,
    context.character.id,
    activity.key,
  ].join(':'));
  const candidates = getNearbyParticipantCandidates(context, activity)
    .filter(candidate => canJoinOfflineActivity(candidate, activity))
    .map(candidate => ({ candidate, roll: random() }))
    .sort((left, right) => left.roll - right.roll)
    .map(entry => entry.candidate);
  const acceptedParticipants = [context.character];

  for (const candidate of candidates) {
    if (acceptedParticipants.length >= maxParticipants) {
      break;
    }

    if (canAcceptOfflineActivity(candidate, context.character.id, definition.acceptance, random)) {
      acceptedParticipants.push(candidate);
    }
  }

  if (acceptedParticipants.length < minParticipants) {
    return {
      success: false,
      reason: 'missingParticipantRoll',
    };
  }

  return {
    success: true,
    participants: acceptedParticipants,
  };
}

function createParticipantResolution(input: {
  context: OfflineResolverContext;
  definition: CharacterEventDefinition;
  activity: CharacterEventActivity;
  effects: CharacterEventActivityEffects | undefined;
  participant: CharacterContext;
  participantIds: readonly string[];
  role: 'initiator' | 'target';
}): OfflineParticipantResolutionPreview {
  const partnerCharacterIds = input.participantIds.filter(participantId => participantId !== input.participant.id);

  return {
    characterId: input.participant.id,
    characterName: input.participant.name,
    statusPatch: createActivityStatusPatch(input.participant, input.effects),
    positionPatch: createActivityPositionPatch(input.participant, input.activity),
    currentMotivation: 'idle',
    relationshipPatches: createActivityRelationshipPatches(
      input.effects,
      input.context.contexts.filter(candidate => partnerCharacterIds.includes(candidate.id)),
      input.context.input.timestamp ?? Date.now(),
    ),
    activityCooldownRecord: partnerCharacterIds.length > 0
      ? {
        partnerCharacterIds,
        role: input.role,
        sourceEventId: input.definition.id,
        timestamp: input.context.input.timestamp ?? Date.now(),
      }
      : null,
  };
}

type OfflineActivityRollResolution =
  | {
    success: true;
    selections: Readonly<Record<string, ActivityRollSelection>>;
    outcomeBranch: CharacterEventActivityRollBranch | null;
  }
  | {
    success: false;
    reason: string;
  };

function resolveOfflineActivityRolls(
  context: OfflineResolverContext,
  activity: CharacterEventActivity,
  participants: readonly CharacterContext[],
): OfflineActivityRollResolution {
  const rolls = activity.rolls ?? [];

  if (rolls.length === 0) {
    return {
      success: true,
      selections: {},
      outcomeBranch: null,
    };
  }

  const ruleContext = createOfflineActivityRollRuleContext(participants);

  if (!ruleContext) {
    return {
      success: false,
      reason: 'missingActivityRollParticipants',
    };
  }

  let selections: Readonly<Record<string, ActivityRollSelection>> = {};

  for (const roll of rolls) {
    const selectedBranch = selectActivityRollBranch(
      roll,
      {
        ...ruleContext,
        activity: {
          participantCount: participants.length,
          rolls: selections,
        },
      },
      createSeededRandom([
        'offline-activity-roll',
        String(context.input.timestamp ?? 0),
        context.candidate.id,
        context.character.id,
        activity.key,
        roll.id,
      ].join(':')),
    );

    if (!selectedBranch) {
      return {
        success: false,
        reason: `missingActivityRollBranch:${roll.id}`,
      };
    }

    selections = {
      ...selections,
      [roll.id]: {
        selectedBranchId: selectedBranch.id,
      },
    };

    if (roll.resolvesActivity) {
      return {
        success: true,
        selections,
        outcomeBranch: selectedBranch,
      };
    }
  }

  return {
    success: true,
    selections,
    outcomeBranch: null,
  };
}

function createOfflineActivityRollRuleContext(
  participants: readonly CharacterContext[],
): Omit<ActivityRollRuleContext, 'activity'> | null {
  const initiator = participants[0];
  const target = participants[1] ?? initiator;

  if (!initiator || !target) {
    return null;
  }

  const personalitiesById = new Map<string, CharacterPersonality>(
    getPlayableCharacters().map(character => [
      character.id,
      character.personality ?? createDefaultCharacterPersonality(),
    ] as const),
  );
  const initiatorRelationship = initiator.relationships
    .find(relationship => relationship.targetCharId === target.id);
  const targetRelationship = target.relationships
    .find(relationship => relationship.targetCharId === initiator.id);
  const relationshipToTarget = {
    feeling: initiatorRelationship?.feeling ?? Feeling.Neutral,
    intimacy: initiatorRelationship?.intimacy ?? 0,
  };
  const relationshipToInitiator = {
    feeling: targetRelationship?.feeling ?? Feeling.Neutral,
    intimacy: targetRelationship?.intimacy ?? 0,
  };

  return {
    initiator: {
      status: initiator.status,
      personality: personalitiesById.get(initiator.id) ?? createDefaultCharacterPersonality(),
      relationshipToOther: relationshipToTarget,
      relationshipToTarget,
    },
    target: {
      status: target.status,
      personality: personalitiesById.get(target.id) ?? createDefaultCharacterPersonality(),
      relationshipToOther: relationshipToInitiator,
      relationshipToInitiator,
    },
  };
}

function createActivityVariables(
  context: OfflineResolverContext,
  activity: CharacterEventActivity,
  participants: readonly CharacterContext[] = [context.character],
): Record<string, string> {
  const itemId = activity.joinRequirements?.type === 'hasItem'
    ? activity.joinRequirements.itemId
    : context.input.ownItemIds?.[0] ?? context.input.nearbyVisibleItems?.[0]?.definitionId;
  const itemDefinition = itemId ? itemService.getDefinition(itemId) : null;
  const partnerNames = participants
    .filter(participant => participant.id !== context.character.id)
    .map(participant => participant.name);
  const participantNames = participants.map(participant => participant.name);

  return {
    ...createParticipantVariables(context),
    activityType: activity.type,
    itemName: itemDefinition?.nameKey ?? itemId ?? '附近的東西',
    locationName: resolveLocationName(activity),
    participantNames: participantNames.join('、'),
    participantNameList: formatParticipantNameList(participantNames),
    targetName: partnerNames.join('、') || '附近的人',
    participantCount: String(participants.length),
  };
}

function formatParticipantNameList(participantNames: readonly string[]): string {
  const [initiatorName, ...otherNames] = participantNames;

  if (!initiatorName) {
    return '有人';
  }

  if (otherNames.length === 0) {
    return initiatorName;
  }

  return `${initiatorName} 和 ${otherNames.join('、')}`;
}

function createParticipantVariables(
  context: OfflineResolverContext,
): Record<string, string> {
  const targetCharacterId = context.input.nearbyCharacterIds?.[0];

  return {
    targetName: getContextName(context.contexts, targetCharacterId, '附近的人'),
  };
}

function getNearbyParticipantCandidates(
  context: OfflineResolverContext,
  activity: CharacterEventActivity,
): CharacterContext[] {
  const range = activity.group.inviteNearbyRange ?? 0;

  if (range <= 0 || context.character.presence.kind !== 'positioned') {
    return [];
  }

  return context.contexts.filter(candidate => (
    candidate.id !== context.character.id &&
    candidate.presence.kind === 'positioned' &&
    candidate.presence.spaceId === context.character.presence.spaceId &&
    getDistance(context.character.position, candidate.position) <= range
  ));
}

function canJoinOfflineActivity(
  candidate: CharacterContext,
  activity: CharacterEventActivity,
): boolean {
  if (candidate.currentActivity || candidate.pendingActivityJoin || candidate.currentMotivation === 'controllingByGod') {
    return false;
  }

  const joinRequirements = activity.joinRequirements;

  if (joinRequirements?.type === 'hasItem') {
    return itemService.getActorItems(candidate.id).some(item => (
      item.definitionId === joinRequirements.itemId &&
      (item.state === 'stored' || item.state === 'held')
    ));
  }

  return true;
}

function canAcceptOfflineActivity(
  candidate: CharacterContext,
  hostCharacterId: string,
  acceptance: CharacterEventAcceptance | undefined,
  random: () => number,
): boolean {
  if (!acceptance) {
    return true;
  }

  const meetsMinMood = acceptance.minMoodValue === undefined ||
    candidate.status.moodValue >= acceptance.minMoodValue;
  const meetsAllowedMood = !acceptance.allowedMoods?.length ||
    acceptance.allowedMoods.includes(candidate.status.mood);
  const meetsRelationship = !acceptance.relationships?.length ||
    acceptance.relationships.some(requirement => {
      const relationship = candidate.relationships.find(entry => entry.targetCharId === hostCharacterId);
      const intimacy = relationship?.intimacy ?? 0;
      const socialStatus = getMutualRelationshipStatus(candidate.id, hostCharacterId);

      if (requirement.minIntimacy !== undefined && intimacy < requirement.minIntimacy) {
        return false;
      }

      if (requirement.maxIntimacy !== undefined && intimacy > requirement.maxIntimacy) {
        return false;
      }

      const feeling = relationship?.feeling ?? Feeling.Neutral;

      if (requirement.allowedFeelings?.length && !requirement.allowedFeelings.includes(feeling)) {
        return false;
      }

      if (
        requirement.allowedSocialStatuses?.length &&
        !requirement.allowedSocialStatuses.includes(socialStatus)
      ) {
        return false;
      }

      return true;
    });

  if (meetsMinMood && meetsAllowedMood && meetsRelationship) {
    return true;
  }

  return random() <= (acceptance.fallbackChance ?? 0);
}

function createActivityStatusPatch(
  participant: CharacterContext,
  effects: CharacterEventActivityEffects | undefined,
): OfflineStatusPatchPreview | null {
  const nextStatus = applyCompletedActivityStatusEffects(participant.status, effects);

  return createStatusPatch({
    ...(nextStatus.moodValue !== participant.status.moodValue
      ? {
        moodValue: createNumericPatch(participant.status.moodValue, nextStatus.moodValue, 100),
      }
      : {}),
    ...(nextStatus.playNeed !== participant.status.playNeed
      ? {
        playNeed: createNumericPatch(
          participant.status.playNeed,
          nextStatus.playNeed,
          0,
        ),
      }
      : {}),
  });
}

function createActivityPositionPatch(
  participant: CharacterContext,
  activity: CharacterEventActivity,
) {
  const destination = resolveActivityDestination(activity);

  if (destination) {
    return createOfflineDestinationPositionPatch(
      `${activity.type}Destination`,
      destination,
    );
  }

  return createOfflineNearbyDriftPositionPatch(
    participant.position,
    `${activity.type}NearbyDrift`,
  );
}

function createActivityRelationshipPatches(
  effects: CharacterEventActivityEffects | undefined,
  partnerContexts: readonly CharacterContext[],
  timestamp: number,
): OfflineRelationshipPatchPreview[] {
  if (!effects?.relationshipIntimacyDelta && !effects?.relationshipFeelingTarget) {
    return [];
  }

  return partnerContexts.map(partner => ({
    targetCharacterId: partner.id,
    targetCharacterName: partner.name,
    intimacyDelta: effects.relationshipIntimacyDelta ?? 0,
    ...(effects.relationshipFeelingTarget ? { feelingTarget: effects.relationshipFeelingTarget } : {}),
    timestamp,
  }));
}

function getGroupMinParticipants(activity: CharacterEventActivity): number {
  return activity.group.minParticipants ?? 1;
}

function getGroupMaxParticipants(activity: CharacterEventActivity): number {
  const minParticipants = getGroupMinParticipants(activity);

  return Math.max(minParticipants, activity.group.maxParticipants ?? minParticipants);
}

function getMutualRelationshipStatus(characterId: string, targetCharacterId: string): SocialStatus {
  return relationshipStoreService.getSnapshot().mutualRelationships.find(relationship => (
    relationship.charIds.includes(characterId) &&
    relationship.charIds.includes(targetCharacterId)
  ))?.status ?? SocialStatus.Stranger;
}

function getDistance(left: Position, right: Position): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function resolveActivityDestination(
  activity: CharacterEventActivity,
) {
  if (activity.destination === 'randomDestination.play') {
    return getFirstDestinationTarget('play');
  }

  if (activity.destination) {
    return activity.destination;
  }

  return null;
}

function resolveLocationName(activity: CharacterEventActivity): string {
  if (activity.destination === 'randomDestination.play') {
    return '遊玩地點';
  }

  if (activity.destination) {
    return '指定地點';
  }

  return '附近';
}
