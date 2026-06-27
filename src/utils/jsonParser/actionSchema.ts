import type {
  CharacterEventAction,
  CharacterEventActivityTarget,
  CharacterEventTarget,
} from '../../constants/charactarEventsDefinitions';
import {
  includesString,
  isRecord,
  readOptionalMotivation,
  readRequiredString,
  type CharacterEventDefinitionRecord,
} from './schemaReaders';

const VALID_CHARACTER_EVENT_TYPES = [
  'goIdle',
  'goHome',
  'goEat',
  'startActivity',
  'joinActivity',
] as const;

// characterEvent action/target parser
export function readCharacterEventAction(
  definition: CharacterEventDefinitionRecord,
  index: number,
): CharacterEventAction {
  const rawAction = definition.characterEvent;

  if (!isRecord(rawAction)) {
    throw new Error(`Character event definition at index ${index} must include object characterEvent.`);
  }

  const type = readRequiredString(rawAction, 'type', index);

  if (!includesString(VALID_CHARACTER_EVENT_TYPES, type)) {
    throw new Error(`Character event definition at index ${index} has invalid characterEvent.type "${type}".`);
  }

  if (type === 'goEat') {
    return {
      type,
      target: readCharacterEventTarget(rawAction, index),
    };
  }

  if (type === 'joinActivity') {
    return {
      type,
      target: readCharacterEventActivityTarget(rawAction, index),
      motivation: readOptionalMotivation(rawAction, 'motivation', index),
    };
  }

  return { type };
}

function readCharacterEventTarget(
  action: CharacterEventDefinitionRecord,
  index: number,
): CharacterEventTarget {
  const target = action.target;

  if (target === 'randomDestination.findFood') {
    return target;
  }

  if (
    isRecord(target)
    && typeof target.x === 'number'
    && Number.isFinite(target.x)
    && typeof target.y === 'number'
    && Number.isFinite(target.y)
  ) {
    return {
      x: target.x,
      y: target.y,
    };
  }

  throw new Error(`Character event definition at index ${index} has invalid characterEvent.target.`);
}

function readCharacterEventActivityTarget(
  action: CharacterEventDefinitionRecord,
  index: number,
): CharacterEventActivityTarget {
  const target = action.target;

  if (target === 'nearbyJoinableActivity') {
    return target;
  }

  throw new Error(`Character event definition at index ${index} has invalid characterEvent.target.`);
}
