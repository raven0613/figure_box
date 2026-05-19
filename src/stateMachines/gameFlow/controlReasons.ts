export const CharacterControlReason = {
  Dialogue: 'dialogue',
  RequestFulfillment: 'characterRequestFulfillment',
  GodDropRelationshipMoment: 'godDropRelationshipMoment',
  SpaceTransition: 'spaceTransition',
} as const;

export type CharacterControlReason =
  typeof CharacterControlReason[keyof typeof CharacterControlReason];
