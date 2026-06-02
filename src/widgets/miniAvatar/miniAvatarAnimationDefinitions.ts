import {
  createMiniBlinkClip,
  createMiniWaveClip,
} from './miniAvatarAnimation';
import type { MiniAnimation } from './miniAvatarTypes';

export const MINI_WAVE_BLINK_ANIMATION: MiniAnimation = {
  id: 'wave_blink',
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

export const MINI_AVATAR_ANIMATION_DEFINITIONS = [
  MINI_WAVE_BLINK_ANIMATION,
];
