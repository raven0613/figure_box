import { AVATAR_RIG_COLORS } from '../../constants/avatarRig';
import type { AccessoryLayerSlot } from '../avatarCanvas';
import type { MiniFrontIdleRigLayout } from './miniAvatarTypes';

export const MINI_CANVAS_WIDTH = 172;
export const MINI_CANVAS_HEIGHT = 172;
export const MINI_PIXEL_SCALE = 2;
export const MINI_CENTER_X = MINI_CANVAS_WIDTH / 2;
export const MINI_BASE_TINT_LUMINANCE = 128;
export const MINI_ACCESSORY_ORDER_STEP = 0.01;
export const MINI_CLOTHING_BODY_Z_INDEX = 2.3;
export const MINI_CLOTHING_LAYER_Z_STEP = 0.05;
export const MINI_CLOTHING_LINE_Z_OFFSET = 0.01;

export const MINI_ACCESSORY_SLOT_Z_INDEX: Record<AccessoryLayerSlot, number> = {
  behindBody: -1,
  onSkin: 2.25,
  frontBody: 2.5,
  frontFace: 29,
  frontBangs: 32,
};

export const MINI_FRONT_IDLE_RIG_LAYOUT: MiniFrontIdleRigLayout = {
  bodyTypeId: 1,
  baselineBodyTypeId: 1,
  headCenter: { x: 0, y: 58 },
  bodyCenter: { x: 0, y: 108 },
  earDistance: 39,
  ear: { x: -6.5, y: 6 },
  mouth: { x: 0, y: 9 },
  bodyByType: {
    1: {
      body: { x: 0, y: -8 },
      bottomAnchor: { x: 0, y: -2.5 },
      armIdleDistance: 4,
      armIdleOffset: { x: 0, y: -12 },
      legDistance: 5,
      legOffset: { x: 0, y: -2.5 },
    },
    2: {
      body: { x: 0, y: -7.5 },
      bottomAnchor: { x: 0, y: -0.5 },
      armIdleDistance: 4,
      armIdleOffset: { x: 1, y: -10 },
      legDistance: 5,
      legOffset: { x: 0, y: 0.5 },
    },
    3: {
      body: { x: 0, y: -7 },
      bottomAnchor: { x: 0, y: 0.5 },
      armIdleDistance: 4,
      armIdleOffset: { x: 1, y: -10 },
      legDistance: 5,
      legOffset: { x: 0, y: 3 },
    },
    4: {
      body: { x: 0, y: -6.5 },
      bottomAnchor: { x: 0, y: 1.5 },
      armIdleDistance: 4,
      armIdleOffset: { x: 2, y: -8 },
      legDistance: 5,
      legOffset: { x: 0, y: 4.5 },
    },
    5: {
      body: { x: 0, y: -6 },
      bottomAnchor: { x: 0, y: 2.5 },
      armIdleDistance: 4,
      armIdleOffset: { x: 2, y: -8 },
      legDistance: 5,
      legOffset: { x: 0, y: 6.5 },
    },
  },
  eyes: {
    eyeDistance: 11,
    sclera: { x: 0, y: 5 },
    lowerEyelid: { x: 0, y: 5 },
    eyeBall: { x: -1, y: 4.5 },
    eyeLight: { x: -0.5, y: -1 },
    upperEyeLid: { x: 0, y: 1.5 },
    eyebrow: { x: -0.5, y: 1 },
  },
  hair: {
    backHairTop: { x: 0, y: -6 },
    backHairBottom: { x: 0, y: 8.5 },
    bangs: { x: 0, y: -3.5 },
    hairLight: { x: 0, y: -10 },
    backHairBottomByOption: {
      1: { x: 0, y: 0 },
      2: { x: 0, y: 0 },
      3: { x: 0, y: 0 },
    },
    backHairTopByOption: {
      1: { x: 0, y: 0 },
      2: { x: 0, y: -1 },
      3: { x: 0.5, y: -2 },
    },
    bangsByOption: {
      1: { x: 0, y: 0 },
      2: { x: 0, y: -1.5 },
      3: { x: 0, y: -1 },
    },
  },
  clothing: {
    topBody: { x: 0, y: 0 },
    topArm: { x: 0, y: 0 },
    bottom: { x: 0, y: 0 },
  },
  accessories: {
    center: { x: 0, y: 0 },
    mirrored: { x: 0, y: 5.5 },
    mirroredDistance: 23,
  },
  colors: AVATAR_RIG_COLORS,
};

export const MINI_DEFAULT_EYE_LIGHT_DISTANCE =
  MINI_FRONT_IDLE_RIG_LAYOUT.eyes.eyeDistance
  + MINI_FRONT_IDLE_RIG_LAYOUT.eyes.eyeBall.x * MINI_PIXEL_SCALE
  + MINI_FRONT_IDLE_RIG_LAYOUT.eyes.eyeLight.x * MINI_PIXEL_SCALE;
