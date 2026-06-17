export type AvatarGroupKey = 'eyes' | 'hair';
export type AvatarTransformProperty = 'offsetX' | 'offsetY' | 'rotate' | 'scale' | 'flipX';
export type AvatarEditableProperty = AvatarTransformProperty | 'color' | 'lineColor' | 'visibility' | 'layerOrder';
export type AccessoryCategory = 'sideHair' | 'ponytail' | 'accessory' | 'skinMarking';
export type AccessoryLayerSlot = 'behindBody' | 'onSkin' | 'frontBody' | 'frontFace' | 'frontBangs';
export type AccessoryRenderMode = 'mirrored' | 'center';
export type AccessoryPoseKey = 'portrait' | 'chibi' | 'chibiBack' | 'chibiSide';
export type AvatarGradientType = 'linear' | 'radial';
export type AvatarGradientCoordinateSpace = 'local' | 'sharedHair';

export interface AvatarColorGradient {
  type: AvatarGradientType;
  fromColor: string;
  toColor: string;
  position: number;
  angle: number;
  centerX: number;
  centerY: number;
}

export type AvatarTintSource = string | AvatarColorGradient;

export type AvatarPartKey =
  | 'face'
  | 'face.color'
  | 'face.line'
  | 'ear'
  | AvatarGroupKey
  | 'eyes.sclera'
  | 'eyes.color'
  | 'eyes.eyebrow'
  | 'eyes.eyelid'
  | 'eyes.upperEyelid'
  | 'eyes.lowerEyelid'
  | 'eyes.light'
  | 'hair.bangs'
  | 'hair.light'
  | 'hair.topHair'
  | 'hair.backHair'
  | 'mini.bodyType'
  | 'mini.clothingTop'
  | 'mini.clothingBottom'
  | 'mini.hairLightFront'
  | 'mini.hairLightBack'
  | 'mini.hairLightSide'
  | 'mini.upperEyelid'
  | 'mini.eyeLight'
  | 'mini.eyelid'
  | 'mouth'
  | 'nose';

export interface AvatarPartOption {
  id: number;
  label: string;
  isColorEditable?: boolean;
}

export interface AvatarPartDefinition {
  key: AvatarPartKey;
  label: string;
  zIndex: number;
  defaultColor?: string;
  defaultLineColor?: string;
  editableProperties: AvatarEditableProperty[];
  options: AvatarPartOption[];
  parentKey?: AvatarGroupKey;
  isEditorHidden?: boolean;
  renderInPortrait?: boolean;
}

export interface AvatarPartState {
  optionId: number;
  colorVariantId?: number;
  color?: string;
  colorGradient?: AvatarColorGradient;
  colorGradientSpace?: AvatarGradientCoordinateSpace;
  secondaryColor?: string;
  secondaryColorGradient?: AvatarColorGradient;
  lineColor?: string;
  lineColorGradient?: AvatarColorGradient;
  offsetX?: number;
  offsetY?: number;
  rotate?: number;
  scale?: number;
  flipX?: boolean;
  leftVisible?: boolean;
  rightVisible?: boolean;
  isVisible?: boolean;
  layerOrder?: number;
  lightDistance?: number;
}

export interface AvatarAccessoryInstance extends AvatarPartState {
  instanceId: string;
  category: AccessoryCategory;
  layerSlot: AccessoryLayerSlot;
  order: number;
  chibi: AvatarAccessoryPoseState;
  chibiBack: AvatarAccessoryPoseState;
  chibiSide: AvatarAccessoryPoseState;
  isChibiBackFollowingFront: boolean;
}

export interface AvatarAccessoryPoseState {
  layerSlot: AccessoryLayerSlot;
  order: number;
  offsetX: number;
  offsetY: number;
  rotate: number;
  scale: number;
  flipX: boolean;
  leftVisible: boolean;
  rightVisible: boolean;
}

export interface AvatarState extends Record<AvatarPartKey, AvatarPartState> {
  accessories: AvatarAccessoryInstance[];
}

export interface AvatarCanvasOptions {
  width?: number;
  height?: number;
  initialState?: Partial<AvatarState>;
  backgroundColor?: string;
  onChange?: (state: AvatarState) => void;
  onRender?: () => void;
}

export interface AvatarPartStatePatch {
  key: AvatarPartKey;
  patch: Partial<AvatarPartState>;
}

export interface AvatarPartRuntimeTransform {
  offsetX?: number;
  offsetY?: number;
  rotate?: number;
  scale?: number;
  opacity?: number;
}

export interface AvatarPartRuntimeTransformPatch {
  key: AvatarPartKey;
  transform: AvatarPartRuntimeTransform;
}

export interface AccessoryLayerSlotDefinition {
  id: AccessoryLayerSlot;
  label: string;
  zIndex: number;
}

export interface AccessoryCategoryDefinition {
  category: AccessoryCategory;
  label: string;
  assetFolder: string;
  renderMode: AccessoryRenderMode;
  defaultColor: string;
  defaultLineColor: string;
  defaultLayerSlot: AccessoryLayerSlot;
  allowedLayerSlots: AccessoryLayerSlot[];
  editableProperties: AvatarEditableProperty[];
  options: AvatarPartOption[];
}

export interface AccessoryColorVariantOption extends AvatarPartOption {
  file: string;
}
