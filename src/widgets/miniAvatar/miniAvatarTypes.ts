import type { AVATAR_RIG_COLORS } from '../../constants/avatarRig';
import type { AvatarTintSource } from '../avatarCanvas';

export interface MiniSpriteSheet {
  dataUrl: string;
  frameWidth: number;
  frameHeight: number;
  sheetWidth: number;
  sheetHeight: number;
  columns: number;
  rows: number;
  frameCount: number;
}

export type MiniAvatarDirection = 'front' | 'side';

export interface MiniLayer {
  folder: string;
  file: string;
  compositeLayers?: MiniLayer[];
  color?: AvatarTintSource;
  x: number;
  y: number;
  zIndex: number;
  angle?: number;
  scale?: number;
  flipX?: boolean;
}

export type MiniLocalLayer = Omit<MiniLayer, 'x' | 'y'> & {
  x?: number;
  y?: number;
};

export interface MiniPoint {
  x: number;
  y: number;
}

export interface MiniAnchorOffset {
  x: number;
  y: number;
}

export interface MiniTransform {
  x?: number;
  y?: number;
  angle?: number;
  scale?: number;
  flipX?: boolean;
  zIndexOffset?: number;
}

export interface MiniRigNode {
  transform?: MiniTransform;
  layers?: MiniLocalLayer[];
  children?: MiniRigNode[];
  precompose?: boolean;
  precomposeZIndex?: number;
}

export type MiniPoseNodeKey =
  | 'body'
  | 'bodyGroup'
  | 'head'
  | 'eyes'
  | 'legsGroup'
  | 'leftArm'
  | 'rightArm'
  | 'leftLeg'
  | 'rightLeg'
  | 'upperEyelid'
  | 'eyelid'
  | 'eyeLight'
  | 'eyebrow';

export type MiniEyeExpression = 'default' | 'smileBlink';

export interface MiniPose {
  nodes?: Partial<Record<MiniPoseNodeKey, MiniTransform>>;
  eyeExpression?: MiniEyeExpression;
}

export interface MiniAnimation {
  id: string;
  label: string;
  version: number;
  direction: MiniAvatarDirection;
  durationMs: number;
  fps: number;
  columns: number;
  isLooping: boolean;
  clips: MiniAnimationClip[];
}

export interface MiniAnimationClip {
  id: string;
  durationMs?: number;
  intervalMs?: number;
  startOffsetMs?: number;
  sample: (elapsedMs: number, animation: MiniAnimation, clip: MiniAnimationClip) => MiniPose;
}

export type MiniOptionOffsetMap = Record<number, MiniPoint | undefined>;

export interface MiniBodyRigLayout {
  body: MiniPoint;
  bottomAnchor: MiniPoint;
  armIdleDistance: number;
  armIdleOffset: MiniPoint;
  armIdleSocketDistance?: number;
  armIdleSocketOffset?: MiniPoint;
  armIdleLeftSocket?: MiniPoint;
  armIdleRightSocket?: MiniPoint;
  legDistance: number;
  legOffset: MiniPoint;
  rearLegOffset?: MiniPoint;
}

export interface MiniEyeRigLayout {
  eyeDistance: number;
  sclera: MiniPoint;
  lowerEyelid: MiniPoint;
  eyeBall: MiniPoint;
  eyeLight: MiniPoint;
  upperEyeLid: MiniPoint;
  eyelid?: MiniPoint;
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

export interface MiniIdleRigLayout {
  bodyTypeId: number;
  baselineBodyTypeId: number;
  headCenter: MiniPoint;
  bodyCenter: MiniPoint;
  face: MiniPoint;
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

export type MiniFrontIdleRigLayout = MiniIdleRigLayout;

export interface MiniImageContentBounds {
  width: number;
  height: number;
  top: number;
  bottom: number;
}
