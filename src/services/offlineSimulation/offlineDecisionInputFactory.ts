import { Feeling, SocialStatus, type Position } from '~/constants/character';
import { TOWN_WORLD_SPACE_ID } from '~/constants/townMap';
import type { CharacterContext } from '~/stateMachines/gameFlow/context';
import {
  normalizeRelationshipPair,
} from '~/stateMachines/gameFlow/relationships';
import type {
  CharacterEventDecisionInput,
  CharacterEventNearbyRelationship,
  CharacterEventNearbyVisibleItem,
} from '~/services/characterEvents/types';
import { itemService } from '~/services/items/itemService';
import { relationshipStoreService } from '~/services/save/relationshipStoreService';

const NEARBY_CHARACTER_RANGE = 2;
const ITEM_VISIBILITY_RADIUS = 10;

export function createOfflineDecisionInput(
  context: CharacterContext,
  contexts: readonly CharacterContext[],
  timestamp: number,
  random?: () => number,
): CharacterEventDecisionInput {
  const nearbyCharacterIds = getNearbyCharacterIds(context, contexts);

  return {
    nearbyCharacterIds,
    nearbyRelationships: getNearbyRelationships(context, nearbyCharacterIds),
    nearbyVisibleItems: getNearbyVisibleItems(context),
    ownItemIds: itemService.getActorItems(context.id)
      .filter(item => item.state === 'stored' || item.state === 'held')
      .map(item => item.definitionId),
    nearbyJoinableActivities: [],
    timestamp,
    random,
  };
}

function getNearbyCharacterIds(
  context: CharacterContext,
  contexts: readonly CharacterContext[],
): string[] {
  if (context.presence.kind !== 'positioned') {
    return [];
  }

  return contexts
    .filter(candidate => (
      candidate.id !== context.id &&
      candidate.presence.kind === 'positioned' &&
      candidate.presence.spaceId === context.presence.spaceId &&
      getDistance(context.position, candidate.position) <= NEARBY_CHARACTER_RANGE
    ))
    .map(candidate => candidate.id);
}

function getNearbyRelationships(
  context: CharacterContext,
  nearbyCharacterIds: readonly string[],
): CharacterEventNearbyRelationship[] {
  return nearbyCharacterIds.map(characterId => {
    const relationship = context.relationships.find(candidate => candidate.targetCharId === characterId);
    const mutualRelationship = getMutualRelationshipStatus(context.id, characterId);

    return {
      characterId,
      feeling: relationship?.feeling ?? Feeling.Neutral,
      intimacy: relationship?.intimacy ?? 0,
      socialStatus: mutualRelationship,
    };
  });
}

function getMutualRelationshipStatus(characterId: string, targetCharacterId: string): SocialStatus {
  const relationshipPair = normalizeRelationshipPair(characterId, targetCharacterId);

  if (!relationshipPair) {
    return SocialStatus.Stranger;
  }

  return relationshipStoreService.getSnapshot().mutualRelationships.find(relationship => (
    relationship.charIds[0] === relationshipPair[0] &&
    relationship.charIds[1] === relationshipPair[1]
  ))?.status ?? SocialStatus.Stranger;
}

function getNearbyVisibleItems(context: CharacterContext): CharacterEventNearbyVisibleItem[] {
  if (context.presence.kind !== 'positioned' || context.presence.spaceId !== TOWN_WORLD_SPACE_ID) {
    return [];
  }

  return itemService.getPlacedObjects(TOWN_WORLD_SPACE_ID)
    .flatMap(placedObject => {
      if (!placedObject.worldPosition) {
        return [];
      }

      const itemInstance = itemService.getItemInstance(placedObject.itemInstanceId);
      const definition = itemInstance ? itemService.getDefinition(itemInstance.definitionId) : null;

      if (!itemInstance || !definition) {
        return [];
      }

      const distance = getDistance(context.position, placedObject.worldPosition);

      if (distance > ITEM_VISIBILITY_RADIUS) {
        return [];
      }

      return [{
        placedObjectId: placedObject.id,
        itemInstanceId: itemInstance.id,
        definitionId: definition.id,
        category: definition.category,
        tags: definition.tags,
        rarity: definition.rarity,
        position: {
          x: placedObject.worldPosition.x,
          y: placedObject.worldPosition.y,
        },
        distance,
      }];
    });
}

function getDistance(left: Position, right: Position): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}
