import { EventType } from '~/stateMachines/gameFlow/events';
import { OFFLINE_SIMULATION_POLICY } from '../offlineSimulationPolicy';
import type { OfflineResolutionPreview } from '../types';
import {
  createOfflineContainedPositionPatch,
  createOfflineDestinationPositionPatch,
  createOfflineNearbyDriftPositionPatch,
  getFirstDestinationTarget,
} from '../offlinePositionResolver';
import {
  createNumericPatch,
  createStatusPatch,
  type OfflineResolverContext,
} from './offlineResolverUtils';

export function resolveOfflineActionPreview(
  context: OfflineResolverContext,
): OfflineResolutionPreview | null {
  switch (context.candidate.event.type) {
    case EventType.GoIdle:
      return {
        kind: 'solo',
        resolverSource: 'action.goIdle',
        statusPatch: null,
        positionPatch: createOfflineNearbyDriftPositionPatch(context.character.position, 'idleNearbyDrift'),
        currentMotivation: 'idle',
        variables: {
          activityType: 'idle',
          locationName: '附近',
        },
        notes: ['低風險閒置事件，只預覽小範圍位置漂移。'],
      };
    case EventType.GoEat:
      return {
        kind: 'solo',
        resolverSource: 'action.goEat',
        statusPatch: createStatusPatch({
          saturation: createNumericPatch(
            context.character.status.saturation,
            context.character.status.saturation + OFFLINE_SIMULATION_POLICY.resolutionEffects.goEatSaturationDelta,
            100,
          ),
        }),
        positionPatch: createOfflineDestinationPositionPatch(
          'findFoodDestination',
          context.candidate.event.target,
        ),
        currentMotivation: 'idle',
        variables: {
          activityType: 'eat',
          foodName: '餐點',
          locationName: '餐廳',
        },
        notes: ['沿用在線吃飯完成後的飽足尺度；食物與店家細節待內容資料補齊後再抽。'],
      };
    case EventType.GoRest:
      return {
        kind: 'solo',
        resolverSource: 'action.goRest',
        statusPatch: createStatusPatch({
          moodValue: createNumericPatch(
            context.character.status.moodValue,
            context.character.status.moodValue + OFFLINE_SIMULATION_POLICY.resolutionEffects.goRestMoodValueDelta,
            100,
          ),
        }),
        positionPatch: createOfflineContainedPositionPatch('restAtHome'),
        currentMotivation: 'idle',
        variables: {
          activityType: 'rest',
          locationName: '家裡',
        },
        notes: ['休息離線預覽只提高心情值，暫不改變其他需求。'],
      };
    case EventType.GoPlay:
      return {
        kind: 'solo',
        resolverSource: 'action.goPlay',
        statusPatch: createStatusPatch({
          moodValue: createNumericPatch(
            context.character.status.moodValue,
            context.character.status.moodValue + OFFLINE_SIMULATION_POLICY.resolutionEffects.goPlayMoodValueDelta,
            100,
          ),
          playNeed: createNumericPatch(
            context.character.status.playNeed,
            context.character.status.playNeed + OFFLINE_SIMULATION_POLICY.resolutionEffects.goPlayPlayNeedDelta,
            0,
          ),
        }),
        positionPatch: createOfflineDestinationPositionPatch(
          'playDestination',
          getFirstDestinationTarget('play'),
        ),
        currentMotivation: 'idle',
        variables: {
          activityType: 'play',
          itemName: '附近的東西',
          locationName: '遊玩地點',
        },
        notes: ['沿用在線單人玩完成後的 playNeed 與心情尺度；玩什麼待內容資料補齊後再抽。'],
      };
    case EventType.GoHome:
      return resolveGoHomePreview(context);
    default:
      return null;
  }
}

function resolveGoHomePreview(
  context: OfflineResolverContext,
): OfflineResolutionPreview {
  if (context.candidate.motivation === 'findFood') {
    return {
      kind: 'solo',
      resolverSource: 'action.goHome',
      statusPatch: createStatusPatch({
        saturation: createNumericPatch(
          context.character.status.saturation,
          context.character.status.saturation + OFFLINE_SIMULATION_POLICY.resolutionEffects.homeFoodSaturationDelta,
          100,
        ),
      }),
      positionPatch: createOfflineContainedPositionPatch('findFoodAtApartment'),
      currentMotivation: 'idle',
      variables: {
        activityType: 'eat',
        foodName: '家裡的食物',
        locationName: '家裡',
      },
      notes: ['預覽為回家找食物，使用保守飽足增量。'],
    };
  }

  if (context.candidate.motivation === 'play') {
    return {
      kind: 'solo',
      resolverSource: 'action.goHome',
      statusPatch: createStatusPatch({
        moodValue: createNumericPatch(
          context.character.status.moodValue,
          context.character.status.moodValue + OFFLINE_SIMULATION_POLICY.resolutionEffects.homePlayMoodValueDelta,
          100,
        ),
        playNeed: createNumericPatch(
          context.character.status.playNeed,
          context.character.status.playNeed + OFFLINE_SIMULATION_POLICY.resolutionEffects.homePlayPlayNeedDelta,
          0,
        ),
      }),
      positionPatch: createOfflineContainedPositionPatch('playAtApartment'),
      currentMotivation: 'idle',
      variables: {
        activityType: 'play',
        itemName: '家裡的東西',
        locationName: '家裡',
      },
      notes: ['回家玩耍使用保守效果；玩什麼待內容資料補齊後再抽。'],
    };
  }

  return {
    kind: 'solo',
    resolverSource: 'action.goHome',
    statusPatch: null,
    positionPatch: createOfflineContainedPositionPatch('goHome'),
    currentMotivation: 'idle',
    variables: {
      activityType: 'goHome',
      locationName: '家裡',
    },
    notes: ['回家事件沒有可推導需求效果，只更新 presence。'],
  };
}
