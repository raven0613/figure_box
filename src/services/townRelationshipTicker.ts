import { EventType } from '~/stateMachines/gameFlow/events';
import {
  recordPassByPair,
  type RelationshipStore,
} from '~/stateMachines/gameFlow/relationships';
import type { CharacterActor, SendCharacterEvent } from '~/services/townCharacterTypes';
import type { FabricTownMapWidget } from '~/widgets/fabricTownMapWidget';

interface TownRelationshipTickerOptions {
  widget: FabricTownMapWidget;
  sendToCharacter: SendCharacterEvent;
}

export class TownRelationshipTicker {
  private readonly widget: FabricTownMapWidget;
  private readonly sendToCharacter: SendCharacterEvent;

  constructor(options: TownRelationshipTickerOptions) {
    this.widget = options.widget;
    this.sendToCharacter = options.sendToCharacter;
  }
  // 擦肩而過 relationship 更新
  triggerPassByRelationships(
    characterActors: ReadonlyMap<string, CharacterActor>,
    relationshipStore: RelationshipStore,
    timestamp: number,
  ): RelationshipStore {
    let nextRelationshipStore = relationshipStore;
    const processedPairs = new Set<string>();

    characterActors.forEach((_actor, characterId) => {
      const tile = this.widget.getCharacterTile(characterId);

      if (!tile) {
        return;
      }

      const nearbyIds = this.widget.getOccupiedNeighborIds(tile.x, tile.y, 2, characterId);

      nearbyIds.forEach(targetCharId => {
        const pairKey = getPairKey(characterId, targetCharId);

        if (processedPairs.has(pairKey)) {
          return;
        }

        processedPairs.add(pairKey);

        this.sendToCharacter(characterId, { type: EventType.PassBy, targetCharId, timestamp });
        this.sendToCharacter(targetCharId, { type: EventType.PassBy, targetCharId: characterId, timestamp });

        nextRelationshipStore = recordPassByPair(
          nextRelationshipStore,
          characterId,
          targetCharId,
          timestamp,
        );
      });
    });

    return nextRelationshipStore;
  }
}

function getPairKey(characterId: string, targetCharId: string): string {
  return characterId < targetCharId
    ? `${characterId}::${targetCharId}`
    : `${targetCharId}::${characterId}`;
}

