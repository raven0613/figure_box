import { CHARACTER_SEEDS, SocialStatus } from '~/constants/character';
import type { CharacterEventNearbyRelationship } from '~/services/characterEvents/types';
import type { CharacterRequestCharacterTarget } from '~/services/characterRequests/types';
import { TownRelationshipTicker } from '~/services/townRelationshipTicker';
import type {
  CharacterActor,
  CharacterSnapshot,
  CharacterSeed,
  SendCharacterEvent,
} from '~/services/townCharacterTypes';
import {
  createRelationshipStore,
  getFeelingForIntimacy,
  normalizeRelationshipPair,
  updateMutualRelationshipStatus,
  type RelationshipStore,
} from '~/stateMachines/gameFlow/relationships';
import type { FabricTownMapWidget } from '~/widgets/fabricTownMapWidget';

interface TownRelationshipCoordinatorOptions {
  widget: FabricTownMapWidget;
  getCharacterSnapshot: (characterId: string) => CharacterSnapshot | null;
  sendToCharacter: SendCharacterEvent;
  characterSeeds?: readonly CharacterSeed[];
  onRelationshipStoreChange?: (relationshipStore: RelationshipStore) => void;
}

export class TownRelationshipCoordinator {
  private readonly relationshipTicker: TownRelationshipTicker;
  private readonly getCharacterSnapshot: (characterId: string) => CharacterSnapshot | null;
  private readonly characterSeeds: readonly CharacterSeed[];
  private readonly onRelationshipStoreChange?: (relationshipStore: RelationshipStore) => void;
  private relationshipStore = createRelationshipStore();

  constructor(options: TownRelationshipCoordinatorOptions) {
    this.relationshipTicker = new TownRelationshipTicker({
      widget: options.widget,
      sendToCharacter: options.sendToCharacter,
    });
    this.getCharacterSnapshot = options.getCharacterSnapshot;
    this.characterSeeds = options.characterSeeds ?? CHARACTER_SEEDS;
    this.onRelationshipStoreChange = options.onRelationshipStoreChange;
  }

  tickPassByRelationships(
    characterActors: ReadonlyMap<string, CharacterActor>,
    timestamp: number,
  ): void {
    this.relationshipStore = this.relationshipTicker.triggerPassByRelationships(
      characterActors,
      this.relationshipStore,
      timestamp,
    );
    this.notifyRelationshipStoreChanged();
  }

  promoteStrangerRelationship(
    actorId: string,
    targetCharacterId: string,
    timestamp: number,
  ): void {
    this.relationshipStore = updateMutualRelationshipStatus(
      this.relationshipStore,
      actorId,
      targetCharacterId,
      SocialStatus.Acquaintance,
      timestamp,
    );
    this.notifyRelationshipStoreChanged();
  }

  getNearbyRelationshipSnapshots(
    characterId: string,
    nearbyCharacterIds: readonly string[],
  ): CharacterEventNearbyRelationship[] {
    const relationships = this.getCharacterSnapshot(characterId)?.context.relationships ?? [];

    return nearbyCharacterIds.map(targetCharacterId => {
      const relationship = relationships.find(entry => entry.targetCharId === targetCharacterId);
      const intimacy = relationship?.intimacy ?? 0;

      return {
        characterId: targetCharacterId,
        intimacy,
        feeling: relationship?.feeling ?? getFeelingForIntimacy(intimacy),
        socialStatus: this.getMutualRelationshipStatus(characterId, targetCharacterId),
      };
    });
  }

  getCharacterRequestRelationshipTargets(characterId: string): CharacterRequestCharacterTarget[] {
    return this.characterSeeds
      .filter(character => character.id !== characterId)
      .map(character => ({
        characterId: character.id,
        characterName: character.name,
        socialStatus: this.getMutualRelationshipStatus(characterId, character.id),
      }));
  }

  getMutualRelationshipStatus(characterId: string, targetCharacterId: string): SocialStatus {
    const pair = normalizeRelationshipPair(characterId, targetCharacterId);

    if (!pair) {
      return SocialStatus.Stranger;
    }

    return this.relationshipStore.mutualRelationships.find(relationship => (
      relationship.charIds[0] === pair[0] && relationship.charIds[1] === pair[1]
    ))?.status ?? SocialStatus.Stranger;
  }

  reset(): void {
    this.relationshipStore = createRelationshipStore();
    this.notifyRelationshipStoreChanged();
  }

  private notifyRelationshipStoreChanged(): void {
    this.onRelationshipStoreChange?.(this.relationshipStore);
  }
}
