import type { AVATAR_RIG_COLORS } from '../../constants/avatarRig';

export interface MiniSpriteSheet {
  dataUrl: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  rows: number;
  frameCount: number;
}

export interface MiniLayer {
  folder: string;
  file: string;
  color?: string;
  x: number;
  y: number;
  zIndex: number;
  angle?: number;
  scale?: number;
  flipX?: boolean;
}

export interface MiniPoint {
  x: number;
  y: number;
}

export type MiniOptionOffsetMap = Record<number, MiniPoint | undefined>;

export interface MiniBodyRigLayout {
  body: MiniPoint;
  bottomAnchor: MiniPoint;
  armIdleDistance: number;
  armIdleOffset: MiniPoint;
  legDistance: number;
  legOffset: MiniPoint;
}

export interface MiniEyeRigLayout {
  eyeDistance: number;
  sclera: MiniPoint;
  lowerEyelid: MiniPoint;
  eyeBall: MiniPoint;
  eyeLight: MiniPoint;
  upperEyeLid: MiniPoint;
  eyebrow: MiniPoint;
}

export interface MiniHairRigLayout {
  backHairBottom: MiniPoint;
  backHairTop: MiniPoint;
  bangs: MiniPoint;
  hairLight: MiniPoint;
  backHairBottomByOption: MiniOptionOffsetMap;
  backHairTopByOption: MiniOptionOffsetMap;
  bangsByOption: MiniOptionOffsetMap;
}

export interface MiniClothingRigLayout {
  topBody: MiniPoint;
  topArm: MiniPoint;
  bottom: MiniPoint;
}

export interface MiniAccessoryRigLayout {
  center: MiniPoint;
  mirrored: MiniPoint;
  mirroredDistance: number;
}

export type MiniColorRigLayout = typeof AVATAR_RIG_COLORS;

export interface MiniFrontIdleRigLayout {
  bodyTypeId: number;
  baselineBodyTypeId: number;
  headCenter: MiniPoint;
  bodyCenter: MiniPoint;
  earDistance: number;
  ear: MiniPoint;
  mouth: MiniPoint;
  bodyByType: Record<number, MiniBodyRigLayout>;
  eyes: MiniEyeRigLayout;
  hair: MiniHairRigLayout;
  clothing: MiniClothingRigLayout;
  accessories: MiniAccessoryRigLayout;
  colors: MiniColorRigLayout;
}

export interface MiniImageContentBounds {
  width: number;
  height: number;
  top: number;
  bottom: number;
}
