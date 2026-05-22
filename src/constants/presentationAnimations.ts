export const CHARACTER_PERFORMANCE_ANIMATION_IDS = [
  'heldItemCelebrationAnim',
  'characterJumpAnim',
] as const;

export type CharacterPerformanceAnimationId = typeof CHARACTER_PERFORMANCE_ANIMATION_IDS[number];
