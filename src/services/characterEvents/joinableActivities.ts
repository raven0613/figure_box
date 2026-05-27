import type { Position } from '~/constants/character';
import type {
  CharacterEventActivity,
  CharacterEventActivityType,
  CharacterEventJoinRequirement,
} from '../../constants/charactarEventsDefinitions';

export type JoinableActivityPhase = 'inviting' | 'forming' | 'traveling' | 'active';

export interface JoinableActivity {
  id: string;
  activityKey: string;
  type: CharacterEventActivityType;
  sourceEventId: string;
  hostCharacterIds: readonly string[];
  participantIds: readonly string[];
  joinRequirements: CharacterEventJoinRequirement;
  phase: JoinableActivityPhase;
  startedAt: number;
  endsAt: number;
  activeStartedAt?: number;
  location?: Position;
  pausedAt?: number;
  remainingMs?: number;
}

export interface JoinableActivityStore {
  activities: readonly JoinableActivity[];
}

export interface CreateJoinableActivityInput {
  id: string;
  sourceEventId: string;
  activity: CharacterEventActivity;
  hostCharacterIds: readonly string[];
  participantIds: readonly string[];
  timestamp: number;
  phase?: JoinableActivityPhase;
  location?: Position;
}

export interface FindNearbyJoinableActivitiesInput {
  position: Position;
  timestamp: number;
  phases?: readonly JoinableActivityPhase[];
}

const DETECT_RANGE = 10;
const TRAVELING_ACTIVITY_TIMEOUT_MS = 60000;

export interface JoinableActivityManager {
  getStore: () => JoinableActivityStore;
  getActivity: (activityId: string) => JoinableActivity | null;
  getActivities: (timestamp?: number) => readonly JoinableActivity[];
  createActivity: (input: CreateJoinableActivityInput) => JoinableActivity;
  joinActivity: (activityId: string, characterId: string, timestamp: number) => JoinableActivity | null;
  leaveActivity: (activityId: string, characterId: string) => JoinableActivity | null;
  refreshActivityDuration: (activityId: string, timestamp: number) => JoinableActivity | null;
  updateActivityPhase: (
    activityId: string,
    phase: JoinableActivityPhase,
    location?: Position,
  ) => JoinableActivity | null;
  pauseActivity: (activityId: string, timestamp: number) => JoinableActivity | null;
  resumeActivity: (activityId: string, timestamp: number) => JoinableActivity | null;
  findNearbyActivities: (input: FindNearbyJoinableActivitiesInput) => readonly JoinableActivity[];
  endActivity: (activityId: string) => JoinableActivity | null;
  pruneEndedActivities: (timestamp: number) => readonly JoinableActivity[];
  clear: () => void;
}

export function createJoinableActivity(input: CreateJoinableActivityInput): JoinableActivity {
  const phase = input.phase ?? 'active';
  const initialDurationMs = getActivityDurationForPhase(input.activity, phase);

  return {
    id: input.id,
    activityKey: input.activity.key,
    type: input.activity.type,
    sourceEventId: input.sourceEventId,
    hostCharacterIds: [...input.hostCharacterIds],
    participantIds: [...input.participantIds],
    joinRequirements: input.activity.joinRequirements ?? { type: 'none' },
    phase,
    startedAt: input.timestamp,
    endsAt: input.timestamp + initialDurationMs,
    activeStartedAt: phase === 'active' ? input.timestamp : undefined,
    location: input.location,
  };
}

export function refreshJoinableActivityOnJoin(
  activityState: JoinableActivity,
  activityDefinition: CharacterEventActivity,
  characterId: string,
  timestamp: number,
): JoinableActivity {
  const participantIds = activityState.participantIds.includes(characterId)
    ? activityState.participantIds
    : [...activityState.participantIds, characterId];

  return {
    ...activityState,
    participantIds,
    endsAt: shouldRefreshActivityDurationOnJoin(activityState, activityDefinition)
      ? timestamp + getActivityDurationForPhase(activityDefinition, activityState.phase)
      : activityState.endsAt,
  };
}

export function createJoinableActivityManager(): JoinableActivityManager {
  const activitiesById = new Map<string, JoinableActivity>();
  const activityDefinitionsById = new Map<string, CharacterEventActivity>();

  function getActivities(timestamp?: number): readonly JoinableActivity[] {
    return Array.from(activitiesById.values())
      .filter(activity => timestamp === undefined || isActivityActiveAt(activity, timestamp));
  }

  return {
    getStore: () => ({
      activities: getActivities(),
    }),
    getActivity: activityId => activitiesById.get(activityId) ?? null,
    getActivities,
    createActivity: input => {
      const activity = createJoinableActivity(input);

      activitiesById.set(activity.id, activity);
      activityDefinitionsById.set(activity.id, input.activity);

      return activity;
    },
    joinActivity: (activityId, characterId, timestamp) => {
      const activity = activitiesById.get(activityId);
      const activityDefinition = activityDefinitionsById.get(activityId);

      if (!activity || !activityDefinition || !isActivityActiveAt(activity, timestamp)) {
        return null;
      }

      const nextActivity = refreshJoinableActivityOnJoin(
        activity,
        activityDefinition,
        characterId,
        timestamp,
      );

      activitiesById.set(activityId, nextActivity);
      return nextActivity;
    },
    leaveActivity: (activityId, characterId) => {
      const activity = activitiesById.get(activityId);

      if (!activity || !activity.participantIds.includes(characterId)) {
        return activity ?? null;
      }

      const participantIds = activity.participantIds.filter(participantId => participantId !== characterId);

      if (participantIds.length === 0) {
        activitiesById.delete(activityId);
        activityDefinitionsById.delete(activityId);
        return null;
      }

      const nextActivity = {
        ...activity,
        hostCharacterIds: activity.hostCharacterIds.filter(hostId => hostId !== characterId),
        participantIds,
      };

      activitiesById.set(activityId, nextActivity);
      return nextActivity;
    },
    refreshActivityDuration: (activityId, timestamp) => {
      const activity = activitiesById.get(activityId);
      const activityDefinition = activityDefinitionsById.get(activityId);

      if (!activity || !activityDefinition) {
        return null;
      }

      const nextActivity = {
        ...activity,
        activeStartedAt: activity.phase === 'active' ? timestamp : activity.activeStartedAt,
        endsAt: timestamp + getActivityDurationForPhase(activityDefinition, activity.phase),
      };

      activitiesById.set(activityId, nextActivity);
      return nextActivity;
    },
    updateActivityPhase: (activityId, phase, location) => {
      const activity = activitiesById.get(activityId);

      if (!activity) {
        return null;
      }

      const nextActivity = {
        ...activity,
        phase,
        location: location ?? activity.location,
      };

      activitiesById.set(activityId, nextActivity);
      return nextActivity;
    },
    pauseActivity: (activityId, timestamp) => {
      const activity = activitiesById.get(activityId);

      if (!activity || activity.pausedAt !== undefined || activity.endsAt <= timestamp) {
        return activity ?? null;
      }

      const nextActivity = {
        ...activity,
        pausedAt: timestamp,
        remainingMs: Math.max(0, activity.endsAt - timestamp),
      };

      activitiesById.set(activityId, nextActivity);
      return nextActivity;
    },
    resumeActivity: (activityId, timestamp) => {
      const activity = activitiesById.get(activityId);

      if (!activity || activity.pausedAt === undefined) {
        return activity ?? null;
      }

      const remainingMs = activity.remainingMs ?? Math.max(0, activity.endsAt - activity.pausedAt);
      const nextActivity = {
        ...activity,
        endsAt: timestamp + remainingMs,
        pausedAt: undefined,
        remainingMs: undefined,
      };

      activitiesById.set(activityId, nextActivity);
      return nextActivity;
    },
    findNearbyActivities: input => getActivities(input.timestamp).filter(activity => (
      activity.pausedAt === undefined &&
      activity.location !== undefined &&
      isWithinRange(activity.location, input.position, DETECT_RANGE) &&
      (input.phases === undefined || input.phases.includes(activity.phase))
    )),
    endActivity: activityId => {
      const activity = activitiesById.get(activityId) ?? null;

      if (!activity) {
        return null;
      }

      activitiesById.delete(activityId);
      activityDefinitionsById.delete(activityId);
      return activity;
    },
    pruneEndedActivities: timestamp => {
      const endedActivities = Array.from(activitiesById.values())
        .filter(activity => activity.pausedAt === undefined && activity.endsAt <= timestamp);

      endedActivities.forEach(activity => {
        activitiesById.delete(activity.id);
        activityDefinitionsById.delete(activity.id);
      });

      return endedActivities;
    },
    clear: () => {
      activitiesById.clear();
      activityDefinitionsById.clear();
    },
  };
}

function isActivityActiveAt(activity: JoinableActivity, timestamp: number): boolean {
  return activity.pausedAt !== undefined || activity.endsAt > timestamp;
}

function getActivityDurationForPhase(
  activity: CharacterEventActivity,
  phase: JoinableActivityPhase,
): number {
  if (phase === 'inviting') {
    return activity.joinWindowMs ?? activity.durationMs;
  }

  if (phase === 'traveling') {
    return Math.max(activity.joinWindowMs ?? 0, TRAVELING_ACTIVITY_TIMEOUT_MS);
  }

  return activity.durationMs;
}

function shouldRefreshActivityDurationOnJoin(
  activity: JoinableActivity,
  activityDefinition: CharacterEventActivity,
): boolean {
  return activity.phase === 'active' && activityDefinition.refreshDurationOnJoin === true;
}

function isWithinRange(
  activityLocation: Position,
  characterPosition: Position,
  range: number,
): boolean {
  return Math.max(
    Math.abs(activityLocation.x - characterPosition.x),
    Math.abs(activityLocation.y - characterPosition.y),
  ) <= range;
}
