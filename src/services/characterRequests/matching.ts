import type {
  CharacterRequest,
  CharacterRequestItemMatchInput,
  CharacterRequestSocialMatchInput,
} from './types';
import { matchesItemDefinition } from '~/services/items/itemMatcher';

const ITEM_REQUEST_KINDS = ['food', 'item'] as const;
const SOCIAL_REQUEST_KINDS = ['meetCharacter', 'talkToCharacter'] as const;

export function matchesSocialRequest(
  request: CharacterRequest,
  input: CharacterRequestSocialMatchInput,
): boolean {
  if (!SOCIAL_REQUEST_KINDS.some(kind => kind === request.kind)) {
    return false;
  }

  const targetCharacterId = request.target?.targetCharacterId;

  if (!targetCharacterId) {
    return false;
  }

  return matchesUnorderedCharacterPair(
    request.characterId,
    targetCharacterId,
    input.actorId,
    input.targetCharacterId,
  );
}

export function matchesItemRequest(
  request: CharacterRequest,
  input: CharacterRequestItemMatchInput,
): boolean {
  if (!ITEM_REQUEST_KINDS.some(kind => kind === request.kind)) {
    return false;
  }

  const target = request.target;

  if (!target) {
    return false;
  }

  if (target.itemMatch && input.itemDefinition && matchesItemDefinition(input.itemDefinition, target.itemMatch)) {
    return true;
  }

  if (target.acceptedItemIds?.includes(input.itemId)) {
    return true;
  }

  if (
    input.itemType &&
    target.acceptedItemTypes?.includes(input.itemType)
  ) {
    return true;
  }

  if (
    input.itemCategory &&
    target.acceptedItemTypes?.includes(input.itemCategory)
  ) {
    return true;
  }

  if (input.itemTags?.some(tag => target.acceptedItemTags?.includes(tag))) {
    return true;
  }

  return false;
}

function matchesUnorderedCharacterPair(
  firstRequestCharacterId: string,
  secondRequestCharacterId: string,
  firstActualCharacterId: string,
  secondActualCharacterId: string,
): boolean {
  return (
    firstRequestCharacterId === firstActualCharacterId &&
    secondRequestCharacterId === secondActualCharacterId
  ) || (
    firstRequestCharacterId === secondActualCharacterId &&
    secondRequestCharacterId === firstActualCharacterId
  );
}
