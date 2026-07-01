import {
  CHARACTER_EVENT_DEFINITIONS,
  type CharacterEventDefinition,
} from '~/constants/charactarEventsDefinitions';

export const DEFAULT_NEARBY_CHARACTER_RANGE = 2;

export function getDefinitionNearbyCharacterRange(
  definition: CharacterEventDefinition,
): number {
  return getDefinitionInviteNearbyRange(definition) ?? DEFAULT_NEARBY_CHARACTER_RANGE;
}

export function getEventDecisionNearbyCharacterRange(): number {
  const inviteNearbyRanges = CHARACTER_EVENT_DEFINITIONS.flatMap(definition => (
    getDefinitionInviteNearbyRanges(definition)
  ));

  return inviteNearbyRanges.length > 0
    ? Math.max(...inviteNearbyRanges)
    : DEFAULT_NEARBY_CHARACTER_RANGE;
}

function getDefinitionInviteNearbyRange(
  definition: CharacterEventDefinition,
): number | null {
  const ranges = getDefinitionInviteNearbyRanges(definition);

  if (ranges.length === 0) {
    return null;
  }

  return Math.max(...ranges);
}

function getDefinitionInviteNearbyRanges(
  definition: CharacterEventDefinition,
): number[] {
  return definition.presentationVariants
    ?.map(variant => variant.activity?.group.inviteNearbyRange)
    .filter((range): range is number => range !== undefined) ?? [];
}
