import type { CharacterContext } from '~/stateMachines/gameFlow/context';
import { EventType } from '~/stateMachines/gameFlow/events';
import type { CharacterEventCandidate } from '~/services/characterEvents/types';
import {
  PLAY_NEED_REDUCTION_AFTER_PLAYING_TOGETHER,
  PLAY_NEED_REDUCTION_AFTER_SOLO_PLAY,
  SATURATION_GAIN_AFTER_EATING,
} from '~/services/characterEvents/utility';
import type {
  OfflineNumericPatchPreview,
  OfflineResolutionPreview,
  OfflineStatusPatchPreview,
} from './types';
import {
  createOfflineContainedPositionPatch,
  createOfflineDestinationPositionPatch,
  createOfflineNearbyDriftPositionPatch,
  getFirstDestinationTarget,
} from './offlinePositionResolver';

const OFFLINE_REST_MOOD_VALUE_DELTA = 10;
const OFFLINE_HOME_FOOD_SATURATION_DELTA = 35;
const OFFLINE_HOME_PLAY_MOOD_VALUE_DELTA = 10;

const SUPPORTED_SOLO_EVENT_IDS = new Set([
  'baseline.idle',
  'need.findFood',
  'need.findFoodAtApartment',
  'need.rest',
  'need.play',
  'need.playAtApartment',
]);

export function resolveOfflineSoloEventPreview(
  candidate: CharacterEventCandidate,
  context: CharacterContext,
): OfflineResolutionPreview | null {
  if (!SUPPORTED_SOLO_EVENT_IDS.has(candidate.id)) {
    return null;
  }

  switch (candidate.id) {
    case 'baseline.idle':
      return {
        kind: 'solo',
        statusPatch: null,
        positionPatch: createOfflineNearbyDriftPositionPatch(context.position, 'idleNearbyDrift'),
        currentMotivation: 'idle',
        notes: ['低風險閒置事件，只預覽小範圍位置漂移。'],
      };
    case 'need.findFood':
      return resolveFindFoodPreview(candidate, context);
    case 'need.findFoodAtApartment':
      return {
        kind: 'solo',
        statusPatch: createStatusPatch({
          saturation: createNumericPatch(context.status.saturation, context.status.saturation + OFFLINE_HOME_FOOD_SATURATION_DELTA, 100),
        }),
        positionPatch: createOfflineContainedPositionPatch('findFoodAtApartment'),
        currentMotivation: 'idle',
        notes: ['預覽為回家找食物，使用保守飽足增量。'],
      };
    case 'need.rest':
      return {
        kind: 'solo',
        statusPatch: createStatusPatch({
          moodValue: createNumericPatch(context.status.moodValue, context.status.moodValue + OFFLINE_REST_MOOD_VALUE_DELTA, 100),
        }),
        positionPatch: createOfflineContainedPositionPatch('restAtHome'),
        currentMotivation: 'idle',
        notes: ['休息離線預覽只提高心情值，暫不改變其他需求。'],
      };
    case 'need.play':
      return resolvePlayPreview(context, 'playDestination');
    case 'need.playAtApartment':
      return {
        kind: 'solo',
        statusPatch: createStatusPatch({
          moodValue: createNumericPatch(context.status.moodValue, context.status.moodValue + OFFLINE_HOME_PLAY_MOOD_VALUE_DELTA, 100),
          playNeed: createNumericPatch(context.status.playNeed, context.status.playNeed - PLAY_NEED_REDUCTION_AFTER_PLAYING_TOGETHER, 0),
        }),
        positionPatch: createOfflineContainedPositionPatch('playAtApartment'),
        currentMotivation: 'idle',
        notes: ['回家玩耍使用比外出單人玩更保守的效果。'],
      };
  }

  return null;
}

function resolveFindFoodPreview(
  candidate: CharacterEventCandidate,
  context: CharacterContext,
): OfflineResolutionPreview {
  const target = candidate.event.type === EventType.GoEat
    ? candidate.event.target
    : getFirstDestinationTarget('findFood');

  return {
    kind: 'solo',
    statusPatch: createStatusPatch({
      saturation: createNumericPatch(context.status.saturation, context.status.saturation + SATURATION_GAIN_AFTER_EATING, 100),
    }),
    positionPatch: createOfflineDestinationPositionPatch('findFoodDestination', target),
    currentMotivation: 'idle',
    notes: ['沿用在線吃飯完成後的飽足尺度，但不觸發移動或動畫。'],
  };
}

function resolvePlayPreview(
  context: CharacterContext,
  positionReason: string,
): OfflineResolutionPreview {
  return {
    kind: 'solo',
    statusPatch: createStatusPatch({
      moodValue: createNumericPatch(context.status.moodValue, context.status.moodValue + 18, 100),
      playNeed: createNumericPatch(context.status.playNeed, context.status.playNeed - PLAY_NEED_REDUCTION_AFTER_SOLO_PLAY, 0),
    }),
    positionPatch: createOfflineDestinationPositionPatch(positionReason, getFirstDestinationTarget('play')),
    currentMotivation: 'idle',
    notes: ['沿用在線單人玩完成後的 playNeed 與心情尺度。'],
  };
}

function createStatusPatch(
  patch: OfflineStatusPatchPreview,
): OfflineStatusPatchPreview | null {
  return Object.keys(patch).length > 0 ? patch : null;
}

function createNumericPatch(
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
