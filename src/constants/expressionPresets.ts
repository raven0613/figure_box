import { Expression } from './character';
import type { AvatarExpressionPresetCatalog } from '~/typing/characterAvatar';

export const AVATAR_EXPRESSION_PRESETS: AvatarExpressionPresetCatalog = {
  [Expression.Normal]: {
    expression: Expression.Normal,
    label: 'normal',
  },
  [Expression.Laugh]: {
    expression: Expression.Laugh,
    label: 'laugh',
    eyes: {
      offsetY: -2,
      scale: 0.86,
    },
    mouth: {
      offsetY: 4,
      rotate: 0,
      scale: 1.35,
    },
  },
  [Expression.Cry]: {
    expression: Expression.Cry,
    label: 'cry',
    eyes: {
      offsetY: 5,
      scale: 0.9,
    },
    mouth: {
      offsetY: 7,
      rotate: 180,
      scale: 0.9,
    },
  },
  [Expression.Mad]: {
    expression: Expression.Mad,
    label: 'mad',
    eyes: {
      offsetY: -5,
      rotate: -8,
      scale: 0.92,
    },
    mouth: {
      offsetY: 2,
      rotate: -5,
      scale: 1.05,
    },
  },
};
