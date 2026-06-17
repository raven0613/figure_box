import { Canvas } from 'fabric';

import { AVATAR_PORTRAIT_RIG_LAYOUT, AVATAR_RIG_COLORS } from '../constants/avatarRig';
import {
  getAccessoryColorVariantOptions,
} from './avatar/avatarAccessoryDefinitions';
import {
  createMirroredAccessoryPoseState,
  getAccessoryPoseState,
} from './avatar/avatarAccessoryState';
import {
  AVATAR_PART_DEFINITIONS,
} from './avatar/avatarDefinitions';
import {
  AvatarPart,
  type AvatarPartContext,
} from './avatar/avatarPartBase';
import {
  AvatarPartFactory,
  getAccessoryZIndex,
} from './avatar/avatarPartFactory';
import { AvatarStateStore } from './avatar/avatarStateStore';
import type {
  AccessoryCategory,
  AccessoryLayerSlot,
  AccessoryPoseKey,
  AvatarAccessoryInstance,
  AvatarAccessoryPoseState,
  AvatarCanvasOptions,
  AvatarColorGradient,
  AvatarGradientCoordinateSpace,
  AvatarGroupKey,
  AvatarPartKey,
  AvatarPartRuntimeTransformPatch,
  AvatarPartState,
  AvatarPartStatePatch,
  AvatarState,
} from './avatar/avatarTypes';
export {
  ACCESSORY_CATEGORY_DEFINITIONS,
  ACCESSORY_LAYER_SLOT_DEFINITIONS,
  getAccessoryCategoryDefinition,
  getAccessoryColorVariantOptions,
  getAccessoryDisplayName,
  getAccessoryLayerSlotDefinition,
  resolveAccessoryColorFileName,
} from './avatar/avatarAccessoryDefinitions';
export {
  createDefaultAccessoryInstance,
  createDefaultAccessoryPoseState,
  createMirroredAccessoryPoseState,
  getAccessoryPoseState,
} from './avatar/avatarAccessoryState';
export {
  AVATAR_EDITOR_PART_DEFINITIONS,
  AVATAR_PART_DEFINITIONS,
  isAvatarPartOptionColorEditable,
} from './avatar/avatarDefinitions';
export {
  createDefaultAvatarState,
  normalizeAvatarState,
} from './avatar/avatarState';
export type {
  AccessoryCategory,
  AccessoryCategoryDefinition,
  AccessoryColorVariantOption,
  AccessoryLayerSlot,
  AccessoryLayerSlotDefinition,
  AccessoryPoseKey,
  AccessoryRenderMode,
  AvatarAccessoryInstance,
  AvatarAccessoryPoseState,
  AvatarCanvasOptions,
  AvatarColorGradient,
  AvatarEditableProperty,
  AvatarGradientCoordinateSpace,
  AvatarGradientType,
  AvatarGroupKey,
  AvatarPartDefinition,
  AvatarPartKey,
  AvatarPartOption,
  AvatarPartRuntimeTransform,
  AvatarPartRuntimeTransformPatch,
  AvatarPartState,
  AvatarPartStatePatch,
  AvatarState,
  AvatarTintSource,
  AvatarTransformProperty,
} from './avatar/avatarTypes';

const DEFAULT_CANVAS_WIDTH = 520;
const DEFAULT_CANVAS_HEIGHT = 560;
const DEFAULT_SCALE = 1;
export const MINI_UPPER_EYELID_OFFSET_Y_LIMITS = {
  min: -1,
  max: 3,
} as const;
const CHIBI_ACCESSORY_POSITION_SCALE = 0.5;
const CHIBI_SIDE_HAIR_POSITION_SCALE = 0.5;

export class AvatarCanvas {
  private readonly canvas: Canvas;
  private readonly stateStore: AvatarStateStore;
  private readonly partFactory = new AvatarPartFactory();
  private readonly parts = new Map<AvatarPartKey, AvatarPart>();
  private readonly accessoryParts = new Map<string, AvatarPart>();
  private readonly onChange?: (state: AvatarState) => void;
  private readonly onRender?: () => void;
  private readonly faceRenderKeys: readonly AvatarPartKey[] = ['face.color', 'face.line'];
  private readonly width: number;
  private readonly height: number;

  constructor(canvasElement: HTMLCanvasElement | string, options: AvatarCanvasOptions = {}) {
    const width = options.width ?? DEFAULT_CANVAS_WIDTH;
    const height = options.height ?? DEFAULT_CANVAS_HEIGHT;
    this.width = width;
    this.height = height;
    this.onChange = options.onChange;
    this.onRender = options.onRender;
    this.stateStore = new AvatarStateStore(options.initialState);
    this.canvas = new Canvas(canvasElement, {
      width,
      height,
      backgroundColor: options.backgroundColor ?? AVATAR_RIG_COLORS.canvasBackground,
      imageSmoothingEnabled: false,
      allowTouchScrolling: true,
      selection: false,
      preserveObjectStacking: true,
    });
    this.canvas.on('after:render', () => {
      this.onRender?.();
    });

    this.canvas.wrapperEl.style.touchAction = 'pan-y';
    this.canvas.lowerCanvasEl.style.touchAction = 'pan-y';
    this.canvas.upperCanvasEl.style.touchAction = 'pan-y';
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

  getCanvasElement(): HTMLCanvasElement {
    return this.canvas.lowerCanvasEl;
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
    this.updatePart(key, { color, colorGradientSpace: undefined });
  }

  setColorWithGradientSpace(
    key: AvatarPartKey,
    color: string,
    colorGradientSpace: AvatarGradientCoordinateSpace | undefined,
  ): void {
    this.updatePart(key, { color, colorGradientSpace });
  }

  setColorGradient(key: AvatarPartKey, colorGradient: AvatarColorGradient | undefined): void {
    this.updatePart(key, { colorGradient, colorGradientSpace: undefined });
  }

  setColorGradientWithGradientSpace(
    key: AvatarPartKey,
    colorGradient: AvatarColorGradient | undefined,
    colorGradientSpace: AvatarGradientCoordinateSpace | undefined,
  ): void {
    this.updatePart(key, { colorGradient, colorGradientSpace });
  }

  setColorGradientSpace(key: AvatarPartKey, colorGradientSpace: AvatarGradientCoordinateSpace | undefined): void {
    this.updatePart(key, { colorGradientSpace });
  }

  setSecondaryColor(key: AvatarPartKey, secondaryColor: string): void {
    this.updatePart(key, { secondaryColor });
  }

  setSecondaryColorGradient(key: AvatarPartKey, secondaryColorGradient: AvatarColorGradient | undefined): void {
    this.updatePart(key, { secondaryColorGradient });
  }

  setLineColor(key: AvatarPartKey, lineColor: string): void {
    this.updatePart(key, { lineColor });
  }

  setLineColorGradient(key: AvatarPartKey, lineColorGradient: AvatarColorGradient | undefined): void {
    this.updatePart(key, { lineColorGradient });
  }

  setVisible(key: AvatarPartKey, isVisible: boolean): void {
    this.updatePart(key, { isVisible });
  }

  setPartStates(patches: readonly AvatarPartStatePatch[]): void {
    patches.forEach(({ key, patch }) => {
      this.applyPartPatch(key, patch);
    });
    this.canvas.requestRenderAll();
    this.emitChange();
  }

  setPartRuntimeTransforms(
    patches: readonly AvatarPartRuntimeTransformPatch[],
  ): void {
    patches.forEach(({ key, transform }) => {
      this.parts.get(key)?.setRuntimeTransform(transform);
    });
    this.canvas.requestRenderAll();
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
    const accessory = this.stateStore.getAccessoryState(instanceId);

    if (!accessory) {
      return;
    }

    this.updateAccessory(instanceId, {
      optionId,
      colorVariantId: getAccessoryColorVariantOptions(accessory.category, optionId)[0]?.id,
    });
  }

  setAccessoryColorVariant(instanceId: string, colorVariantId: number): void {
    this.updateAccessory(instanceId, { colorVariantId });
  }

  setAccessoryColor(instanceId: string, color: string): void {
    this.updateAccessory(instanceId, { color, colorGradientSpace: undefined });
  }

  setAccessoryColorWithGradientSpace(
    instanceId: string,
    color: string,
    colorGradientSpace: AvatarGradientCoordinateSpace | undefined,
  ): void {
    this.updateAccessory(instanceId, { color, colorGradientSpace });
  }

  setAccessoryColorGradient(instanceId: string, colorGradient: AvatarColorGradient | undefined): void {
    this.updateAccessory(instanceId, { colorGradient, colorGradientSpace: undefined });
  }

  setAccessoryColorGradientWithGradientSpace(
    instanceId: string,
    colorGradient: AvatarColorGradient | undefined,
    colorGradientSpace: AvatarGradientCoordinateSpace | undefined,
  ): void {
    this.updateAccessory(instanceId, { colorGradient, colorGradientSpace });
  }

  setAccessoryColorGradientSpace(
    instanceId: string,
    colorGradientSpace: AvatarGradientCoordinateSpace | undefined,
  ): void {
    this.updateAccessory(instanceId, { colorGradientSpace });
  }

  setAccessoryLineColor(instanceId: string, lineColor: string): void {
    this.updateAccessory(instanceId, { lineColor });
  }

  setAccessoryLineColorGradient(instanceId: string, lineColorGradient: AvatarColorGradient | undefined): void {
    this.updateAccessory(instanceId, { lineColorGradient });
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

    this.updateAccessoryPose(instanceId, poseKey, { flipX: nextFlipX });
  }

  setAccessorySideVisible(
    instanceId: string,
    side: 'left' | 'right',
    isVisible: boolean,
    poseKey: AccessoryPoseKey = 'portrait',
  ): void {
    const current = this.getAccessoryState(instanceId);

    if (!current) {
      return;
    }

    const visibilityPatch = side === 'left'
      ? { leftVisible: isVisible }
      : { rightVisible: isVisible };

    this.updateAccessoryPose(instanceId, poseKey, visibilityPatch);
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

  estimateAccessoryChibiPoseFromPortrait(
    instanceId: string,
    poseKey: Extract<AccessoryPoseKey, 'chibi' | 'chibiBack' | 'chibiSide'> = 'chibi',
  ): void {
    const accessory = this.getAccessoryState(instanceId);

    if (!accessory) {
      return;
    }

    const portraitPose = getAccessoryPoseState(accessory, 'portrait');
    const positionScale = getChibiAccessoryPositionScale(accessory.category);
    this.updateAccessoryPose(instanceId, poseKey, {
      ...portraitPose,
      offsetX: Math.round(portraitPose.offsetX * positionScale),
      offsetY: Math.round(portraitPose.offsetY * positionScale),
    });
  }

  setAccessoryChibiBackFollowingFront(instanceId: string, shouldFollow: boolean): void {
    const accessory = this.getAccessoryState(instanceId);

    if (!accessory) {
      return;
    }

    this.updateAccessory(instanceId, {
      isChibiBackFollowingFront: shouldFollow,
      ...(shouldFollow
        ? {}
        : {
          chibiBack: createMirroredAccessoryPoseState(
            getAccessoryPoseState(accessory, 'chibi'),
            accessory.category,
          ),
        }),
    });
  }

  applyAccessoryChibiBackMirror(instanceId: string): void {
    const accessory = this.getAccessoryState(instanceId);

    if (!accessory) {
      return;
    }

    this.updateAccessory(instanceId, {
      chibiBack: createMirroredAccessoryPoseState(
        getAccessoryPoseState(accessory, 'chibi'),
        accessory.category,
      ),
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
      centerX: width / 2 + AVATAR_PORTRAIT_RIG_LAYOUT.faceCenter.x,
      faceCenterY: height / 2 + AVATAR_PORTRAIT_RIG_LAYOUT.faceCenter.y,
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
    this.applyPartPatch(key, patch);
    this.canvas.requestRenderAll();
    this.emitChange();
  }

  private applyPartPatch(key: AvatarPartKey, patch: Partial<AvatarPartState>): void {
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

function getChibiAccessoryPositionScale(category: AccessoryCategory): number {
  return category === 'sideHair'
    ? CHIBI_SIDE_HAIR_POSITION_SCALE
    : CHIBI_ACCESSORY_POSITION_SCALE;
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
