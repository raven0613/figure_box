import {
  createMiniBlinkClip,
  createMiniWalkFrontClip,
  createMiniWaveClip,
} from './miniAvatarAnimation';
import type { MiniAnimation } from './miniAvatarTypes';

export const MINI_WAVE_BLINK_ANIMATION: MiniAnimation = {
  id: 'wave_blink',
  label: '揮手眨眼',
  version: 1,
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
  version: 1,
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

export const MINI_AVATAR_ANIMATION_DEFINITIONS = [
  MINI_WAVE_BLINK_ANIMATION,
  MINI_WALK_FRONT_ANIMATION,
];
