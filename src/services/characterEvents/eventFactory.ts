import { EventType, type CharacterEvent } from '~/stateMachines/gameFlow/events';
import {
  CHARACTER_EVENT_DEFINITIONS_BY_ID,
  type CharacterEventAction,
  type CharacterEventTarget,
} from '../../constants/charactarEventsDefinitions';
import type { JoinableActivity } from './joinableActivities';
import { getRandomDestinationTarget } from './targets';
import type { CharacterEventDecisionInput } from './types';

export function createCharacterEventFromAction(
  action: CharacterEventAction,
  input: CharacterEventDecisionInput,
  sourceEventId: string,
  random: () => number = Math.random,
): CharacterEvent | null {
  switch (action.type) {
    case 'goIdle':
      return { type: EventType.GoIdle };
    case 'goRest':
      return { type: EventType.GoRest };
    case 'goPlay':
      return { type: EventType.GoPlay };
    case 'goHome':
      return { type: EventType.GoHome };
    case 'goEat':
      return {
        type: EventType.GoEat,
        target: resolveCharacterEventTarget(action.target),
      };
    case 'startActivity':
      return {
        type: EventType.StartActivity,
        activityId: createActivityId(random),
        sourceEventId,
      };
    case 'joinActivity': {
      const activities = filterJoinableActivitiesByMotivation(
        input.nearbyJoinableActivities ?? [],
        action.motivation,
      );
      const activity = selectRandomNearbyJoinableActivity(activities, random);

      if (!activity) {
        return null;
      }

      return {
        type: EventType.JoinActivity,
        activityId: activity.id,
        sourceEventId,
      };
    }
  }
}

function filterJoinableActivitiesByMotivation(
  activities: readonly JoinableActivity[],
  motivation: Extract<CharacterEventAction, { type: 'joinActivity' }>['motivation'],
): readonly JoinableActivity[] {
  if (!motivation) {
    return activities;
  }

  return activities.filter(activity => (
    CHARACTER_EVENT_DEFINITIONS_BY_ID[activity.sourceEventId]?.motivation === motivation
  ));
}

function resolveCharacterEventTarget(target: CharacterEventTarget) {
  if (target === 'randomDestination.findFood') {
    return getRandomDestinationTarget('findFood') ?? { x: 1, y: 20 };
  }

  return target;
}

function createActivityId(random: () => number): string {
  return `activity-${Date.now()}-${Math.floor(random() * 1_000_000)}`;
}

function selectRandomNearbyJoinableActivity<T>(
  activities: readonly T[],
  random: () => number,
): T | null {
  if (activities.length === 0) {
    return null;
  }

  return activities[Math.floor(random() * activities.length)];
}
