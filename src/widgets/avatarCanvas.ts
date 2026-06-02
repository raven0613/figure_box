import { Canvas, Circle, FabricImage, FabricObject, Group } from 'fabric';

import { AVATAR_RIG_COLORS } from '../constants/avatarRig';

export type AvatarGroupKey = 'eyes' | 'hair';
export type AvatarTransformProperty = 'offsetX' | 'offsetY' | 'rotate' | 'scale' | 'flipX';
export type AvatarEditableProperty = AvatarTransformProperty | 'color' | 'lineColor' | 'visibility' | 'layerOrder';
export type AccessoryCategory = 'sideHair' | 'ponytail' | 'accessory';
export type AccessoryLayerSlot = 'behindBody' | 'onSkin' | 'frontBody' | 'frontFace' | 'frontBangs';
export type AccessoryRenderMode = 'mirrored' | 'center';
export type AccessoryPoseKey = 'portrait' | 'chibi';

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
  | 'hair.topHair'
  | 'hair.backHair'
  | 'mini.bodyType'
  | 'mini.clothingTop'
  | 'mini.clothingBottom'
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
  color?: string;
  secondaryColor?: string;
  lineColor?: string;
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
  onChange?: (state: AvatarState) => void;
}

interface AvatarPartContext {
  width: number;
  height: number;
  centerX: number;
  faceCenterY: number;
  getGroupState: (key: AvatarGroupKey) => AvatarPartState;
  getPartState: (key: AvatarPartKey) => AvatarPartState;
}

interface Point2D {
  x: number;
  y: number;
}

interface AvatarImageLayer {
  folder: string;
  file: string;
  tint?: 'color' | 'line' | 'skin';
  tintColor?: string;
  shouldDropLightPixels?: boolean;
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

const DEFAULT_CANVAS_WIDTH = 520;
const DEFAULT_CANVAS_HEIGHT = 560;
const DEFAULT_SCALE = 1;
const DEFAULT_LINE_COLOR = AVATAR_RIG_COLORS.line;
const BASE_TINT_LUMINANCE = 128;
const BLACK_MASK_MAX_LUMINANCE = 8;
const LINE_LAYER_FILL_LUMINANCE_THRESHOLD = 180;
const AVATAR_PIXEL_SCALE = 3;
const EYE_GROUP_OFFSET_Y = -10;
const EYE_DISTANCE = 50;
export const MINI_UPPER_EYELID_OFFSET_Y_LIMITS = {
  min: -1,
  max: 3,
} as const;
const ACCESSORY_ORDER_STEP = 0.01;
const CHIBI_ACCESSORY_POSITION_SCALE = 0.5;
const CHIBI_SIDE_HAIR_POSITION_SCALE = 0.5;
const NON_TINTABLE_MINI_CLOTHING_OPTIONS = {
  tops: new Set([1, 2]),
  bottoms: new Set(),
};
const tintCache = new Map<string, string>();

const avatarAssetUrls = import.meta.glob<string>('../assets/avatar_system/**/*.png', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

export const AVATAR_PART_DEFINITIONS: AvatarPartDefinition[] = [
  createDefinition('hair.backHair', 'back hair bottom', 0, AVATAR_RIG_COLORS.hair, 5, 'hair'),
  createDefinition('hair.topHair', 'back hair top', 1, AVATAR_RIG_COLORS.hair, 6, 'hair'),
  createDefinition('face.color', 'face color', 2, AVATAR_RIG_COLORS.skin, 2, undefined, ['color', 'offsetX', 'offsetY', 'rotate', 'scale', 'flipX'], true),
  createDefinition('ear', 'ear', 3, AVATAR_RIG_COLORS.skin, 1, undefined, ['lineColor', 'offsetX', 'offsetY', 'rotate', 'scale', 'flipX']),
  createDefinition('face', 'face', 4, AVATAR_RIG_COLORS.skin, 2),
  {
    key: 'hair',
    label: 'hair',
    zIndex: 5,
    editableProperties: ['offsetX', 'offsetY', 'rotate', 'scale', 'flipX'],
    options: [{ id: 1, label: 'hair group 1' }],
  },
  {
    key: 'eyes',
    label: 'eyes',
    zIndex: 6,
    editableProperties: ['offsetX', 'offsetY', 'rotate', 'scale', 'flipX'],
    options: [{ id: 1, label: 'eyes group 1' }],
  },
  createDefinition('eyes.sclera', 'sclera', 6.5, AVATAR_RIG_COLORS.sclera, 1, 'eyes', ['color', 'offsetX', 'offsetY', 'rotate', 'scale', 'flipX']),
  createDefinition('eyes.color', 'eye ball', 7, AVATAR_RIG_COLORS.eyeBall, 6, 'eyes'),
  createDefinition('eyes.light', 'eye light', 8, AVATAR_RIG_COLORS.eyeLight, 1, 'eyes'),
  createDefinition('eyes.lowerEyelid', 'lower eyelid', 9, AVATAR_RIG_COLORS.lowerEyelidColor, 3, 'eyes', ['lineColor', 'offsetX', 'offsetY', 'rotate', 'scale', 'flipX'], false, AVATAR_RIG_COLORS.lowerEyelidLine),
  createDefinition('eyes.upperEyelid', 'upper eyelid', 10, AVATAR_RIG_COLORS.upperEyelid, 5, 'eyes', ['lineColor', 'offsetX', 'offsetY', 'rotate', 'scale', 'flipX'], false, AVATAR_RIG_COLORS.upperEyelid),
  createDefinition('eyes.eyelid', 'eyelid', 11, AVATAR_RIG_COLORS.eyelid, 5, 'eyes', undefined, false, AVATAR_RIG_COLORS.eyelid),
  createDefinition('eyes.eyebrow', 'eyebrow', 12, AVATAR_RIG_COLORS.eyebrow, 6, 'eyes', undefined, false, AVATAR_RIG_COLORS.eyebrow),
  createDefinition('nose', 'nose', 13, AVATAR_RIG_COLORS.nose, 5),
  createDefinition('mouth', 'mouth', 14, AVATAR_RIG_COLORS.mouth, 3, undefined, undefined, false, AVATAR_RIG_COLORS.mouth),
  createDefinition('face.line', 'face line', 15, AVATAR_RIG_COLORS.skin, 2, undefined, ['lineColor', 'offsetX', 'offsetY', 'rotate', 'scale', 'flipX'], true),
  createDefinition('hair.bangs', 'bangs', 17, AVATAR_RIG_COLORS.hair, 4, 'hair'),
  createMiniOnlyDefinition(
    'mini.bodyType',
    'mini body type',
    AVATAR_RIG_COLORS.skin,
    createNumberedOptionDefinitions(5, 'mini body type'),
    [],
  ),
  createMiniOnlyDefinition(
    'mini.clothingBottom',
    'bottom',
    AVATAR_RIG_COLORS.clothingBottom,
    createMiniDirectoryOptionDefinitions('clothing/bottoms', 'bottom', NON_TINTABLE_MINI_CLOTHING_OPTIONS.bottoms),
    ['visibility', 'color', 'lineColor', 'layerOrder'],
  ),
  createMiniOnlyDefinition(
    'mini.clothingTop',
    'top',
    AVATAR_RIG_COLORS.clothingTop,
    createMiniDirectoryOptionDefinitions('clothing/tops', 'top', NON_TINTABLE_MINI_CLOTHING_OPTIONS.tops),
    ['visibility', 'color', 'lineColor', 'layerOrder'],
  ),
  createMiniOnlyDefinition(
    'mini.upperEyelid',
    'mini upper eyelid',
    AVATAR_RIG_COLORS.upperEyelid,
    [{ id: 1, label: 'mini upper eyelid 1' }],
    ['offsetY', 'rotate'],
    AVATAR_RIG_COLORS.upperEyelid,
    true,
  ),
  createMiniOnlyDefinition(
    'mini.eyeLight',
    'mini eye light',
    AVATAR_RIG_COLORS.eyeLight,
    [{ id: 1, label: 'mini eye light 1' }],
    ['offsetX', 'offsetY'],
    AVATAR_RIG_COLORS.eyeLight,
    true,
  ),
  createMiniOnlyDefinition(
    'mini.eyelid',
    'mini eyelid',
    AVATAR_RIG_COLORS.eyelid,
    [{ id: 1, label: 'mini eyelid 1' }],
    ['lineColor'],
    AVATAR_RIG_COLORS.eyelid,
    true,
  ),

];

export const AVATAR_EDITOR_PART_DEFINITIONS: AvatarPartDefinition[] = AVATAR_PART_DEFINITIONS
  .filter(definition => definition.isEditorHidden !== true);

export const ACCESSORY_LAYER_SLOT_DEFINITIONS: AccessoryLayerSlotDefinition[] = [
  { id: 'behindBody', label: '身體後', zIndex: -1 },
  { id: 'onSkin', label: '身體上', zIndex: 2.25 },
  { id: 'frontBody', label: '身體前', zIndex: 2.5 },
  { id: 'frontFace', label: '臉前', zIndex: 15.5 },
  { id: 'frontBangs', label: '瀏海前', zIndex: 18 },
];

export const ACCESSORY_CATEGORY_DEFINITIONS: AccessoryCategoryDefinition[] = [
  createAccessoryCategoryDefinition('sideHair', '側髮', 'accessory/side_hair', 'mirrored', AVATAR_RIG_COLORS.hair, 'frontFace', [
    'behindBody',
    'frontBody',
    'frontFace',
    'frontBangs',
  ]),
  createAccessoryCategoryDefinition('ponytail', '馬尾', 'accessory/ponytail', 'center', AVATAR_RIG_COLORS.hair, 'behindBody', [
    'behindBody',
    'frontBody',
    'frontFace',
    'frontBangs',
  ]),
  createAccessoryCategoryDefinition('accessory', '配件', 'accessory/accessory', 'center', AVATAR_RIG_COLORS.accessory, 'frontFace', [
    'behindBody',
    'onSkin',
    'frontBody',
    'frontFace',
    'frontBangs',
  ]),
];

export function createDefaultAvatarState(): AvatarState {
  const partState = AVATAR_PART_DEFINITIONS.reduce((state, definition) => {
    state[definition.key] = {
      optionId: definition.options[0]?.id ?? 1,
      color: definition.defaultColor,
      secondaryColor: definition.key === 'eyes.color' ? definition.defaultColor : undefined,
      lineColor: definition.defaultLineColor ?? DEFAULT_LINE_COLOR,
      offsetX: 0,
      offsetY: 0,
      rotate: 0,
      scale: DEFAULT_SCALE,
      flipX: false,
      leftVisible: true,
      rightVisible: true,
      isVisible: true,
      layerOrder: getDefaultPartLayerOrder(definition.key),
      lightDistance: definition.key === 'mini.eyeLight' ? undefined : EYE_DISTANCE - 5,
    };
    return state;
  }, {} as Record<AvatarPartKey, AvatarPartState>);

  return {
    ...partState,
    accessories: [createDefaultAccessoryInstance('sideHair', 0)],
  };
}

function createDefinition(
  key: AvatarPartKey,
  label: string,
  zIndex: number,
  defaultColor: string,
  optionCount: number,
  parentKey?: AvatarGroupKey,
  editableProperties: AvatarEditableProperty[] = ['color', 'lineColor', 'offsetX', 'offsetY', 'rotate', 'scale', 'flipX'],
  isEditorHidden = false,
  defaultLineColor = DEFAULT_LINE_COLOR,
): AvatarPartDefinition {
  return {
    key,
    label,
    zIndex,
    defaultColor,
    defaultLineColor,
    editableProperties,
    isEditorHidden,
    options: Array.from({ length: optionCount }, (_, index) => ({
      id: index + 1,
      label: `${label} ${index + 1}`,
    })),
    parentKey,
  };
}

function createMiniOnlyDefinition(
  key: AvatarPartKey,
  label: string,
  defaultColor: string,
  options: AvatarPartOption[],
  editableProperties: AvatarEditableProperty[],
  defaultLineColor = DEFAULT_LINE_COLOR,
  isEditorHidden = false,
): AvatarPartDefinition {
  return {
    key,
    label,
    zIndex: 100,
    defaultColor,
    defaultLineColor,
    editableProperties,
    isEditorHidden,
    options,
    renderInPortrait: false,
  };
}

function createNumberedOptionDefinitions(optionCount: number, label: string): AvatarPartOption[] {
  return Array.from({ length: optionCount }, (_, index) => ({
    id: index + 1,
    label: `${label} ${index + 1}`,
  }));
}

function createAccessoryCategoryDefinition(
  category: AccessoryCategory,
  label: string,
  assetFolder: string,
  renderMode: AccessoryRenderMode,
  defaultColor: string,
  defaultLayerSlot: AccessoryLayerSlot,
  allowedLayerSlots: AccessoryLayerSlot[],
): AccessoryCategoryDefinition {
  return {
    category,
    label,
    assetFolder,
    renderMode,
    defaultColor,
    defaultLineColor: DEFAULT_LINE_COLOR,
    defaultLayerSlot,
    allowedLayerSlots,
    editableProperties: ['color', 'lineColor', 'offsetX', 'offsetY', 'rotate', 'scale', 'flipX'],
    options: createAssetOptionDefinitions(assetFolder, label),
  };
}

export function createDefaultAccessoryInstance(
  category: AccessoryCategory,
  order: number,
  layerSlot?: AccessoryLayerSlot,
): AvatarAccessoryInstance {
  const definition = getAccessoryCategoryDefinition(category);

  return {
    instanceId: createAccessoryInstanceId(),
    category,
    optionId: definition.options[0]?.id ?? 1,
    color: definition.defaultColor,
    lineColor: definition.defaultLineColor,
    offsetX: 0,
    offsetY: 0,
    rotate: 0,
    scale: DEFAULT_SCALE,
    flipX: false,
    leftVisible: true,
    rightVisible: true,
    layerSlot: layerSlot ?? definition.defaultLayerSlot,
    order,
    chibi: createDefaultAccessoryPoseState(layerSlot ?? definition.defaultLayerSlot, order),
  };
}

export function getAccessoryPoseState(
  accessory: AvatarAccessoryInstance,
  poseKey: AccessoryPoseKey,
): AvatarAccessoryPoseState {
  if (poseKey === 'chibi') {
    return {
      ...createDefaultAccessoryPoseState(accessory.layerSlot, accessory.order),
      ...accessory.chibi,
      layerSlot: accessory.layerSlot,
      order: accessory.order,
      flipX: accessory.flipX === true,
      leftVisible: accessory.leftVisible !== false,
      rightVisible: accessory.rightVisible !== false,
    };
  }

  return {
    layerSlot: accessory.layerSlot,
    order: accessory.order,
    offsetX: accessory.offsetX ?? 0,
    offsetY: accessory.offsetY ?? 0,
    rotate: accessory.rotate ?? 0,
    scale: accessory.scale ?? DEFAULT_SCALE,
    flipX: accessory.flipX === true,
    leftVisible: accessory.leftVisible !== false,
    rightVisible: accessory.rightVisible !== false,
  };
}

function createDefaultAccessoryPoseState(
  layerSlot: AccessoryLayerSlot,
  order: number,
): AvatarAccessoryPoseState {
  return {
    layerSlot,
    order,
    offsetX: 0,
    offsetY: 0,
    rotate: 0,
    scale: DEFAULT_SCALE,
    flipX: false,
    leftVisible: true,
    rightVisible: true,
  };
}

export function getAccessoryCategoryDefinition(category: AccessoryCategory): AccessoryCategoryDefinition {
  const definition = ACCESSORY_CATEGORY_DEFINITIONS.find(item => item.category === category);

  if (!definition) {
    throw new Error(`Unsupported accessory category: ${category}`);
  }

  return definition;
}

export function getAccessoryLayerSlotDefinition(slot: AccessoryLayerSlot): AccessoryLayerSlotDefinition {
  const definition = ACCESSORY_LAYER_SLOT_DEFINITIONS.find(item => item.id === slot);

  if (!definition) {
    throw new Error(`Unsupported accessory layer slot: ${slot}`);
  }

  return definition;
}

export function getAccessoryDisplayName(accessory: AvatarAccessoryInstance): string {
  const category = getAccessoryCategoryDefinition(accessory.category);
  return `${category.label} ${accessory.optionId}`;
}

export function isAvatarPartOptionColorEditable(key: AvatarPartKey, optionId: number): boolean {
  const definition = AVATAR_PART_DEFINITIONS.find(item => item.key === key);
  const option = definition?.options.find(item => item.id === optionId);

  return option?.isColorEditable !== false;
}

function getDefaultPartLayerOrder(key: AvatarPartKey): number {
  if (key === 'mini.clothingTop') {
    return 1;
  }

  return 0;
}

function createAccessoryPartDefinition(accessory: AvatarAccessoryInstance): AvatarPartDefinition {
  const category = getAccessoryCategoryDefinition(accessory.category);

  return {
    key: 'hair',
    label: getAccessoryDisplayName(accessory),
    zIndex: getAccessoryZIndex(accessory),
    defaultColor: category.defaultColor,
    defaultLineColor: category.defaultLineColor,
    editableProperties: category.editableProperties,
    options: category.options,
    parentKey: accessory.category === 'sideHair' || accessory.category === 'ponytail'
      ? 'hair'
      : undefined,
  };
}

function getAccessoryZIndex(accessory: AvatarAccessoryInstance): number {
  return getAccessoryLayerSlotDefinition(accessory.layerSlot).zIndex + accessory.order * ACCESSORY_ORDER_STEP;
}

function createAccessoryInstanceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `accessory-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

abstract class AvatarPart {
  protected readonly definition: AvatarPartDefinition;
  protected readonly context: AvatarPartContext;
  protected state: AvatarPartState;
  protected object: Group | null = null;

  constructor(definition: AvatarPartDefinition, context: AvatarPartContext, state: AvatarPartState) {
    this.definition = definition;
    this.context = context;
    this.state = { ...state };
  }

  get key(): AvatarPartKey {
    return this.definition.key;
  }

  get zIndex(): number {
    return this.definition.zIndex;
  }

  createObject(): Group {
    this.object = new Group(this.createArtwork(), {
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      objectCaching: false,
    });
    this.applyTransform();
    return this.object;
  }

  update(nextState: AvatarPartState): void {
    this.state = { ...this.state, ...nextState };
    this.updateArtworkColor();
    this.applyTransform();
  }

  refreshParentTransform(): void {
    this.applyTransform();
  }

  refreshArtwork(): void {
    // Non-image parts do not need artwork refreshes.
  }

  protected abstract get baseX(): number;
  protected abstract get baseY(): number;
  protected abstract createArtwork(): FabricObject[];

  protected get color(): string {
    return this.state.color ?? this.definition.defaultColor ?? AVATAR_RIG_COLORS.line;
  }

  protected get lineColor(): string {
    return this.state.lineColor ?? this.definition.defaultLineColor ?? DEFAULT_LINE_COLOR;
  }

  protected getFaceColor(): string {
    return this.context.getPartState('face').color ?? AVATAR_RIG_COLORS.skin;
  }

  protected get scale(): number {
    return this.state.scale ?? DEFAULT_SCALE;
  }

  protected get flipMultiplier(): 1 | -1 {
    return this.state.flipX ? -1 : 1;
  }

  protected getPartOffset(): Point2D {
    return {
      x: this.state.offsetX ?? 0,
      y: this.state.offsetY ?? 0,
    };
  }

  protected getPartRotation(): number {
    return this.state.rotate ?? 0;
  }

  protected applyTransform(): void {
    if (!this.object) {
      return;
    }

    const transform = this.resolveWorldTransform(this.getPartOffset(), this.getPartRotation(), this.scale);
    this.object.set(transform);
    this.object.setCoords();
  }

  protected resolveWorldTransform(offset: Point2D, rotation: number, scale: number): {
    left: number;
    top: number;
    angle: number;
    scaleX: number;
    scaleY: number;
  } {
    const parentKey = this.definition.parentKey;

    if (!parentKey) {
      return {
        left: this.baseX + offset.x,
        top: this.baseY + offset.y,
        angle: rotation,
        scaleX: scale * this.flipMultiplier,
        scaleY: scale,
      };
    }

    const parentState = this.context.getGroupState(parentKey);
    const parentBase = this.getGroupBase(parentKey);
    const parentScale = parentState.scale ?? DEFAULT_SCALE;
    const parentRotation = parentState.rotate ?? 0;
    const parentFlip = parentState.flipX ? -1 : 1;
    const localPoint = {
      x: (this.baseX - parentBase.x + offset.x) * parentFlip,
      y: this.baseY - parentBase.y + offset.y,
    };
    const rotatedPoint = rotatePoint({
      x: localPoint.x * parentScale,
      y: localPoint.y * parentScale,
    }, parentRotation);

    return {
      left: parentBase.x + (parentState.offsetX ?? 0) + rotatedPoint.x,
      top: parentBase.y + (parentState.offsetY ?? 0) + rotatedPoint.y,
      angle: parentRotation + rotation * parentFlip,
      scaleX: parentScale * scale * parentFlip * this.flipMultiplier,
      scaleY: parentScale * scale,
    };
  }

  protected getGroupBase(key: AvatarGroupKey): Point2D {
    if (key === 'eyes') {
      return {
        x: this.context.centerX,
        y: this.context.faceCenterY + EYE_GROUP_OFFSET_Y,
      };
    }

    return {
      x: this.context.centerX,
      y: this.context.faceCenterY - 54,
    };
  }

  protected updateArtworkColor(): void {
    // Image-backed parts override this when they have tintable layers.
  }
}

abstract class AvatarControlGroupPart extends AvatarPart {
  protected createArtwork(): FabricObject[] {
    return [];
  }

  protected getPartOffset(): Point2D {
    return { x: 0, y: 0 };
  }

  protected getPartRotation(): number {
    return 0;
  }

  protected resolveWorldTransform(): {
    left: number;
    top: number;
    angle: number;
    scaleX: number;
    scaleY: number;
  } {
    return {
      left: this.baseX + (this.state.offsetX ?? 0),
      top: this.baseY + (this.state.offsetY ?? 0),
      angle: this.state.rotate ?? 0,
      scaleX: (this.state.scale ?? DEFAULT_SCALE) * this.flipMultiplier,
      scaleY: this.state.scale ?? DEFAULT_SCALE,
    };
  }
}

class EyeGroupPart extends AvatarControlGroupPart {
  protected get baseX(): number {
    return this.context.centerX;
  }

  protected get baseY(): number {
    return this.context.faceCenterY + EYE_GROUP_OFFSET_Y;
  }

}

class HairGroupPart extends AvatarControlGroupPart {
  protected get baseX(): number {
    return this.context.centerX;
  }

  protected get baseY(): number {
    return this.context.faceCenterY - 54;
  }

}

abstract class ImageAvatarPart extends AvatarPart {
  private readonly images: FabricImage[] = [];
  private loadVersion = 0;

  createObject(): Group {
    const group = super.createObject();
    void this.reloadImages();
    return group;
  }

  update(nextState: AvatarPartState): void {
    const previousOptionId = this.state.optionId;
    const previousColor = this.state.color;
    const previousSecondaryColor = this.state.secondaryColor;
    const previousLineColor = this.state.lineColor;
    this.state = { ...this.state, ...nextState };
    this.applyTransform();

    if (
      previousOptionId !== this.state.optionId ||
      previousColor !== this.state.color ||
      previousSecondaryColor !== this.state.secondaryColor ||
      previousLineColor !== this.state.lineColor
    ) {
      void this.reloadImages();
    }
  }

  protected createArtwork(): FabricObject[] {
    return [];
  }

  refreshArtwork(): void {
    void this.reloadImages();
  }

  protected abstract resolveLayers(): AvatarImageLayer[];
  protected abstract configureImage(image: FabricImage, layer: AvatarImageLayer): void;

  private async reloadImages(): Promise<void> {
    if (!this.object) {
      return;
    }

    const currentLoadVersion = this.loadVersion + 1;
    this.loadVersion = currentLoadVersion;
    this.removeCurrentImages();

    const nextImages = await Promise.all(
      this.resolveLayers().map(async layer => {
        const assetUrl = getAvatarAssetUrl(layer.folder, layer.file);
        const imageUrl = layer.tint
          ? await tintImageByLuminance(
            assetUrl,
            layer.tintColor ?? this.getTintColor(layer.tint),
            layer.tint,
            layer.folder === 'face' && layer.tint === 'color',
            layer.shouldDropLightPixels === true,
          )
          : assetUrl;
        const image = await FabricImage.fromURL(imageUrl);
        image.set({
          selectable: false,
          evented: false,
          objectCaching: false,
          imageSmoothing: false,
          originX: 'center',
          originY: 'center',
          data: 'avatar-image',
          'data-tint': layer.tint,
        });
        this.configureImage(image, layer);

        return image;
      }),
    );

    if (!this.object || currentLoadVersion !== this.loadVersion) {
      return;
    }

    this.images.push(...nextImages);
    this.object.add(...nextImages);
    nextImages
      .slice()
      .reverse()
      .forEach(image => this.object?.sendObjectToBack(image));
    this.applyTransform();
    this.object.setCoords();
    this.object.canvas?.requestRenderAll();
  }

  private removeCurrentImages(): void {
    if (!this.object || this.images.length === 0) {
      return;
    }

    this.object.remove(...this.images);
    this.images.splice(0, this.images.length);
  }

  protected getTintColor(tint: 'color' | 'line' | 'skin'): string {
    if (tint === 'skin') {
      return this.getFaceColor();
    }

    return tint === 'color' ? this.color : this.lineColor;
  }
}

abstract class CenterAssetPart extends ImageAvatarPart {
  protected configureImage(image: FabricImage): void {
    image.set({
      left: 0,
      top: 0,
      scaleX: AVATAR_PIXEL_SCALE,
      scaleY: AVATAR_PIXEL_SCALE,
    });
  }
}

abstract class MirroredAssetPart extends ImageAvatarPart {
  protected configureImage(image: FabricImage, layer: AvatarImageLayer): void {
    const side = layer.file.includes('__right') ? 1 : -1;
    const shouldFlip = this.shouldFlipMirroredSide(side);
    image.set({
      left: this.getSideBaseX(side) + this.getSideOffsetX(side),
      top: this.getSideBaseY() + (this.state.offsetY ?? 0),
      angle: this.getSideBaseAngle() + side * (this.state.rotate ?? 0),
      flipX: shouldFlip,
      flipY: false,
      scaleX: AVATAR_PIXEL_SCALE * this.scale,
      scaleY: AVATAR_PIXEL_SCALE * this.scale,
      visible: this.isSideVisible(side),
      data: 'avatar-image',
      'data-side': side,
    });
  }

  update(nextState: AvatarPartState): void {
    super.update(nextState);
    this.updateMirroredImages();
  }

  protected applyTransform(): void {
    if (!this.object) {
      return;
    }

    this.updateMirroredImages();
    const transform = this.resolveWorldTransform({ x: 0, y: 0 }, 0, 1);
    this.object.set(transform);
    this.object.setCoords();
  }

  protected resolveLayers(): AvatarImageLayer[] {
    return [
      ...this.resolveSideLayers(-1),
      ...this.resolveSideLayers(1).map(layer => ({
        ...layer,
        file: `${layer.file}__right`,
      })),
    ];
  }

  protected abstract resolveSideLayers(side: -1 | 1): AvatarImageLayer[];

  protected getSideBaseX(side: -1 | 1): number {
    return side * EYE_DISTANCE;
  }

  protected getSideBaseY(): number {
    return 0;
  }

  protected getSideBaseAngle(): number {
    return 0;
  }

  protected shouldMirrorRightSide(): boolean {
    return true;
  }

  protected shouldMirrorSides(): boolean {
    return true;
  }

  protected getMirroredSourceSide(): -1 | 1 {
    return this.shouldMirrorRightSide() ? 1 : -1;
  }

  protected isSideVisible(side: -1 | 1): boolean {
    return side === -1
      ? this.state.leftVisible !== false
      : this.state.rightVisible !== false;
  }

  private updateMirroredImages(): void {
    if (!this.object) {
      return;
    }

    this.object.getObjects().forEach(object => {
      const side = object.get('data-side') as -1 | 1 | undefined;

      if (!side) {
        return;
      }

      const shouldFlip = this.shouldFlipMirroredSide(side);
      object.set({
        left: this.getSideBaseX(side) + this.getSideOffsetX(side),
        top: this.getSideBaseY() + (this.state.offsetY ?? 0),
        angle: this.getSideBaseAngle() + side * (this.state.rotate ?? 0),
        flipX: shouldFlip,
        flipY: false,
        scaleX: AVATAR_PIXEL_SCALE * this.scale,
        scaleY: AVATAR_PIXEL_SCALE * this.scale,
        visible: this.isSideVisible(side),
      });
    });
  }

  private shouldFlipMirroredSide(side: -1 | 1): boolean {
    const userFlip = this.state.flipX === true;

    if (!this.shouldMirrorSides()) {
      return userFlip;
    }

    return side !== this.getMirroredSourceSide() ? !userFlip : userFlip;
  }

  protected getSideOffsetX(side: -1 | 1): number {
    return side * (this.state.offsetX ?? 0);
  }
}

class FaceControlPart extends AvatarControlGroupPart {
  protected get baseX(): number {
    return this.context.centerX;
  }

  protected get baseY(): number {
    return this.context.faceCenterY;
  }
}

class FaceColorPart extends CenterAssetPart {
  protected get baseX(): number {
    return this.context.centerX;
  }

  protected get baseY(): number {
    return this.context.faceCenterY;
  }

  protected resolveLayers(): AvatarImageLayer[] {
    return [{ folder: 'face', file: `${formatOptionId(this.state.optionId)}_color.png`, tint: 'color' }];
  }
}

class FaceLinePart extends CenterAssetPart {
  protected get baseX(): number {
    return this.context.centerX;
  }

  protected get baseY(): number {
    return this.context.faceCenterY;
  }

  protected resolveLayers(): AvatarImageLayer[] {
    return [{ folder: 'face', file: `${formatOptionId(this.state.optionId)}_line.png`, tint: 'line' }];
  }
}

class EarPart extends MirroredAssetPart {
  protected get baseX(): number {
    return this.context.centerX;
  }

  protected get baseY(): number {
    return this.context.faceCenterY + 2;
  }

  protected resolveSideLayers(): AvatarImageLayer[] {
    return createSkinAndLineLayers('ear', '01');
  }

  protected getSideBaseX(side: -1 | 1): number {
    return side * 111;
  }
}

class ScleraPart extends AvatarPart {
  protected get baseX(): number {
    return this.context.centerX;
  }

  protected get baseY(): number {
    return this.getGroupBase('eyes').y;
  }

  protected createArtwork(): FabricObject[] {
    return [
      this.createScleraCircle(-1),
      this.createScleraCircle(1),
    ];
  }

  update(nextState: AvatarPartState): void {
    super.update(nextState);
    this.updateScleraCircles();
  }

  protected applyTransform(): void {
    if (!this.object) {
      return;
    }

    this.updateScleraCircles();
    const transform = this.resolveWorldTransform({ x: 0, y: 0 }, 0, 1);
    this.object.set(transform);
    this.object.setCoords();
  }

  protected updateArtworkColor(): void {
    if (!this.object) {
      return;
    }

    this.object.getObjects().forEach(object => {
      if (object.get('data') === 'sclera-circle') {
        object.set('fill', this.color);
      }
    });
  }

  private createScleraCircle(side: -1 | 1): Circle {
    return new Circle({
      radius: 33,
      fill: this.color,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      objectCaching: false,
      data: 'sclera-circle',
      'data-side': side,
    });
  }

  private updateScleraCircles(): void {
    if (!this.object) {
      return;
    }

    this.object.getObjects().forEach(object => {
      const side = object.get('data-side') as -1 | 1 | undefined;

      if (!side) {
        return;
      }

      object.set({
        left: side * EYE_DISTANCE + side * (this.state.offsetX ?? 0),
        top: this.state.offsetY ?? 0,
        angle: side * (this.state.rotate ?? 0),
        scaleX: this.scale,
        scaleY: this.scale,
      });
    });
  }
}

class EyeBallPart extends MirroredAssetPart {
  protected get baseX(): number {
    return this.context.centerX;
  }

  protected get baseY(): number {
    return this.getGroupBase('eyes').y;
  }

  protected resolveSideLayers(side: -1 | 1): AvatarImageLayer[] {
    return createLineAndColorLayers('eyeball', formatOptionId(this.state.optionId))
      .map(layer => layer.tint === 'color'
        ? {
          ...layer,
          tintColor: side === -1
            ? this.color
            : this.state.secondaryColor ?? this.color,
        }
        : layer);
  }
}

class EyeLightPart extends MirroredAssetPart {
  protected get baseX(): number {
    return this.context.centerX;
  }

  protected get baseY(): number {
    return this.getGroupBase('eyes').y;
  }

  protected resolveSideLayers(): AvatarImageLayer[] {
    return [{ folder: 'eye_light', file: '01.png' }];
  }

  protected getSideBaseX(side: -1 | 1): number {
    return side * (this.state.lightDistance ?? EYE_DISTANCE - 5);
  }

  protected getSideBaseY(): number {
    return -0;
  }

  protected getSideOffsetX(): number {
    return this.state.offsetX ?? 0;
  }

  protected shouldMirrorRightSide(): boolean {
    return false;
  }

  protected shouldMirrorSides(): boolean {
    return false;
  }
}

class EyebrowPart extends MirroredAssetPart {
  protected get baseX(): number {
    return this.context.centerX;
  }

  protected get baseY(): number {
    return this.getGroupBase('eyes').y - 15;
  }

  protected resolveSideLayers(): AvatarImageLayer[] {
    return [{ folder: 'eyebrow', file: `${formatOptionId(this.state.optionId)}.png`, tint: 'line' }];
  }

  protected getSideBaseY(): number {
    return -12;
  }
}

class EyeLidPart extends MirroredAssetPart {
  protected get baseX(): number {
    return this.context.centerX;
  }

  protected get baseY(): number {
    return this.getGroupBase('eyes').y - 14;
  }

  protected resolveSideLayers(): AvatarImageLayer[] {
    return [{ folder: 'eyelid', file: `${formatOptionId(this.state.optionId)}.png`, tint: 'line' }];
  }
}

class UpperEyelidPart extends MirroredAssetPart {
  protected get baseX(): number {
    return this.context.centerX;
  }

  protected get baseY(): number {
    return this.getGroupBase('eyes').y - 9;
  }

  protected resolveSideLayers(): AvatarImageLayer[] {
    return createSkinAndLineLayers('upper_eyelid', formatOptionId(this.state.optionId), true);
  }

  protected getSideBaseY(): number {
    return -7;
  }
}

class LowerEyelidPart extends MirroredAssetPart {
  protected get baseX(): number {
    return this.context.centerX;
  }

  protected get baseY(): number {
    return this.getGroupBase('eyes').y + 15;
  }

  protected resolveSideLayers(): AvatarImageLayer[] {
    return createSkinAndLineLayers('lower_eyelid', formatOptionId(this.state.optionId), true);
  }

  protected getSideBaseY(): number {
    return 8;
  }
}

class NosePart extends CenterAssetPart {
  protected get baseX(): number {
    return this.context.centerX;
  }

  protected get baseY(): number {
    return this.context.faceCenterY + 35;
  }

  protected resolveLayers(): AvatarImageLayer[] {
    return createOptionalLineAndColorLayers('nose', formatOptionId(this.state.optionId), `${formatOptionId(this.state.optionId)}.png`);
  }
}

class MouthPart extends CenterAssetPart {
  protected get baseX(): number {
    return this.context.centerX;
  }

  protected get baseY(): number {
    return this.context.faceCenterY + 65;
  }

  protected resolveLayers(): AvatarImageLayer[] {
    return [{ folder: 'mouth', file: `${formatOptionId(this.state.optionId)}_line.png`, tint: 'line' }];
  }
}

class BackHairPart extends CenterAssetPart {
  protected get baseX(): number {
    return this.context.centerX;
  }

  protected get baseY(): number {
    return this.context.faceCenterY + 46;
  }

  protected resolveLayers(): AvatarImageLayer[] {
    return createLineAndColorLayers('back_hair_bottom', formatOptionId(this.state.optionId));
  }
}

class TopHairPart extends CenterAssetPart {
  protected get baseX(): number {
    return this.context.centerX;
  }

  protected get baseY(): number {
    return this.context.faceCenterY - 130;
  }

  protected resolveLayers(): AvatarImageLayer[] {
    return createLineAndColorLayers('back_hair_top', formatOptionId(this.state.optionId));
  }
}

class BangsPart extends CenterAssetPart {
  protected get baseX(): number {
    return this.context.centerX;
  }

  protected get baseY(): number {
    return this.context.faceCenterY - 78;
  }

  protected resolveLayers(): AvatarImageLayer[] {
    return createLineAndColorLayers('bangs', formatOptionId(this.state.optionId));
  }
}

abstract class BaseAccessoryPart extends ImageAvatarPart {
  protected get accessoryState(): AvatarAccessoryInstance {
    return this.state as AvatarAccessoryInstance;
  }

  protected get categoryDefinition(): AccessoryCategoryDefinition {
    return getAccessoryCategoryDefinition(this.accessoryState.category);
  }

  protected get baseX(): number {
    return this.context.centerX;
  }

  protected get baseY(): number {
    return this.context.faceCenterY - 18;
  }

  protected resolveAccessoryLayers(): AvatarImageLayer[] {
    return createOptionalLineAndColorLayers(
      this.categoryDefinition.assetFolder,
      formatOptionId(this.state.optionId),
      `${formatOptionId(this.state.optionId)}.png`,
    );
  }
}

class CenterAccessoryPart extends BaseAccessoryPart {
  protected resolveLayers(): AvatarImageLayer[] {
    return this.resolveAccessoryLayers();
  }

  protected configureImage(image: FabricImage): void {
    image.set({
      left: 0,
      top: 0,
      scaleX: AVATAR_PIXEL_SCALE,
      scaleY: AVATAR_PIXEL_SCALE,
    });
  }
}

class MirroredAccessoryPart extends MirroredAssetPart {
  protected get baseX(): number {
    return this.context.centerX;
  }

  protected get baseY(): number {
    return this.context.faceCenterY - 18;
  }

  protected resolveSideLayers(): AvatarImageLayer[] {
    return createOptionalLineAndColorLayers(
      getAccessoryCategoryDefinition((this.state as AvatarAccessoryInstance).category).assetFolder,
      formatOptionId(this.state.optionId),
      `${formatOptionId(this.state.optionId)}.png`,
    );
  }

  protected getSideBaseX(side: -1 | 1): number {
    return side * 100;
  }

  protected getSideBaseY(): number {
    return 30;
  }

  protected getMirroredSourceSide(): -1 | 1 {
    const accessoryState = this.state as AvatarAccessoryInstance;

    if (accessoryState.category === 'sideHair') {
      return [1, 3, 5].includes(this.state.optionId) ? -1 : 1;
    }

    return 1;
  }
}

class AvatarPartFactory {
  create(definition: AvatarPartDefinition, context: AvatarPartContext, state: AvatarPartState): AvatarPart {
    switch (definition.key) {
      case 'face':
        return new FaceControlPart(definition, context, state);
      case 'face.color':
        return new FaceColorPart(definition, context, state);
      case 'face.line':
        return new FaceLinePart(definition, context, state);
      case 'ear':
        return new EarPart(definition, context, state);
      case 'eyes':
        return new EyeGroupPart(definition, context, state);
      case 'hair':
        return new HairGroupPart(definition, context, state);
      case 'eyes.sclera':
        return new ScleraPart(definition, context, state);
      case 'eyes.color':
        return new EyeBallPart(definition, context, state);
      case 'eyes.light':
        return new EyeLightPart(definition, context, state);
      case 'eyes.eyebrow':
        return new EyebrowPart(definition, context, state);
      case 'eyes.eyelid':
        return new EyeLidPart(definition, context, state);
      case 'eyes.upperEyelid':
        return new UpperEyelidPart(definition, context, state);
      case 'eyes.lowerEyelid':
        return new LowerEyelidPart(definition, context, state);
      case 'nose':
        return new NosePart(definition, context, state);
      case 'mouth':
        return new MouthPart(definition, context, state);
      case 'hair.backHair':
        return new BackHairPart(definition, context, state);
      case 'hair.topHair':
        return new TopHairPart(definition, context, state);
      case 'hair.bangs':
        return new BangsPart(definition, context, state);
    }

    throw new Error(`Unsupported avatar part: ${definition.key}`);
  }

  createAccessory(context: AvatarPartContext, accessory: AvatarAccessoryInstance): AvatarPart {
    const definition = createAccessoryPartDefinition(accessory);
    const categoryDefinition = getAccessoryCategoryDefinition(accessory.category);

    if (categoryDefinition.renderMode === 'mirrored') {
      return new MirroredAccessoryPart(definition, context, accessory);
    }

    return new CenterAccessoryPart(definition, context, accessory);
  }
}

class AvatarStateStore {
  private state: AvatarState;

  constructor(initialState?: Partial<AvatarState>) {
    this.state = this.mergeInitialState(initialState);
  }

  getSnapshot(): AvatarState {
    return structuredClone(this.state);
  }

  replaceState(nextState?: Partial<AvatarState>): void {
    this.state = this.mergeInitialState(nextState);
  }

  getPartState(key: AvatarPartKey): AvatarPartState {
    return { ...this.state[key] };
  }

  getAccessories(): AvatarAccessoryInstance[] {
    return this.state.accessories.map(accessory => ({ ...accessory }));
  }

  getAccessoryState(instanceId: string): AvatarAccessoryInstance | null {
    const accessory = this.state.accessories.find(item => item.instanceId === instanceId);
    return accessory ? { ...accessory } : null;
  }

  updatePart(key: AvatarPartKey, patch: Partial<AvatarPartState>): AvatarPartState {
    const nextState = {
      ...this.state[key],
      ...patch,
    };
    this.state = {
      ...this.state,
      [key]: nextState,
    };
    return { ...nextState };
  }

  addAccessory(category: AccessoryCategory): AvatarAccessoryInstance | null {
    const definition = getAccessoryCategoryDefinition(category);

    if (definition.options.length === 0) {
      return null;
    }

    const nextOrder = getNextAccessoryOrder(this.state.accessories, definition.defaultLayerSlot);
    const accessory = createDefaultAccessoryInstance(category, nextOrder, definition.defaultLayerSlot);

    this.state = {
      ...this.state,
      accessories: [...this.state.accessories, accessory],
    };

    return { ...accessory };
  }

  updateAccessory(instanceId: string, patch: Partial<AvatarAccessoryInstance>): AvatarAccessoryInstance | null {
    const nextAccessories = this.state.accessories.map(accessory => {
      if (accessory.instanceId !== instanceId) {
        return accessory;
      }

      return {
        ...accessory,
        ...patch,
      };
    });
    const nextAccessory = nextAccessories.find(accessory => accessory.instanceId === instanceId) ?? null;

    this.state = {
      ...this.state,
      accessories: normalizeAccessoryOrders(nextAccessories),
    };

    return nextAccessory ? { ...nextAccessory } : null;
  }

  updateAccessoryPose(
    instanceId: string,
    poseKey: AccessoryPoseKey,
    patch: Partial<AvatarAccessoryPoseState>,
  ): AvatarAccessoryInstance | null {
    if (poseKey === 'portrait') {
      return this.updateAccessory(instanceId, patch);
    }

    const nextAccessories = this.state.accessories.map(accessory => {
      if (accessory.instanceId !== instanceId) {
        return accessory;
      }

      return {
        ...accessory,
        chibi: {
          ...getAccessoryPoseState(accessory, 'chibi'),
          ...patch,
        },
      };
    });
    const nextAccessory = nextAccessories.find(accessory => accessory.instanceId === instanceId) ?? null;

    this.state = {
      ...this.state,
      accessories: nextAccessories,
    };

    return nextAccessory ? { ...nextAccessory } : null;
  }

  removeAccessory(instanceId: string): void {
    this.state = {
      ...this.state,
      accessories: normalizeAccessoryOrders(
        this.state.accessories.filter(accessory => accessory.instanceId !== instanceId)
      ),
    };
  }

  setAccessoryLayerSlot(
    instanceId: string,
    layerSlot: AccessoryLayerSlot,
  ): AvatarAccessoryInstance | null {
    const current = this.state.accessories.find(accessory => accessory.instanceId === instanceId);

    if (!current) {
      return null;
    }

    const nextOrder = getNextAccessoryOrder(
      this.state.accessories.filter(accessory => accessory.instanceId !== instanceId),
      layerSlot
    );

    const nextAccessories = this.state.accessories.map(accessory => {
      if (accessory.instanceId !== instanceId) {
        return accessory;
      }

      return {
        ...accessory,
        layerSlot,
        order: nextOrder,
        chibi: {
          ...getAccessoryPoseState(accessory, 'chibi'),
          layerSlot,
          order: nextOrder,
        },
      };
    });
    const normalizedAccessories = normalizeAccessoryOrders(nextAccessories).map(accessory => (
      accessory.instanceId === instanceId
        ? {
          ...accessory,
          chibi: {
            ...accessory.chibi,
            layerSlot: accessory.layerSlot,
            order: accessory.order,
          },
        }
        : accessory
    ));
    const nextAccessory = normalizedAccessories.find(accessory => accessory.instanceId === instanceId) ?? null;

    this.state = {
      ...this.state,
      accessories: normalizedAccessories,
    };

    return nextAccessory ? { ...nextAccessory } : null;
  }

  reorderAccessoryWithinSlot(sourceInstanceId: string, targetInstanceId: string): void {
    const source = this.state.accessories.find(accessory => accessory.instanceId === sourceInstanceId);
    const target = this.state.accessories.find(accessory => accessory.instanceId === targetInstanceId);

    if (!source || !target || source.layerSlot !== target.layerSlot || source.instanceId === target.instanceId) {
      return;
    }

    const sameSlot = this.state.accessories
      .filter(accessory => accessory.layerSlot === source.layerSlot)
      .sort((first, second) => first.order - second.order);
    const withoutSource = sameSlot.filter(accessory => accessory.instanceId !== sourceInstanceId);
    const targetIndex = withoutSource.findIndex(accessory => accessory.instanceId === targetInstanceId);
    const nextSameSlot = [
      ...withoutSource.slice(0, targetIndex),
      source,
      ...withoutSource.slice(targetIndex),
    ].map((accessory, order) => ({
      ...accessory,
      order,
    }));
    const otherSlots = this.state.accessories.filter(accessory => accessory.layerSlot !== source.layerSlot);

    this.state = {
      ...this.state,
      accessories: [...otherSlots, ...nextSameSlot],
    };
  }

  private mergeInitialState(initialState?: Partial<AvatarState>): AvatarState {
    const defaults = createDefaultAvatarState();

    if (!initialState) {
      return defaults;
    }

    AVATAR_PART_DEFINITIONS.forEach(definition => {
      defaults[definition.key] = {
        ...defaults[definition.key],
        ...initialState[definition.key],
      };
    });

    const initialAccessories = initialState.accessories;

    if (Array.isArray(initialAccessories)) {
      defaults.accessories = normalizeAccessoryOrders(initialAccessories.map(accessory => ({
        ...createDefaultAccessoryInstance(accessory.category ?? 'sideHair', accessory.order ?? 0, accessory.layerSlot),
        ...accessory,
        chibi: {
          ...createDefaultAccessoryPoseState(
            accessory.chibi?.layerSlot ?? accessory.layerSlot,
            accessory.chibi?.order ?? accessory.order ?? 0,
          ),
          ...accessory.chibi,
        },
      })));
      return defaults;
    }

    const legacySideHair = (initialState as Partial<Record<'hair.sideburns', AvatarPartState>>)['hair.sideburns'];

    if (legacySideHair) {
      defaults.accessories = [{
        ...createDefaultAccessoryInstance('sideHair', 0),
        ...legacySideHair,
        chibi: createDefaultAccessoryPoseState('frontFace', 0),
      }];
    }

    return defaults;
  }
}

export class AvatarCanvas {
  private readonly canvas: Canvas;
  private readonly stateStore: AvatarStateStore;
  private readonly partFactory = new AvatarPartFactory();
  private readonly parts = new Map<AvatarPartKey, AvatarPart>();
  private readonly accessoryParts = new Map<string, AvatarPart>();
  private readonly onChange?: (state: AvatarState) => void;
  private readonly faceRenderKeys: readonly AvatarPartKey[] = ['face.color', 'face.line'];
  private readonly width: number;
  private readonly height: number;

  constructor(canvasElement: HTMLCanvasElement | string, options: AvatarCanvasOptions = {}) {
    const width = options.width ?? DEFAULT_CANVAS_WIDTH;
    const height = options.height ?? DEFAULT_CANVAS_HEIGHT;
    this.width = width;
    this.height = height;
    this.onChange = options.onChange;
    this.stateStore = new AvatarStateStore(options.initialState);
    this.canvas = new Canvas(canvasElement, {
      width,
      height,
      backgroundColor: AVATAR_RIG_COLORS.canvasBackground,
      imageSmoothingEnabled: false,
      selection: false,
      preserveObjectStacking: true,
    });

    this.canvas.wrapperEl.style.touchAction = 'none';
    this.canvas.lowerCanvasEl.style.touchAction = 'none';
    this.canvas.lowerCanvasEl.style.imageRendering = 'pixelated';
    this.canvas.upperCanvasEl.style.imageRendering = 'pixelated';
    this.buildAvatar(width, height);
    this.emitChange();
  }

  static mount(container: HTMLElement, options?: AvatarCanvasOptions): AvatarCanvas {
    const canvasElement = document.createElement('canvas');
    container.appendChild(canvasElement);
    return new AvatarCanvas(canvasElement, options);
  }

  getState(): AvatarState {
    return this.stateStore.getSnapshot();
  }

  setState(state: Partial<AvatarState>): void {
    this.stateStore.replaceState(state);
    this.rebuildAvatar();
    this.emitChange();
  }

  getPartState(key: AvatarPartKey): AvatarPartState {
    return this.stateStore.getPartState(key);
  }

  getAccessoryState(instanceId: string): AvatarAccessoryInstance | null {
    return this.stateStore.getAccessoryState(instanceId);
  }

  setOption(key: AvatarPartKey, optionId: number): void {
    this.updatePart(key, { optionId });
  }

  setColor(key: AvatarPartKey, color: string): void {
    this.updatePart(key, { color });
  }

  setSecondaryColor(key: AvatarPartKey, secondaryColor: string): void {
    this.updatePart(key, { secondaryColor });
  }

  setLineColor(key: AvatarPartKey, lineColor: string): void {
    this.updatePart(key, { lineColor });
  }

  setVisible(key: AvatarPartKey, isVisible: boolean): void {
    this.updatePart(key, { isVisible });
  }

  setClothingLayerOrder(key: AvatarPartKey, layerOrder: number): void {
    if (key !== 'mini.clothingTop' && key !== 'mini.clothingBottom') {
      return;
    }

    const counterpartKey: AvatarPartKey = key === 'mini.clothingTop'
      ? 'mini.clothingBottom'
      : 'mini.clothingTop';

    this.stateStore.updatePart(key, { layerOrder });
    this.stateStore.updatePart(counterpartKey, { layerOrder: layerOrder === 1 ? 0 : 1 });
    this.emitChange();
  }

  move(key: AvatarPartKey, deltaX: number, deltaY: number): void {
    const current = this.getPartState(key);
    this.updatePart(key, {
      offsetX: (current.offsetX ?? 0) + deltaX,
      offsetY: getNextPartOffsetY(key, current.offsetY ?? 0, deltaY),
    });
  }

  rotate(key: AvatarPartKey, delta: number): void {
    const current = this.getPartState(key);
    this.updatePart(key, { rotate: (current.rotate ?? 0) + delta });
  }

  scale(key: AvatarPartKey, delta: number): void {
    const current = this.getPartState(key);
    const nextScale = Math.max(0.2, Math.min(3, (current.scale ?? DEFAULT_SCALE) + delta));
    this.updatePart(key, { scale: Number(nextScale.toFixed(2)) });
  }

  flip(key: AvatarPartKey): void {
    const current = this.getPartState(key);
    this.updatePart(key, { flipX: current.flipX !== true });
  }

  setSideVisible(key: AvatarPartKey, side: 'left' | 'right', isVisible: boolean): void {
    this.updatePart(key, side === 'left' ? { leftVisible: isVisible } : { rightVisible: isVisible });
  }

  setLightDistance(key: AvatarPartKey, lightDistance: number): void {
    this.updatePart(key, { lightDistance: Math.max(0, Math.min(120, Math.round(lightDistance))) });
  }

  addAccessory(category: AccessoryCategory): string | null {
    const accessory = this.stateStore.addAccessory(category);

    if (!accessory) {
      return null;
    }

    this.rebuildAvatar();
    this.emitChange();
    return accessory.instanceId;
  }

  removeAccessory(instanceId: string): void {
    this.stateStore.removeAccessory(instanceId);
    this.rebuildAvatar();
    this.emitChange();
  }

  setAccessoryOption(instanceId: string, optionId: number): void {
    this.updateAccessory(instanceId, { optionId });
  }

  setAccessoryColor(instanceId: string, color: string): void {
    this.updateAccessory(instanceId, { color });
  }

  setAccessoryLineColor(instanceId: string, lineColor: string): void {
    this.updateAccessory(instanceId, { lineColor });
  }

  moveAccessory(
    instanceId: string,
    deltaX: number,
    deltaY: number,
    poseKey: AccessoryPoseKey = 'portrait',
  ): void {
    const current = this.getAccessoryState(instanceId);

    if (!current) {
      return;
    }
    const pose = getAccessoryPoseState(current, poseKey);

    this.updateAccessoryPose(instanceId, poseKey, {
      offsetX: pose.offsetX + deltaX,
      offsetY: pose.offsetY + deltaY,
    });
  }

  rotateAccessory(instanceId: string, delta: number, poseKey: AccessoryPoseKey = 'portrait'): void {
    const current = this.getAccessoryState(instanceId);

    if (!current) {
      return;
    }
    const pose = getAccessoryPoseState(current, poseKey);

    this.updateAccessoryPose(instanceId, poseKey, { rotate: pose.rotate + delta });
  }

  scaleAccessory(instanceId: string, delta: number, poseKey: AccessoryPoseKey = 'portrait'): void {
    const current = this.getAccessoryState(instanceId);

    if (!current) {
      return;
    }
    const pose = getAccessoryPoseState(current, poseKey);

    const nextScale = Math.max(0.2, Math.min(3, pose.scale + delta));
    this.updateAccessoryPose(instanceId, poseKey, { scale: Number(nextScale.toFixed(2)) });
  }

  flipAccessory(instanceId: string, poseKey: AccessoryPoseKey = 'portrait'): void {
    const current = this.getAccessoryState(instanceId);

    if (!current) {
      return;
    }
    const pose = getAccessoryPoseState(current, poseKey);
    const nextFlipX = pose.flipX !== true;

    this.updateAccessory(instanceId, {
      flipX: nextFlipX,
      chibi: {
        ...getAccessoryPoseState(current, 'chibi'),
        flipX: nextFlipX,
      },
    });
  }

  setAccessorySideVisible(
    instanceId: string,
    side: 'left' | 'right',
    isVisible: boolean,
  ): void {
    const current = this.getAccessoryState(instanceId);

    if (!current) {
      return;
    }

    const visibilityPatch = side === 'left'
      ? { leftVisible: isVisible }
      : { rightVisible: isVisible };

    this.updateAccessory(instanceId, {
      ...visibilityPatch,
      chibi: {
        ...getAccessoryPoseState(current, 'chibi'),
        ...visibilityPatch,
      },
    });
  }

  setAccessoryLayerSlot(
    instanceId: string,
    layerSlot: AccessoryLayerSlot,
  ): void {
    const accessory = this.stateStore.setAccessoryLayerSlot(instanceId, layerSlot);

    if (!accessory) {
      return;
    }

    this.rebuildAvatar();

    this.emitChange();
  }

  estimateAccessoryChibiPoseFromPortrait(instanceId: string): void {
    const accessory = this.getAccessoryState(instanceId);

    if (!accessory) {
      return;
    }

    const portraitPose = getAccessoryPoseState(accessory, 'portrait');
    const positionScale = getChibiAccessoryPositionScale(accessory.category);
    this.updateAccessoryPose(instanceId, 'chibi', {
      ...portraitPose,
      offsetX: Math.round(portraitPose.offsetX * positionScale),
      offsetY: Math.round(portraitPose.offsetY * positionScale),
    });
  }

  reorderAccessoryWithinSlot(sourceInstanceId: string, targetInstanceId: string): void {
    this.stateStore.reorderAccessoryWithinSlot(sourceInstanceId, targetInstanceId);
    this.rebuildAvatar();
    this.emitChange();
  }

  destroy(): Promise<boolean> {
    return this.canvas.dispose();
  }

  private buildAvatar(width: number, height: number): void {
    this.parts.clear();
    this.accessoryParts.clear();

    const context: AvatarPartContext = {
      width,
      height,
      centerX: width / 2,
      faceCenterY: height / 2 + 26,
      getGroupState: key => this.stateStore.getPartState(key),
      getPartState: key => this.stateStore.getPartState(key),
    };

    const renderItems = [
      ...AVATAR_PART_DEFINITIONS.filter(definition => definition.renderInPortrait !== false).map(definition => ({
        zIndex: definition.zIndex,
        render: () => {
          const state = this.isFaceRenderKey(definition.key)
            ? this.stateStore.getPartState('face')
            : this.stateStore.getPartState(definition.key);
          const part = this.partFactory.create(definition, context, state);
          this.parts.set(definition.key, part);
          this.canvas.add(part.createObject());
        },
      })),
      ...this.stateStore.getAccessories().map(accessory => ({
        zIndex: getAccessoryZIndex(accessory),
        render: () => {
          const part = this.partFactory.createAccessory(context, accessory);
          this.accessoryParts.set(accessory.instanceId, part);
          this.canvas.add(part.createObject());
        },
      })),
    ];

    renderItems
      .sort((first, second) => first.zIndex - second.zIndex)
      .forEach(item => item.render());

    this.canvas.requestRenderAll();
  }

  private updateAccessory(instanceId: string, patch: Partial<AvatarAccessoryInstance>): void {
    const nextState = this.stateStore.updateAccessory(instanceId, patch);

    if (!nextState) {
      return;
    }

    this.accessoryParts.get(instanceId)?.update(nextState);
    this.canvas.requestRenderAll();
    this.emitChange();
  }

  private updateAccessoryPose(
    instanceId: string,
    poseKey: AccessoryPoseKey,
    patch: Partial<AvatarAccessoryPoseState>,
  ): void {
    if (poseKey === 'portrait') {
      this.updateAccessory(instanceId, patch);
      return;
    }

    const nextState = this.stateStore.updateAccessoryPose(instanceId, poseKey, patch);

    if (!nextState) {
      return;
    }

    this.emitChange();
  }

  private rebuildAvatar(): void {
    const objects = this.canvas.getObjects();

    if (objects.length > 0) {
      this.canvas.remove(...objects);
    }

    this.buildAvatar(this.width, this.height);
  }

  private updatePart(key: AvatarPartKey, patch: Partial<AvatarPartState>): void {
    const nextState = this.stateStore.updatePart(key, patch);
    const part = this.parts.get(key);
    part?.update(nextState);

    if (this.isGroupKey(key)) {
      this.refreshGroupChildren(key);
    }

    if (key === 'face') {
      this.refreshFaceRenderParts();
      this.parts.get('ear')?.refreshArtwork();
      this.parts.get('eyes.upperEyelid')?.refreshArtwork();
      this.parts.get('eyes.lowerEyelid')?.refreshArtwork();
    }

    this.canvas.requestRenderAll();
    this.emitChange();
  }

  private refreshGroupChildren(groupKey: AvatarGroupKey): void {
    AVATAR_PART_DEFINITIONS
      .filter(definition => definition.parentKey === groupKey)
      .forEach(definition => this.parts.get(definition.key)?.refreshParentTransform());

    if (groupKey === 'hair') {
      this.accessoryParts.forEach(part => part.refreshParentTransform());
    }
  }

  private isGroupKey(key: AvatarPartKey): key is AvatarGroupKey {
    return key === 'eyes' || key === 'hair';
  }

  private isFaceRenderKey(key: AvatarPartKey): boolean {
    return this.faceRenderKeys.includes(key);
  }

  private refreshFaceRenderParts(): void {
    const faceState = this.stateStore.getPartState('face');

    this.faceRenderKeys.forEach(key => this.parts.get(key)?.update(faceState));
  }

  private emitChange(): void {
    this.onChange?.(this.getState());
  }
}

function createLineAndColorLayers(folder: string, optionId: string): AvatarImageLayer[] {
  return [
    { folder, file: `${optionId}_color.png`, tint: 'color' },
    { folder, file: `${optionId}_line.png`, tint: 'line' },
  ];
}

function createSkinAndLineLayers(
  folder: string,
  optionId: string,
  shouldDropLightLinePixels = false,
): AvatarImageLayer[] {
  return [
    { folder, file: `${optionId}_color.png`, tint: 'skin' },
    { folder, file: `${optionId}_line.png`, tint: 'line', shouldDropLightPixels: shouldDropLightLinePixels },
  ];
}

function createOptionalLineAndColorLayers(
  folder: string,
  optionId: string,
  fallbackLineFile: string,
): AvatarImageLayer[] {
  const colorFile = `${optionId}_color.png`;
  const lineFile = `${optionId}_line.png`;
  const layers: AvatarImageLayer[] = [];

  if (hasAvatarAsset(folder, colorFile)) {
    layers.push({ folder, file: colorFile, tint: 'color' });
  }

  if (hasAvatarAsset(folder, lineFile)) {
    layers.push({ folder, file: lineFile, tint: 'line' });
  } else if (hasAvatarAsset(folder, fallbackLineFile)) {
    layers.push({ folder, file: fallbackLineFile, tint: 'line' });
  }

  return layers;
}

function hasAvatarAsset(folder: string, file: string): boolean {
  const assetPath = `../assets/avatar_system/${folder}/${file}`;
  return avatarAssetUrls[assetPath] !== undefined;
}

function createAssetOptionDefinitions(folder: string, label: string): AvatarPartOption[] {
  const optionIds = new Set<number>();
  const assetPathPattern = new RegExp(`^\\.\\./assets/avatar_system/${folder}/(\\d+)(?:_(?:color|line))?\\.png$`);

  Object.keys(avatarAssetUrls).forEach(assetPath => {
    const match = assetPath.match(assetPathPattern);

    if (!match) {
      return;
    }

    optionIds.add(Number(match[1]));
  });

  return [...optionIds]
    .sort((first, second) => first - second)
    .map(id => ({
      id,
      label: `${label} ${id}`,
    }));
}

function createMiniDirectoryOptionDefinitions(
  folder: string,
  label: string,
  nonTintableOptionIds = new Set<number>(),
): AvatarPartOption[] {
  const optionIds = new Set<number>();
  const assetPathPattern = new RegExp(`^\\.\\./assets/avatar_system/mini/${folder}/(\\d+)/`);

  Object.keys(avatarAssetUrls).forEach(assetPath => {
    const match = assetPath.match(assetPathPattern);

    if (!match) {
      return;
    }

    optionIds.add(Number(match[1]));
  });

  return [...optionIds]
    .sort((first, second) => first - second)
    .map(id => ({
      id,
      label: `${label} ${id}`,
      isColorEditable: !nonTintableOptionIds.has(id),
    }));
}

function getNextAccessoryOrder(accessories: AvatarAccessoryInstance[], layerSlot: AccessoryLayerSlot): number {
  const sameSlotOrders = accessories
    .filter(accessory => accessory.layerSlot === layerSlot)
    .map(accessory => accessory.order);

  return sameSlotOrders.length === 0 ? 0 : Math.max(...sameSlotOrders) + 1;
}

function normalizeAccessoryOrders(accessories: AvatarAccessoryInstance[]): AvatarAccessoryInstance[] {
  return ACCESSORY_LAYER_SLOT_DEFINITIONS.flatMap(slotDefinition => accessories
    .filter(accessory => accessory.layerSlot === slotDefinition.id)
    .sort((first, second) => first.order - second.order)
    .map((accessory, order) => ({
      ...accessory,
      order,
    })));
}

function getChibiAccessoryPositionScale(category: AccessoryCategory): number {
  return category === 'sideHair'
    ? CHIBI_SIDE_HAIR_POSITION_SCALE
    : CHIBI_ACCESSORY_POSITION_SCALE;
}

function getAvatarAssetUrl(folder: string, file: string): string {
  const normalizedFile = file.replace('__right', '');
  const assetPath = `../assets/avatar_system/${folder}/${normalizedFile}`;
  const url = avatarAssetUrls[assetPath];

  if (!url) {
    throw new Error(`Avatar asset not found: ${assetPath}`);
  }

  return url;
}

function formatOptionId(optionId: number): string {
  return String(optionId).padStart(2, '0');
}

function rotatePoint(point: Point2D, degrees: number): Point2D {
  const radians = degrees * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

async function tintImageByLuminance(
  imageUrl: string,
  color: string,
  tint: 'color' | 'line' | 'skin',
  shouldNormalizeToSourceBrightness = false,
  shouldDropLightPixels = false,
): Promise<string> {
  const cacheKey = `${imageUrl}|${color}|${tint}|${shouldNormalizeToSourceBrightness}|${shouldDropLightPixels}`;
  const cachedUrl = tintCache.get(cacheKey);

  if (cachedUrl) {
    return cachedUrl;
  }

  const sourceImage = await loadImageElement(imageUrl);
  const canvas = document.createElement('canvas');
  canvas.width = sourceImage.naturalWidth;
  canvas.height = sourceImage.naturalHeight;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Unable to create avatar tint canvas context.');
  }

  context.imageSmoothingEnabled = false;
  context.drawImage(sourceImage, 0, 0);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const targetColor = parseHexColor(color);
  const maxLuminance = getMaxLuminance(imageData);
  const shouldUseAlphaMask = tint === 'skin' || (tint === 'line' && maxLuminance <= BLACK_MASK_MAX_LUMINANCE);

  for (let index = 0; index < imageData.data.length; index += 4) {
    const alpha = imageData.data[index + 3];

    if (alpha === 0) {
      continue;
    }

    const red = imageData.data[index];
    const green = imageData.data[index + 1];
    const blue = imageData.data[index + 2];
    const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;

    if (shouldDropLightPixels && luminance > LINE_LAYER_FILL_LUMINANCE_THRESHOLD) {
      imageData.data[index + 3] = 0;
      continue;
    }

    const baseLuminance = shouldNormalizeToSourceBrightness
      ? Math.max(maxLuminance, 1)
      : BASE_TINT_LUMINANCE;
    const shade = shouldUseAlphaMask ? alpha / 255 : luminance / baseLuminance;

    imageData.data[index] = clampColor(targetColor.red * shade);
    imageData.data[index + 1] = clampColor(targetColor.green * shade);
    imageData.data[index + 2] = clampColor(targetColor.blue * shade);
  }

  context.putImageData(imageData, 0, 0);

  const tintedUrl = canvas.toDataURL('image/png');
  tintCache.set(cacheKey, tintedUrl);
  return tintedUrl;
}

function getMaxLuminance(imageData: ImageData): number {
  let maxLuminance = 0;

  for (let index = 0; index < imageData.data.length; index += 4) {
    const alpha = imageData.data[index + 3];

    if (alpha === 0) {
      continue;
    }

    const red = imageData.data[index];
    const green = imageData.data[index + 1];
    const blue = imageData.data[index + 2];
    const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;
    maxLuminance = Math.max(maxLuminance, luminance);
  }

  return maxLuminance;
}

function loadImageElement(imageUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load avatar image: ${imageUrl}`));
    image.src = imageUrl;
  });
}

function parseHexColor(color: string): { red: number; green: number; blue: number } {
  const normalizedColor = color.replace('#', '');

  if (!/^[0-9a-fA-F]{6}$/.test(normalizedColor)) {
    return { red: 38, green: 38, blue: 38 };
  }

  return {
    red: Number.parseInt(normalizedColor.slice(0, 2), 16),
    green: Number.parseInt(normalizedColor.slice(2, 4), 16),
    blue: Number.parseInt(normalizedColor.slice(4, 6), 16),
  };
}

function clampColor(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function getNextPartOffsetY(key: AvatarPartKey, currentOffsetY: number, deltaY: number): number {
  const nextOffsetY = currentOffsetY + deltaY;

  if (key !== 'mini.upperEyelid') {
    return nextOffsetY;
  }

  return Math.max(
    MINI_UPPER_EYELID_OFFSET_Y_LIMITS.min,
    Math.min(MINI_UPPER_EYELID_OFFSET_Y_LIMITS.max, nextOffsetY),
  );
}
