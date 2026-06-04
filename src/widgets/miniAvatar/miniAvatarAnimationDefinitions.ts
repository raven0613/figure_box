import {
  createMiniBlinkClip,
  createMiniWalkFrontClip,
  createMiniWalkSideClip,
  createMiniWaveClip,
} from './miniAvatarAnimation';
import type { MiniAnimation } from './miniAvatarTypes';

export const MINI_WAVE_BLINK_ANIMATION: MiniAnimation = {
  id: 'wave_blink',
  label: '揮手眨眼',
  version: 2,
  direction: 'front',
  durationMs: 1200,
  fps: 12,
  columns: 4,
  isLooping: true,
  clips: [
    createMiniWaveClip(),
    createMiniBlinkClip(),
  ],
};

export const MINI_WALK_FRONT_ANIMATION: MiniAnimation = {
  id: 'walk_front',
  label: '正面走路',
  version: 5,
  direction: 'front',
  durationMs: 2800,
  fps: 12,
  columns: 6,
  isLooping: true,
  clips: [
    createMiniWalkFrontClip(),
    createMiniBlinkClip({
      intervalMs: 2800,
      startOffsetMs: 1300,
    }),
  ],
};

export const MINI_WALK_SIDE_ANIMATION: MiniAnimation = {
  id: 'walk_side',
  label: '側面走路',
  version: 6,
  direction: 'side',
  durationMs: 2800,
  fps: 12,
  columns: 6,
  isLooping: true,
  clips: [
    createMiniWalkSideClip(),
    createMiniBlinkClip({
      intervalMs: 2800,
      startOffsetMs: 1300,
    }),
  ],
};

export const MINI_AVATAR_ANIMATION_DEFINITIONS = [
  MINI_WAVE_BLINK_ANIMATION,
  MINI_WALK_FRONT_ANIMATION,
  MINI_WALK_SIDE_ANIMATION,
];
