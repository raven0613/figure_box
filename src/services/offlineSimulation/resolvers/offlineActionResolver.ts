import { EventType } from '~/stateMachines/gameFlow/events';
import { OFFLINE_SIMULATION_POLICY } from '../offlineSimulationPolicy';
import type { OfflineResolutionPreview } from '../types';
import {
  createOfflineContainedPositionPatch,
  createOfflineDestinationPositionPatch,
  createOfflineNearbyDriftPositionPatch,
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
    case EventType.GoHome:
      return resolveGoHomePreview(context);
    case EventType.StartBehavior:
      return {
        kind: 'solo',
        resolverSource: `behavior.${context.candidate.event.behaviorId}`,
        statusPatch: null,
        positionPatch: context.candidate.event.target
          ? createOfflineDestinationPositionPatch(
            'behaviorDestination',
            context.candidate.event.target,
          )
          : createOfflineNearbyDriftPositionPatch(context.character.position, 'behaviorNearbyDrift'),
        currentMotivation: context.candidate.motivation,
        variables: {
          activityType: 'behavior',
          locationName: '附近',
        },
        notes: ['生活 behavior 離線預覽只處理位置變化，暫不套用活動效果。'],
      };
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
