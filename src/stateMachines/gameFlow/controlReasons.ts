export const CharacterControlReason = {
  Dialogue: 'dialogue',
  RequestFulfillment: 'characterRequestFulfillment',
  GodDropRelationshipMoment: 'godDropRelationshipMoment',
} as const;

export type CharacterControlReason =
  typeof CharacterControlReason[keyof typeof CharacterControlReason];
