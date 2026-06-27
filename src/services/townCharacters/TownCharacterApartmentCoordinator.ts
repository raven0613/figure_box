import type { Position } from '~/constants/character';
import { TOWN_APARTMENT_ENTRANCE_TILES, TOWN_WORLD_SPACE_ID } from '~/constants/townMap';
import { calculateCharacterUtilityScores } from '~/services/characterEvents/utility';
import { getRandomDestinationTarget } from '~/services/characterEvents/targets';
import type { CharacterSnapshot } from '~/services/townCharacterTypes';
import { EventType, type CharacterEvent } from '~/stateMachines/gameFlow/events';
import type { FabricTownMapWidget } from '~/widgets/fabricTownMapWidget';

const APARTMENT_EXIT_FOOD_SCORE_THRESHOLD = 65;

interface TownCharacterApartmentCoordinatorOptions {
  widget: FabricTownMapWidget;
  getCharacterSnapshot: (characterId: string) => CharacterSnapshot | null;
  sendToCharacter: (characterId: string, event: CharacterEvent) => boolean;
}

export class TownCharacterApartmentCoordinator {
  private readonly widget: FabricTownMapWidget;
  private readonly getCharacterSnapshot: (characterId: string) => CharacterSnapshot | null;
  private readonly sendToCharacter: (characterId: string, event: CharacterEvent) => boolean;

  constructor(options: TownCharacterApartmentCoordinatorOptions) {
    this.widget = options.widget;
    this.getCharacterSnapshot = options.getCharacterSnapshot;
    this.sendToCharacter = options.sendToCharacter;
  }

  leaveApartment(characterId: string): boolean {
    return this.leaveApartmentWithFollowUp(characterId);
  }

  maybeLeaveApartment(characterId: string): boolean {
    const snapshot = this.getCharacterSnapshot(characterId);

    if (!snapshot || snapshot.context.presence.kind !== 'contained') {
      return false;
    }

    const utilityScores = calculateCharacterUtilityScores(snapshot.context);
    const isHungry = (
      snapshot.context.status.saturation <= snapshot.context.status.hungerThreshold ||
      utilityScores.findFood >= APARTMENT_EXIT_FOOD_SCORE_THRESHOLD
    );

    const followUpEvent: CharacterEvent | undefined = isHungry
      ? {
          type: EventType.GoEat,
          target: getRandomDestinationTarget('findFood') ?? { x: 1, y: 20 },
        }
      : undefined;

    return this.leaveApartmentWithFollowUp(characterId, followUpEvent);
  }

  private leaveApartmentWithFollowUp(characterId: string, followUpEvent?: CharacterEvent): boolean {
    const snapshot = this.getCharacterSnapshot(characterId);

    if (!snapshot || snapshot.context.presence.kind !== 'contained') {
      return false;
    }

    const entrancePosition = this.getAvailableApartmentEntrancePosition();

    if (!entrancePosition) {
      return false;
    }

    const didLeave = this.sendToCharacter(characterId, {
      type: EventType.LeaveApartment,
      worldSpaceId: TOWN_WORLD_SPACE_ID,
      position: entrancePosition,
    });

    if (!didLeave) {
      return false;
    }

    if (followUpEvent) {
      this.sendToCharacter(characterId, followUpEvent);
    }

    return true;
  }

  private getAvailableApartmentEntrancePosition(): Position | null {
    const candidates = TOWN_APARTMENT_ENTRANCE_TILES.filter(tile => {
      const cell = this.widget.getCell(tile.x, tile.y);
      return cell?.walkable;
    });

    if (candidates.length === 0) {
      return null;
    }

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    return { x: chosen.x, y: chosen.y };
  }
}
