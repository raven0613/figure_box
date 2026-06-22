import {
  MINI_CANVAS_HEIGHT,
  MINI_FEET_BASELINE_Y,
} from './miniAvatar/miniAvatarRig';

export function getTownMapCharacterVisualOffsetY(renderSize: number): number {
  return -getTownMapCharacterSourceOffsetY(MINI_FEET_BASELINE_Y, renderSize);
}

export function getTownMapCharacterSourceOffsetY(
  sourceY: number,
  renderSize: number,
): number {
  return (sourceY / MINI_CANVAS_HEIGHT - 0.5) * renderSize;
}

export function getTownMapCharacterSourceOffsetFromFeetY(
  sourceY: number,
  renderSize: number,
): number {
  return (sourceY - MINI_FEET_BASELINE_Y) / MINI_CANVAS_HEIGHT * renderSize;
}
