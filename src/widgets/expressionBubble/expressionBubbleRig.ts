import {
  MINI_CANVAS_HEIGHT,
  MINI_CANVAS_WIDTH,
  MINI_CENTER_X,
} from '~/widgets/miniAvatar/miniAvatarRig';

export const EXPRESSION_BUBBLE_CANVAS_WIDTH = MINI_CANVAS_WIDTH;
export const EXPRESSION_BUBBLE_CANVAS_HEIGHT = MINI_CANVAS_HEIGHT;
export const EXPRESSION_BUBBLE_BASE_TINT_LUMINANCE = 128;

export const EXPRESSION_BUBBLE_ASSET_CENTER = {
  x: MINI_CENTER_X,
  y: 42,
} as const;

export const EXPRESSION_BUBBLE_MAP_SOURCE_CROP = {
  x: EXPRESSION_BUBBLE_ASSET_CENTER.x - 20,
  y: EXPRESSION_BUBBLE_ASSET_CENTER.y - 22,
  width: 40,
  height: 44,
} as const;

export const EXPRESSION_BUBBLE_Z_INDEX = {
  frameColor: 0,
  frameShadow: 1,
  frameLine: 2,
  faceColor: 10,
  faceLine: 11,
  expressionColor: 20,
  expressionLine: 21,
  effectColor: 30,
  effectLine: 31,
} as const;
