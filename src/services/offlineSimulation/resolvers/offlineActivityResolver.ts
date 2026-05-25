import type { CharacterEventActivity } from '~/constants/charactarEventsDefinitions';
import { itemService } from '~/services/items/itemService';
import {
  PLAY_NEED_REDUCTION_AFTER_PLAYING_TOGETHER,
} from '~/services/characterEvents/utility';
import { EventType } from '~/stateMachines/gameFlow/events';
import type { OfflineResolutionPreview } from '../types';
import {
  createOfflineDestinationPositionPatch,
  createOfflineNearbyDriftPositionPatch,
  getFirstDestinationTarget,
} from '../offlinePositionResolver';
import {
  createNumericPatch,
  createStatusPatch,
  getContextName,
  resolveOfflineActivity,
  type OfflineResolverContext,
} from './offlineResolverUtils';

const OFFLINE_ACTIVITY_MOOD_VALUE_DELTA = 10;

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
      reason: 'missingActivityMetadata',
      variables: createParticipantVariables(context),
    };
  }

  switch (resolvedActivity.activity.type) {
    case 'playWithItem':
      return resolvePlayWithItemActivity(context, resolvedActivity.activity);
    case 'playAtLocation':
      return resolvePlayAtLocationActivity(context, resolvedActivity.activity);
    case 'chat':
      return resolveChatActivity(context, resolvedActivity.activity);
    default:
      return {
        kind: 'unsupported',
        resolverSource: `activity.${resolvedActivity.activity.type}`,
        reason: 'unsupportedActivityType',
        variables: createActivityVariables(context, resolvedActivity.activity),
      };
  }
}

function resolvePlayWithItemActivity(
  context: OfflineResolverContext,
  activity: CharacterEventActivity,
): OfflineResolutionPreview {
  const variables = createActivityVariables(context, activity);

  return {
    kind: 'solo',
    resolverSource: 'activity.playWithItem',
    statusPatch: createStatusPatch({
      moodValue: createNumericPatch(
        context.character.status.moodValue,
        context.character.status.moodValue + OFFLINE_ACTIVITY_MOOD_VALUE_DELTA,
        100,
      ),
      playNeed: createNumericPatch(
        context.character.status.playNeed,
        context.character.status.playNeed - PLAY_NEED_REDUCTION_AFTER_PLAYING_TOGETHER,
        0,
      ),
    }),
    positionPatch: createOfflineNearbyDriftPositionPatch(
      context.character.position,
      'playWithItemNearbyDrift',
    ),
    currentMotivation: 'idle',
    variables,
    notes: [
      '使用 activity.type=playWithItem 的通用離線解析。',
      '目前不改道具庫存，只使用 activity metadata 推導文字與角色需求效果。',
    ],
  };
}

function resolvePlayAtLocationActivity(
  context: OfflineResolverContext,
  activity: CharacterEventActivity,
): OfflineResolutionPreview {
  if (activity.invite || activity.group) {
    return {
      kind: 'unsupported',
      resolverSource: 'activity.playAtLocation',
      reason: 'missingParticipantRoll',
      variables: createActivityVariables(context, activity),
    };
  }

  return {
    kind: 'solo',
    resolverSource: 'activity.playAtLocation',
    statusPatch: createStatusPatch({
      moodValue: createNumericPatch(
        context.character.status.moodValue,
        context.character.status.moodValue + OFFLINE_ACTIVITY_MOOD_VALUE_DELTA,
        100,
      ),
      playNeed: createNumericPatch(
        context.character.status.playNeed,
        context.character.status.playNeed - PLAY_NEED_REDUCTION_AFTER_PLAYING_TOGETHER,
        0,
      ),
    }),
    positionPatch: createOfflineDestinationPositionPatch(
      'playAtLocationDestination',
      resolveActivityDestination(activity),
    ),
    currentMotivation: 'idle',
    variables: createActivityVariables(context, activity),
    notes: ['使用 activity.type=playAtLocation 的通用離線解析。'],
  };
}

function resolveChatActivity(
  context: OfflineResolverContext,
  activity: CharacterEventActivity,
): OfflineResolutionPreview {
  return {
    kind: 'unsupported',
    resolverSource: 'activity.chat',
    reason: 'missingRelationshipPatch',
    variables: createActivityVariables(context, activity),
  };
}

function createActivityVariables(
  context: OfflineResolverContext,
  activity: CharacterEventActivity,
): Record<string, string> {
  const itemId = activity.joinRequirements?.type === 'hasItem'
    ? activity.joinRequirements.itemId
    : context.input.ownItemIds?.[0] ?? context.input.nearbyVisibleItems?.[0]?.definitionId;
  const itemDefinition = itemId ? itemService.getDefinition(itemId) : null;

  return {
    ...createParticipantVariables(context),
    activityType: activity.type,
    itemName: itemDefinition?.nameKey ?? itemId ?? '附近的東西',
    locationName: resolveLocationName(activity),
  };
}

function createParticipantVariables(
  context: OfflineResolverContext,
): Record<string, string> {
  const targetCharacterId = context.input.nearbyCharacterIds?.[0];

  return {
    targetName: getContextName(context.contexts, targetCharacterId, '附近的人'),
  };
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
