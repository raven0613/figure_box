import type { CharacterEventActivity } from '~/constants/charactarEventsDefinitions';
import type { JoinableActivity } from '~/services/characterEvents/joinableActivities';
import type { CharacterSnapshot } from '~/services/townCharacterTypes';
import { sampleWithoutReplacement } from './townActivityRules';

export class TownActivityDialogueSubjects {
  private readonly dialogueSubjectIdsByActivityId = new Map<string, Readonly<Record<string, string>>>();
  private readonly selectedDialogueSubjectIdByActivityId = new Map<string, string>();
  private readonly getCharacterContext: (characterId: string) => CharacterSnapshot['context'] | null;

  constructor(options: {
    getCharacterContext: (characterId: string) => CharacterSnapshot['context'] | null;
  }) {
    this.getCharacterContext = options.getCharacterContext;
  }

  getSubjects(activityId: string): Readonly<Record<string, string>> | undefined {
    return this.dialogueSubjectIdsByActivityId.get(activityId);
  }

  getSelectedSubjectId(activityId: string): string | undefined {
    return this.selectedDialogueSubjectIdByActivityId.get(activityId);
  }

  selectSubject(activityId: string, subjectId: string): void {
    this.selectedDialogueSubjectIdByActivityId.set(activityId, subjectId);
  }

  prepareSubjects(
    activity: JoinableActivity,
    activityDefinition: CharacterEventActivity,
  ): Readonly<Record<string, string>> {
    const existingSubjects = this.dialogueSubjectIdsByActivityId.get(activity.id);

    if (existingSubjects) {
      return existingSubjects;
    }

    const selection = activityDefinition.dialogueSubjectSelection;
    const initiatorId = activity.hostCharacterIds[0] ?? activity.participantIds[0];
    const targetId = activity.participantIds.find(characterId => characterId !== initiatorId);

    if (!selection || !initiatorId || !targetId) {
      return {};
    }

    const subjects = this.selectSubjects(
      activity,
      initiatorId,
      targetId,
      selection,
    );

    if (Object.keys(subjects).length < selection.count) {
      return {};
    }

    this.dialogueSubjectIdsByActivityId.set(activity.id, subjects);
    const subjectIds = Object.values(subjects);
    const defaultSubjectId = subjectIds[Math.floor(Math.random() * subjectIds.length)];

    if (defaultSubjectId) {
      this.selectSubject(activity.id, defaultSubjectId);
    }

    return subjects;
  }

  clearActivity(activityId: string): void {
    this.dialogueSubjectIdsByActivityId.delete(activityId);
    this.selectedDialogueSubjectIdByActivityId.delete(activityId);
  }

  clear(): void {
    this.dialogueSubjectIdsByActivityId.clear();
    this.selectedDialogueSubjectIdByActivityId.clear();
  }

  private selectSubjects(
    activity: JoinableActivity,
    initiatorId: string,
    targetId: string,
    selection: NonNullable<CharacterEventActivity['dialogueSubjectSelection']>,
  ): Readonly<Record<string, string>> {
    const sourceId = selection.sourceRole === 'initiator'
      ? initiatorId
      : targetId;
    const sourceContext = this.getCharacterContext(sourceId);

    if (!sourceContext) {
      return {};
    }

    const excludedCharacterIds = selection.excludeParticipants
      ? new Set(activity.participantIds)
      : new Set<string>();
    const candidateIds = sourceContext.relationships
      .filter(relationship => (
        relationship.charId === sourceId
        && !excludedCharacterIds.has(relationship.targetCharId)
        && this.getCharacterContext(relationship.targetCharId) !== null
        && relationship.memories[selection.memoryType].counts >= selection.minCount
      ))
      .map(relationship => relationship.targetCharId);
    const selectedIds = sampleWithoutReplacement(candidateIds, selection.count);

    return Object.fromEntries(
      selectedIds.map((characterId, index) => [
        `subject${String.fromCharCode(65 + index)}`,
        characterId,
      ]),
    );
  }
}
