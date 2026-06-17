import type {
  JoinableActivity,
  JoinableActivityManager,
} from '~/services/characterEvents/joinableActivities';
import type { CharacterSnapshot } from '~/services/townCharacterTypes';

interface TownCharacterActivityLookupOptions {
  activityManager: JoinableActivityManager;
  getCharacterSnapshot: (characterId: string) => CharacterSnapshot | null;
  getCharacterSnapshotsById: () => Record<string, CharacterSnapshot>;
}

export class TownCharacterActivityLookup {
  private readonly activityManager: JoinableActivityManager;
  private readonly getCharacterSnapshot: (characterId: string) => CharacterSnapshot | null;
  private readonly getCharacterSnapshotsById: () => Record<string, CharacterSnapshot>;

  constructor(options: TownCharacterActivityLookupOptions) {
    this.activityManager = options.activityManager;
    this.getCharacterSnapshot = options.getCharacterSnapshot;
    this.getCharacterSnapshotsById = options.getCharacterSnapshotsById;
  }

  getActivityByParticipant(characterId: string): JoinableActivity | null {
    return this.activityManager.getActivities()
      .find(activity => activity.participantIds.includes(characterId)) ?? null;
  }

  getRelationshipMomentActivityByParticipant(characterId: string): JoinableActivity | null {
    const activityByParticipant = this.getActivityByParticipant(characterId);

    if (activityByParticipant) {
      return activityByParticipant;
    }

    const characterActivityId = this.getCharacterActivityId(characterId);

    if (!characterActivityId) {
      return null;
    }

    return this.activityManager.getActivity(characterActivityId);
  }

  getActivityParticipantIds(activityId: string): string[] {
    const participantIds = new Set(this.activityManager.getActivity(activityId)?.participantIds ?? []);

    Object.entries(this.getCharacterSnapshotsById()).forEach(([characterId, snapshot]) => {
      if (this.getSnapshotActivityId(snapshot) === activityId) {
        participantIds.add(characterId);
      }
    });

    return Array.from(participantIds);
  }

  getCharacterActivityId(characterId: string): string | null {
    const snapshot = this.getCharacterSnapshot(characterId);

    if (!snapshot) {
      return null;
    }

    return this.getSnapshotActivityId(snapshot);
  }

  private getSnapshotActivityId(snapshot: CharacterSnapshot): string | null {
    return snapshot.context.currentActivity?.activityId
      ?? snapshot.context.pendingActivityJoin?.activityId
      ?? null;
  }
}
