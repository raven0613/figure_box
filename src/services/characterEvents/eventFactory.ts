import { EventType, type CharacterEvent } from '~/stateMachines/gameFlow/events';
import {
  CHARACTER_EVENT_DEFINITIONS_BY_ID,
  type CharacterEventAction,
  type CharacterEventTarget,
} from '../../constants/charactarEventsDefinitions';
import type { CharacterBehaviorDefinition } from '~/constants/characterBehaviorDefinitions';
import type { JoinableActivity } from './joinableActivities';
import { getRandomDestinationTarget, getRandomMapTarget } from './targets';
import type { CharacterEventDecisionInput } from './types';
import type { CharacterContext } from '~/stateMachines/gameFlow/context';

const OBSERVABLE_OBJECT_TARGET_MAX_DISTANCE = 3;

export function createCharacterEventFromAction(
  action: CharacterEventAction,
  input: CharacterEventDecisionInput,
  sourceEventId: string,
  random: () => number = Math.random,
): CharacterEvent | null {
  switch (action.type) {
    case 'goIdle':
      return { type: EventType.GoIdle };
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

export function createCharacterBehaviorEvent(
  definition: CharacterBehaviorDefinition,
  context: CharacterContext,
  input: CharacterEventDecisionInput,
  random: () => number = Math.random,
): CharacterEvent | null {
  const target = resolveBehaviorTarget(definition, context, input, random);

  if (definition.target && !target) {
    return null;
  }

  return {
    type: EventType.StartBehavior,
    behaviorId: definition.id,
    target,
    timestamp: input.timestamp,
  };
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

function resolveBehaviorTarget(
  definition: CharacterBehaviorDefinition,
  context: CharacterContext,
  input: CharacterEventDecisionInput,
  random: () => number,
) {
  if (definition.target === 'randomMap') {
    return getRandomMapTarget(context.position, random);
  }

  if (definition.target === 'nearbyObservableObject') {
    return selectNearbyObservableObjectTarget(input, random);
  }

  return undefined;
}

function selectNearbyObservableObjectTarget(
  input: CharacterEventDecisionInput,
  random: () => number,
) {
  const candidates = (input.nearbyObservableObjects ?? [])
    .filter(object => object.distance <= OBSERVABLE_OBJECT_TARGET_MAX_DISTANCE);

  if (candidates.length === 0) {
    return undefined;
  }

  return candidates[Math.floor(random() * candidates.length)].position;
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
