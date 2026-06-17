import type { Position } from '~/constants/character';
import { EventType, type CharacterEvent } from '~/stateMachines/gameFlow/events';
import type { CharacterSnapshot } from '~/services/townCharacterTypes';

interface TownCharacterResumeTargetServiceOptions {
  getCharacterSnapshot: (characterId: string) => CharacterSnapshot | null;
  sendToCharacter: (characterId: string, event: CharacterEvent) => boolean;
}

export class TownCharacterResumeTargetService {
  private readonly getCharacterSnapshot: (characterId: string) => CharacterSnapshot | null;
  private readonly sendToCharacter: (characterId: string, event: CharacterEvent) => boolean;

  constructor(options: TownCharacterResumeTargetServiceOptions) {
    this.getCharacterSnapshot = options.getCharacterSnapshot;
    this.sendToCharacter = options.sendToCharacter;
  }

  captureResumeTargets(participantIds: readonly string[]): Map<string, Position> {
    const resumeTargets = new Map<string, Position>();

    participantIds.forEach(participantId => {
      const context = this.getCharacterSnapshot(participantId)?.context;

      if (!context?.target || context.presence.kind !== 'positioned') {
        return;
      }

      resumeTargets.set(participantId, { ...context.target });
    });

    return resumeTargets;
  }

  resumeTargets(resumeTargets: ReadonlyMap<string, Position>): void {
    resumeTargets.forEach((target, characterId) => {
      const context = this.getCharacterSnapshot(characterId)?.context;

      if (!context || context.presence.kind !== 'positioned') {
        return;
      }

      this.sendToCharacter(characterId, {
        type: EventType.MoveTo,
        target,
      });
    });
  }
}
