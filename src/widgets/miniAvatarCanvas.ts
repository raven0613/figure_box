import { Canvas, FabricImage } from 'fabric';

import { AVATAR_RIG_COLORS } from '../constants/avatarRig';
import {
  createDefaultAvatarState,
  getAccessoryCategoryDefinition,
  getAccessoryLayerSlotDefinition,
  getAccessoryPoseState,
} from './avatarCanvas';
import type {
  AccessoryLayerSlot,
  AccessoryRenderMode,
  AvatarAccessoryInstance,
  AvatarPartKey,
  AvatarState,
} from './avatarCanvas';

interface MiniAvatarCanvasOptions {
  width?: number;
  height?: number;
  initialState?: AvatarState;
}

interface MiniLayer {
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

interface MiniPoint {
  x: number;
  y: number;
}

interface MiniBodyRigLayout {
  body: MiniPoint;
  armIdleDistance: number;
  armIdleOffset: MiniPoint;
  legDistance: number;
  legOffset: MiniPoint;
}

interface MiniEyeRigLayout {
  eyeDistance: number;
  sclera: MiniPoint;
  lowerEyelid: MiniPoint;
  eyeBall: MiniPoint;
  eyeLight: MiniPoint;
  upperEyeLid: MiniPoint;
  eyebrow: MiniPoint;
}

interface MiniHairRigLayout {
  backHairBottom: MiniPoint;
  backHairTop: MiniPoint;
  bangs: MiniPoint;
  hairLight: MiniPoint;
}

interface MiniAccessoryRigLayout {
  center: MiniPoint;
  mirrored: MiniPoint;
  mirroredDistance: number;
}

type MiniColorRigLayout = typeof AVATAR_RIG_COLORS;

interface MiniFrontIdleRigLayout {
  bodyTypeId: number;
  headCenter: MiniPoint;
  bodyCenter: MiniPoint;
  earDistance: number;
  ear: MiniPoint;
  mouth: MiniPoint;
  bodyByType: Record<number, MiniBodyRigLayout>;
  eyes: MiniEyeRigLayout;
  hair: MiniHairRigLayout;
  accessories: MiniAccessoryRigLayout;
  colors: MiniColorRigLayout;
}

const MINI_CANVAS_WIDTH = 172;
const MINI_CANVAS_HEIGHT = 172;
const MINI_PIXEL_SCALE = 2;
const MINI_CENTER_X = MINI_CANVAS_WIDTH / 2;
const MINI_BASE_TINT_LUMINANCE = 128;
const MINI_EYE_LIGHT_UPPER_LID_GAP = MINI_PIXEL_SCALE;
const MINI_ACCESSORY_ORDER_STEP = 0.01;
const MINI_ACCESSORY_SLOT_Z_INDEX: Record<AccessoryLayerSlot, number> = {
  behindBody: -1,
  onSkin: 2.25,
  frontBody: 2.5,
  frontFace: 29,
  frontBangs: 32,
};

// 2x
const MINI_FRONT_IDLE_RIG_LAYOUT: MiniFrontIdleRigLayout = {
  bodyTypeId: 1,
  headCenter: { x: 0, y: 58 },
  bodyCenter: { x: 0, y: 108 },
  earDistance: 39,
  ear: { x: -6.5, y: 6 },
  mouth: { x: 0, y: 9 },
  bodyByType: {
    1: {
      body: { x: 0, y: 0 },
      armIdleDistance: 9,
      armIdleOffset: { x: 0, y: -4 },
      legDistance: 7,
      legOffset: { x: 0, y: 6.5 },
    },
    2: {
      body: { x: 0, y: 0 },
      armIdleDistance: 9,
      armIdleOffset: { x: 0, y: -1 },
      legDistance: 6,
      legOffset: { x: 0, y: 7.5 },
    },
    3: {
      body: { x: 0, y: 0 },
      armIdleDistance: 17,
      armIdleOffset: { x: 0, y: 0 },
      legDistance: 6,
      legOffset: { x: 0, y: 8.5 },
    },
    4: {
      body: { x: 0, y: 0 },
      armIdleDistance: 17,
      armIdleOffset: { x: 0, y: 1 },
      legDistance: 6,
      legOffset: { x: 0, y: 9.5 },
    },
    5: {
      body: { x: 0, y: 0 },
      armIdleDistance: 17,
      armIdleOffset: { x: 0, y: 2 },
      legDistance: 6,
      legOffset: { x: 0, y: 10.5 },
    },
  },
  eyes: {
    eyeDistance: 11,
    sclera: { x: 0, y: 5 },
    lowerEyelid: { x: 0, y: 5 },
    eyeBall: { x: -1, y: 4.5 },
    eyeLight: { x: -0.5, y: -1.5 },
    upperEyeLid: { x: 0, y: 1.5 },
    eyebrow: { x: -0.5, y: 1 },
  },
  hair: {
    backHairTop: { x: 0, y: -6 }, // -6
    backHairBottom: { x: 0, y: 8.5 },
    bangs: { x: 0, y: -3.5 }, // -3.5
    hairLight: { x: 0, y: -10 },
  },
  accessories: {
    center: { x: 0, y: 0 },
    mirrored: { x: 0, y: 5.5 },
    mirroredDistance: 23,
  },
  colors: AVATAR_RIG_COLORS,
};

const miniTintCache = new Map<string, string>();
const miniContentBoundsCache = new Map<string, Promise<MiniImageContentBounds>>();

const miniAvatarAssetUrls = import.meta.glob<string>('../assets/avatar_system/mini/**/*.png', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

export class MiniAvatarCanvas {
  private readonly canvas: Canvas;
  private state: AvatarState;
  private renderVersion = 0;

  constructor(canvasElement: HTMLCanvasElement | string, options: MiniAvatarCanvasOptions = {}) {
    const width = options.width ?? MINI_CANVAS_WIDTH;
    const height = options.height ?? MINI_CANVAS_HEIGHT;
    this.state = options.initialState ?? createDefaultAvatarState();
    this.canvas = new Canvas(canvasElement, {
      width,
      height,
      backgroundColor: MINI_FRONT_IDLE_RIG_LAYOUT.colors.canvasBackground,
      imageSmoothingEnabled: false,
      selection: false,
      preserveObjectStacking: true,
    });

    this.canvas.wrapperEl.style.touchAction = 'none';
    this.canvas.lowerCanvasEl.style.touchAction = 'none';
    this.canvas.lowerCanvasEl.style.imageRendering = 'pixelated';
    this.canvas.upperCanvasEl.style.imageRendering = 'pixelated';
    void this.render();
  }

  static mount(container: HTMLElement, options?: MiniAvatarCanvasOptions): MiniAvatarCanvas {
    const canvasElement = document.createElement('canvas');
    container.appendChild(canvasElement);
    return new MiniAvatarCanvas(canvasElement, options);
  }

  setState(state: AvatarState): void {
    this.state = state;
    void this.render();
  }

  destroy(): Promise<boolean> {
    return this.canvas.dispose();
  }

  private async render(): Promise<void> {
    const currentRenderVersion = this.renderVersion + 1;
    this.renderVersion = currentRenderVersion;
    this.canvas.remove(...this.canvas.getObjects());

    const images = await Promise.all(
      (await this.createLayers())
        .sort((first, second) => first.zIndex - second.zIndex)
        .map(layer => this.createImage(layer)),
    );

    if (currentRenderVersion !== this.renderVersion) {
      return;
    }

    this.canvas.add(...images);
    this.canvas.requestRenderAll();
  }

  private async createImage(layer: MiniLayer): Promise<FabricImage> {
    const assetUrl = getMiniAvatarAssetUrl(layer.folder, layer.file);
    const imageUrl = layer.color
      ? await tintMiniImageByLuminance(assetUrl, layer.color)
      : assetUrl;
    const image = await FabricImage.fromURL(imageUrl);
    image.set({
      left: layer.x,
      top: layer.y,
      angle: layer.angle ?? 0,
      flipX: layer.flipX === true,
      scaleX: MINI_PIXEL_SCALE * (layer.scale ?? 1),
      scaleY: MINI_PIXEL_SCALE * (layer.scale ?? 1),
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      objectCaching: false,
      imageSmoothing: false,
    });
    return image;
  }

  private async createLayers(): Promise<MiniLayer[]> {
    const rig = MINI_FRONT_IDLE_RIG_LAYOUT;
    const bodyTypeId = rig.bodyTypeId;
    const bodyOptionId = formatMiniOptionId(bodyTypeId);
    const skinColor = this.getPartColor('face', rig.colors.skin);
    const skinLineColor = this.getPartLineColor('face');
    const backHairBottomId = this.resolveOptionId('back_hair_bottom', this.getPartOptionId('hair.backHair'));
    const backHairTopId = this.resolveOptionId('back_hair_top', this.getPartOptionId('hair.topHair'));
    const bangsId = this.resolveOptionId('bangs', this.getPartOptionId('hair.bangs'));
    const bodyRig = rig.bodyByType[bodyTypeId] ?? rig.bodyByType[1];
    const headCenter = getMiniCanvasPoint(rig.headCenter);
    const bodyCenter = getMiniCanvasPoint(rig.bodyCenter);
    const bodyOffset = getMiniScaledOffset(bodyRig.body);
    const legOffset = getMiniScaledOffset(bodyRig.legOffset);
    const armIdleOffset = getMiniScaledOffset(bodyRig.armIdleOffset);
    const earOffset = getMiniScaledOffset(rig.ear);
    const mouthOffset = getMiniScaledOffset(rig.mouth);
    const backHairBottomOffset = getMiniScaledOffset(rig.hair.backHairBottom);
    const backHairTopOffset = getMiniScaledOffset(rig.hair.backHairTop);
    const bangsOffset = getMiniScaledOffset(rig.hair.bangs);
    const hairLightOffset = getMiniScaledOffset(rig.hair.hairLight);
    const scleraOffset = getMiniScaledOffset(rig.eyes.sclera);
    const lowerEyelidOffset = getMiniScaledOffset(rig.eyes.lowerEyelid);
    const eyeBallOffset = getMiniScaledOffset(rig.eyes.eyeBall);
    const requestedEyeLightOffset = getMiniScaledOffset(rig.eyes.eyeLight);
    const upperLidOffset = getMiniScaledOffset(rig.eyes.upperEyeLid);
    const eyebrowOffset = getMiniScaledOffset(rig.eyes.eyebrow);
    const accessoryBases: Record<AccessoryRenderMode, MiniPoint> = {
      center: addMiniPoints(headCenter, getMiniScaledOffset(rig.accessories.center)),
      mirrored: addMiniPoints(headCenter, getMiniScaledOffset(rig.accessories.mirrored)),
    };
    const upperLidY = headCenter.y + upperLidOffset.y;
    const eyeBallY = headCenter.y + eyeBallOffset.y;
    const scleraColor = this.getPartColor('eyes.sclera', rig.colors.sclera);
    const leftEyeColor = this.getPartColor('eyes.color', rig.colors.eyeBall);
    const rightEyeColor = this.getPartSecondaryColor('eyes.color', leftEyeColor);
    const eyeLightY = await getConstrainedMiniEyeLightY({
      requestedY: eyeBallY + requestedEyeLightOffset.y,
      upperLidY,
      upperLidFiles: ['01_color.png', '01_line.png', '01_deco.png'],
      eyeLightFile: '01_line.png',
    });

    return [
      ...this.createAccessoryLayers(accessoryBases),
      ...this.createMirroredColorAndLineLayers(
        'leg',
        '01',
        skinColor,
        skinLineColor,
        bodyRig.legDistance,
        bodyCenter.y + legOffset.y,
        0,
      ),
      ...this.createMirroredColorAndLineLayers(
        'arm_idle',
        '01',
        skinColor,
        skinLineColor,
        bodyRig.armIdleDistance + armIdleOffset.x,
        bodyCenter.y + armIdleOffset.y,
        1,
      ),
      ...this.createColorAndLineLayers('body', bodyOptionId, skinColor, skinLineColor, bodyCenter.x + bodyOffset.x, bodyCenter.y + bodyOffset.y, 2),
      ...this.createColorAndLineLayers(
        'back_hair_bottom',
        backHairBottomId,
        this.getPartColor('hair.backHair', rig.colors.hair),
        this.getPartLineColor('hair.backHair'),
        headCenter.x + backHairBottomOffset.x,
        headCenter.y + backHairBottomOffset.y,
        10,
      ),
      ...this.createColorAndLineLayers('face', '01', skinColor, skinLineColor, headCenter.x, headCenter.y, 13),
      ...this.createColorAndLineLayers(
        'back_hair_top',
        backHairTopId,
        this.getPartColor('hair.topHair', rig.colors.hair),
        this.getPartLineColor('hair.topHair'),
        headCenter.x + backHairTopOffset.x,
        headCenter.y + backHairTopOffset.y,
        13.5,
      ),
      ...this.createMirroredColorAndLineLayers('ear', '01', skinColor, skinLineColor, rig.earDistance + earOffset.x, headCenter.y + earOffset.y, 13.8),
      ...this.createMirroredColorOnlyLayers(
        'sclera',
        '01',
        scleraColor,
        scleraColor,
        rig.eyes.eyeDistance + scleraOffset.x,
        headCenter.y + scleraOffset.y,
        13.9,
      ),
      ...this.createMirroredColorAndLineLayers(
        'lower_eyelid',
        '01',
        rig.colors.lowerEyelidColor,
        this.getPartLineColor('eyes.lowerEyelid'),
        rig.eyes.eyeDistance + lowerEyelidOffset.x,
        headCenter.y + lowerEyelidOffset.y,
        14,
      ),
      ...this.createMirroredColorOnlyLayers(
        'eye_ball',
        '01',
        leftEyeColor,
        rightEyeColor,
        rig.eyes.eyeDistance + eyeBallOffset.x,
        eyeBallY,
        15,
      ),
      ...this.createMirroredLineOnlyLayers(
        'eye_light',
        '01',
        rig.colors.eyeLight,
        rig.eyes.eyeDistance + eyeBallOffset.x + requestedEyeLightOffset.x,
        eyeLightY,
        16,
      ),
      ...this.createMirroredColorAndLineLayers(
        'upper_eyelid',
        '01',
        skinColor,
        this.getPartLineColor('eyes.upperEyelid'),
        rig.eyes.eyeDistance + upperLidOffset.x,
        headCenter.y + upperLidOffset.y,
        17,
      ),
      ...this.createMirroredSingleFileLayers(
        'upper_eyelid',
        '01_deco.png',
        leftEyeColor,
        rightEyeColor,
        rig.eyes.eyeDistance + upperLidOffset.x,
        headCenter.y + upperLidOffset.y,
        17.2,
      ),
      ...this.createMirroredLineOnlyLayers(
        'eyelid',
        '01',
        this.getPartLineColor('eyes.eyelid'),
        rig.eyes.eyeDistance + upperLidOffset.x,
        headCenter.y + upperLidOffset.y,
        18,
      ),
      ...this.createMirroredLineOnlyLayers(
        'eyebrow',
        '01',
        this.getPartLineColor('eyes.eyebrow'),
        rig.eyes.eyeDistance + eyebrowOffset.x,
        headCenter.y + eyebrowOffset.y,
        19,
      ),
      ...this.createLineOnlyLayers('mouth', '01', this.getPartLineColor('mouth'), headCenter.x + mouthOffset.x, headCenter.y + mouthOffset.y, 20),
      ...this.createColorAndLineLayers(
        'bangs',
        bangsId,
        this.getPartColor('hair.bangs', rig.colors.hair),
        this.getPartLineColor('hair.bangs'),
        headCenter.x + bangsOffset.x,
        headCenter.y + bangsOffset.y,
        30,
      ),
      ...this.createLineOnlyLayers('hair_light', '01', rig.colors.hairLight, headCenter.x + hairLightOffset.x, headCenter.y + hairLightOffset.y, 31),
    ];
  }

  private createColorAndLineLayers(
    folder: string,
    optionId: string,
    color: string,
    lineColor: string,
    x: number,
    y: number,
    zIndex: number,
  ): MiniLayer[] {
    return [
      { folder, file: `${optionId}_color.png`, color, x, y, zIndex },
      { folder, file: `${optionId}_line.png`, color: lineColor, x, y, zIndex: zIndex + 0.1 },
    ].filter(layer => hasMiniAvatarAsset(layer.folder, layer.file));
  }

  private createLineOnlyLayers(
    folder: string,
    optionId: string,
    color: string,
    x: number,
    y: number,
    zIndex: number,
  ): MiniLayer[] {
    const file = `${optionId}_line.png`;
    return hasMiniAvatarAsset(folder, file)
      ? [{ folder, file, color, x, y, zIndex }]
      : [];
  }

  private createMirroredColorAndLineLayers(
    folder: string,
    optionId: string,
    color: string,
    lineColor: string,
    distance: number,
    y: number,
    zIndex: number,
  ): MiniLayer[] {
    return [
      ...this.createMirroredColorOnlyLayers(folder, optionId, color, color, distance, y, zIndex),
      ...this.createMirroredLineOnlyLayers(folder, optionId, lineColor, distance, y, zIndex + 0.1),
    ];
  }

  private createMirroredColorOnlyLayers(
    folder: string,
    optionId: string,
    leftColor: string,
    rightColor: string | undefined,
    distance: number,
    y: number,
    zIndex: number,
  ): MiniLayer[] {
    const file = `${optionId}_color.png`;

    if (!hasMiniAvatarAsset(folder, file)) {
      return [];
    }

    return createMirroredMiniLayers(folder, file, leftColor, rightColor ?? leftColor, distance, y, zIndex);
  }

  private createMirroredLineOnlyLayers(
    folder: string,
    optionId: string,
    color: string,
    distance: number,
    y: number,
    zIndex: number,
  ): MiniLayer[] {
    const file = `${optionId}_line.png`;

    if (!hasMiniAvatarAsset(folder, file)) {
      return [];
    }

    return createMirroredMiniLayers(folder, file, color, color, distance, y, zIndex);
  }

  private createMirroredSingleFileLayers(
    folder: string,
    file: string,
    leftColor: string,
    rightColor: string | undefined,
    distance: number,
    y: number,
    zIndex: number,
  ): MiniLayer[] {
    if (!hasMiniAvatarAsset(folder, file)) {
      return [];
    }

    return createMirroredMiniLayers(folder, file, leftColor, rightColor ?? leftColor, distance, y, zIndex);
  }

  private createAccessoryLayers(bases: Record<AccessoryRenderMode, MiniPoint>): MiniLayer[] {
    return this.state.accessories.flatMap(accessory => {
      const definition = getAccessoryCategoryDefinition(accessory.category);
      const pose = getAccessoryPoseState(accessory, 'chibi');
      const base = bases[definition.renderMode];
      const optionId = formatMiniOptionId(accessory.optionId);
      const zIndex = getMiniAccessoryZIndex(pose.layerSlot, pose.order);
      const folder = definition.assetFolder;

      if (definition.renderMode === 'mirrored') {
        return [
          ...this.createAccessorySideLayers(accessory, folder, optionId, -1, base, zIndex),
          ...this.createAccessorySideLayers(accessory, folder, optionId, 1, base, zIndex),
        ];
      }

      return [
        ...this.createAccessoryImageLayers(folder, optionId, accessory.color ?? definition.defaultColor, accessory.lineColor ?? definition.defaultLineColor, {
          x: base.x + pose.offsetX * MINI_PIXEL_SCALE,
          y: base.y + pose.offsetY * MINI_PIXEL_SCALE,
          zIndex,
          angle: pose.rotate,
          scale: pose.scale,
          flipX: pose.flipX,
        }),
      ];
    });
  }

  private createAccessorySideLayers(
    accessory: AvatarAccessoryInstance,
    folder: string,
    optionId: string,
    side: -1 | 1,
    base: MiniPoint,
    zIndex: number,
  ): MiniLayer[] {
    const definition = getAccessoryCategoryDefinition(accessory.category);
    const pose = getAccessoryPoseState(accessory, 'chibi');

    if ((side === -1 && pose.leftVisible === false) || (side === 1 && pose.rightVisible === false)) {
      return [];
    }

    return this.createAccessoryImageLayers(folder, optionId, accessory.color ?? definition.defaultColor, accessory.lineColor ?? definition.defaultLineColor, {
      x: base.x + side * (MINI_FRONT_IDLE_RIG_LAYOUT.accessories.mirroredDistance + pose.offsetX * MINI_PIXEL_SCALE),
      y: base.y + pose.offsetY * MINI_PIXEL_SCALE,
      zIndex,
      angle: side * pose.rotate,
      scale: pose.scale,
      flipX: getMiniMirroredAccessoryFlipX(side, pose.flipX),
    });
  }

  private createAccessoryImageLayers(
    folder: string,
    optionId: string,
    color: string,
    lineColor: string,
    transform: Pick<MiniLayer, 'x' | 'y' | 'zIndex' | 'angle' | 'scale' | 'flipX'>,
  ): MiniLayer[] {
    return [
      { folder, file: `${optionId}_color.png`, color, ...transform },
      { folder, file: `${optionId}_line.png`, color: lineColor, ...transform, zIndex: transform.zIndex + 0.1 },
    ].filter(layer => hasMiniAvatarAsset(layer.folder, layer.file));
  }

  private getPartOptionId(key: AvatarPartKey): number {
    return this.state[key].optionId;
  }

  private getPartColor(key: AvatarPartKey, fallbackColor: string): string {
    return this.state[key].color ?? fallbackColor;
  }

  private getPartSecondaryColor(key: AvatarPartKey, fallbackColor: string): string {
    return this.state[key].secondaryColor ?? fallbackColor;
  }

  private getPartLineColor(key: AvatarPartKey): string {
    return this.state[key].lineColor ?? MINI_FRONT_IDLE_RIG_LAYOUT.colors.line;
  }

  private resolveOptionId(folder: string, requestedOptionId: number): string {
    const requestedId = formatMiniOptionId(requestedOptionId);

    if (hasMiniAvatarAsset(folder, `${requestedId}_color.png`) || hasMiniAvatarAsset(folder, `${requestedId}_line.png`)) {
      return requestedId;
    }

    return getFirstAvailableMiniOptionId(folder) ?? '01';
  }
}

interface MiniImageContentBounds {
  width: number;
  height: number;
  top: number;
  bottom: number;
}

interface MiniEyeLightConstraintOptions {
  requestedY: number;
  upperLidY: number;
  upperLidFiles: string[];
  eyeLightFile: string;
}

function createMirroredMiniLayers(
  folder: string,
  file: string,
  leftColor: string,
  rightColor: string,
  distance: number,
  y: number,
  zIndex: number,
): MiniLayer[] {
  return [
    {
      folder,
      file,
      color: leftColor,
      x: MINI_CENTER_X - distance,
      y,
      zIndex,
      flipX: true,
    },
    {
      folder,
      file,
      color: rightColor,
      x: MINI_CENTER_X + distance,
      y,
      zIndex,
    },
  ];
}

function addMiniPoints(firstPoint: MiniPoint, secondPoint: MiniPoint): MiniPoint {
  return {
    x: firstPoint.x + secondPoint.x,
    y: firstPoint.y + secondPoint.y,
  };
}

function getMiniAccessoryZIndex(layerSlot: AccessoryLayerSlot, order: number): number {
  const slotDefinition = getAccessoryLayerSlotDefinition(layerSlot);
  return (MINI_ACCESSORY_SLOT_Z_INDEX[slotDefinition.id] ?? slotDefinition.zIndex) + order * MINI_ACCESSORY_ORDER_STEP;
}

function getMiniMirroredAccessoryFlipX(
  side: -1 | 1,
  isUserFlipped: boolean,
): boolean {
  const sourceSide = 1;

  return side !== sourceSide ? !isUserFlipped : isUserFlipped;
}

function getMiniCanvasPoint(point: MiniPoint): MiniPoint {
  return {
    x: MINI_CENTER_X + point.x * MINI_PIXEL_SCALE,
    y: point.y,
  };
}

function getMiniScaledOffset(offset: MiniPoint): MiniPoint {
  return {
    x: offset.x * MINI_PIXEL_SCALE,
    y: offset.y * MINI_PIXEL_SCALE,
  };
}

function hasMiniAvatarAsset(folder: string, file: string): boolean {
  return miniAvatarAssetUrls[`../assets/avatar_system/mini/${folder}/${file}`] !== undefined;
}

function getMiniAvatarAssetUrl(folder: string, file: string): string {
  const assetPath = `../assets/avatar_system/mini/${folder}/${file}`;
  const url = miniAvatarAssetUrls[assetPath];

  if (!url) {
    throw new Error(`Mini avatar asset not found: ${assetPath}`);
  }

  return url;
}

async function getConstrainedMiniEyeLightY(options: MiniEyeLightConstraintOptions): Promise<number> {
  const [upperLidBounds, eyeLightBounds] = await Promise.all([
    getCombinedMiniContentBounds('upper_eyelid', options.upperLidFiles),
    getMiniImageContentBounds('eye_light', options.eyeLightFile),
  ]);

  const upperLidBottom = options.upperLidY + getMiniBoundsBottomOffset(upperLidBounds);
  const eyeLightTopOffset = getMiniBoundsTopOffset(eyeLightBounds);
  const minimumEyeLightY = upperLidBottom + MINI_EYE_LIGHT_UPPER_LID_GAP - eyeLightTopOffset;

  return Math.max(options.requestedY, minimumEyeLightY);
}

async function getCombinedMiniContentBounds(folder: string, files: string[]): Promise<MiniImageContentBounds> {
  const bounds = await Promise.all(
    files
      .filter(file => hasMiniAvatarAsset(folder, file))
      .map(file => getMiniImageContentBounds(folder, file)),
  );

  if (bounds.length === 0) {
    return { width: 0, height: 0, top: 0, bottom: 0 };
  }

  return bounds.reduce((combinedBounds, currentBounds) => ({
    width: Math.max(combinedBounds.width, currentBounds.width),
    height: Math.max(combinedBounds.height, currentBounds.height),
    top: Math.min(combinedBounds.top, currentBounds.top),
    bottom: Math.max(combinedBounds.bottom, currentBounds.bottom),
  }));
}

function getMiniBoundsTopOffset(bounds: MiniImageContentBounds): number {
  return (bounds.top - bounds.height / 2) * MINI_PIXEL_SCALE;
}

function getMiniBoundsBottomOffset(bounds: MiniImageContentBounds): number {
  return (bounds.bottom + 1 - bounds.height / 2) * MINI_PIXEL_SCALE;
}

function getMiniImageContentBounds(folder: string, file: string): Promise<MiniImageContentBounds> {
  const assetUrl = getMiniAvatarAssetUrl(folder, file);
  const cachedBounds = miniContentBoundsCache.get(assetUrl);

  if (cachedBounds) {
    return cachedBounds;
  }

  const boundsPromise = loadMiniImageElement(assetUrl).then(image => readMiniImageContentBounds(image));
  miniContentBoundsCache.set(assetUrl, boundsPromise);
  return boundsPromise;
}

function readMiniImageContentBounds(image: HTMLImageElement): MiniImageContentBounds {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Unable to create mini avatar bounds canvas context.');
  }

  context.imageSmoothingEnabled = false;
  context.drawImage(image, 0, 0);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  let top = canvas.height;
  let bottom = -1;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const alpha = imageData.data[(y * canvas.width + x) * 4 + 3];

      if (alpha === 0) {
        continue;
      }

      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }

  if (bottom === -1) {
    return { width: canvas.width, height: canvas.height, top: 0, bottom: 0 };
  }

  return { width: canvas.width, height: canvas.height, top, bottom };
}

function getFirstAvailableMiniOptionId(folder: string): string | null {
  const optionIds = Object.keys(miniAvatarAssetUrls)
    .map(assetPath => assetPath.match(new RegExp(`^\\.\\./assets/avatar_system/mini/${folder}/(\\d+)(?:_(?:color|line))?\\.png$`)))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map(match => match[1])
    .sort();

  return optionIds[0] ?? null;
}

function formatMiniOptionId(optionId: number): string {
  return String(optionId).padStart(2, '0');
}

async function tintMiniImageByLuminance(imageUrl: string, color: string): Promise<string> {
  const cacheKey = `${imageUrl}|${color}`;
  const cachedUrl = miniTintCache.get(cacheKey);

  if (cachedUrl) {
    return cachedUrl;
  }

  const sourceImage = await loadMiniImageElement(imageUrl);
  const canvas = document.createElement('canvas');
  canvas.width = sourceImage.naturalWidth;
  canvas.height = sourceImage.naturalHeight;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Unable to create mini avatar tint canvas context.');
  }

  context.imageSmoothingEnabled = false;
  context.drawImage(sourceImage, 0, 0);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const targetColor = parseMiniHexColor(color);
  const shouldMakeTransparent = color === 'transparent';

  for (let index = 0; index < imageData.data.length; index += 4) {
    const alpha = imageData.data[index + 3];

    if (alpha === 0) {
      continue;
    }

    if (shouldMakeTransparent) {
      imageData.data[index + 3] = 0;
      continue;
    }

    const red = imageData.data[index];
    const green = imageData.data[index + 1];
    const blue = imageData.data[index + 2];
    const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;
    const shade = luminance / MINI_BASE_TINT_LUMINANCE;

    imageData.data[index] = clampMiniColor(targetColor.red * shade);
    imageData.data[index + 1] = clampMiniColor(targetColor.green * shade);
    imageData.data[index + 2] = clampMiniColor(targetColor.blue * shade);
  }

  context.putImageData(imageData, 0, 0);

  const tintedUrl = canvas.toDataURL('image/png');
  miniTintCache.set(cacheKey, tintedUrl);
  return tintedUrl;
}

function loadMiniImageElement(imageUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load mini avatar image: ${imageUrl}`));
    image.src = imageUrl;
  });
}

function parseMiniHexColor(color: string): { red: number; green: number; blue: number } {
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

function clampMiniColor(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
