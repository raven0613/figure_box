import { FabricImage, FabricObject, Group } from 'fabric';

import { AVATAR_PORTRAIT_RIG_LAYOUT, AVATAR_RIG_COLORS } from '../../constants/avatarRig';
import { getAvatarAssetUrl } from './avatarAssets';
import {
  getAvatarTintCacheKey,
  getSharedHairTintTransformKey,
  tintImageByLuminance,
} from './avatarTint';
import type {
  AvatarAccessoryInstance,
  AvatarGradientCoordinateSpace,
  AvatarGroupKey,
  AvatarPartDefinition,
  AvatarPartKey,
  AvatarPartRuntimeTransform,
  AvatarPartState,
  AvatarTintSource,
} from './avatarTypes';

export interface AvatarPartContext {
  width: number;
  height: number;
  centerX: number;
  faceCenterY: number;
  getGroupState: (key: AvatarGroupKey) => AvatarPartState;
  getPartState: (key: AvatarPartKey) => AvatarPartState;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface AvatarImageLayer {
  folder: string;
  file: string;
  tint?: 'color' | 'line' | 'skin';
  tintColor?: AvatarTintSource;
  tintCoordinateSpace?: AvatarGradientCoordinateSpace;
  shouldDropLightPixels?: boolean;
}

const DEFAULT_SCALE = 1;
const DEFAULT_LINE_COLOR = AVATAR_RIG_COLORS.line;
export const AVATAR_PIXEL_SCALE = 2;
const EYE_DISTANCE = AVATAR_PORTRAIT_RIG_LAYOUT.mirrored.eyeDistance;

export abstract class AvatarPart {
  protected readonly definition: AvatarPartDefinition;
  protected readonly context: AvatarPartContext;
  protected state: AvatarPartState;
  protected object: Group | null = null;
  private runtimeTransform: AvatarPartRuntimeTransform = {};

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
    this.applyVisibility();
    return this.object;
  }

  update(nextState: AvatarPartState): void {
    this.state = { ...this.state, ...nextState };
    this.updateArtworkColor();
    this.applyTransform();
    this.applyVisibility();
  }

  refreshParentTransform(): void {
    this.applyTransform();
  }

  refreshArtwork(): void {
    // Non-image parts do not need artwork refreshes.
  }

  setRuntimeTransform(transform: AvatarPartRuntimeTransform): void {
    this.runtimeTransform = { ...transform };
    this.applyTransform();
    this.applyStoredRuntimeTransform();
  }

  protected applyStoredRuntimeTransform(): void {
    if (!this.object) {
      return;
    }

    const scale = this.runtimeTransform.scale ?? 1;

    this.object.set({
      left: (this.object.left ?? 0) + (this.runtimeTransform.offsetX ?? 0),
      top: (this.object.top ?? 0) + (this.runtimeTransform.offsetY ?? 0),
      angle: (this.object.angle ?? 0) + (this.runtimeTransform.rotate ?? 0),
      scaleX: (this.object.scaleX ?? 1) * scale,
      scaleY: (this.object.scaleY ?? 1) * scale,
      opacity: this.runtimeTransform.opacity ?? 1,
    });
    this.object.setCoords();
  }

  private applyVisibility(): void {
    this.object?.set({
      visible: this.state.isVisible !== false,
    });
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

  protected get lineTintSource(): AvatarTintSource {
    return this.state.lineColorGradient ?? this.lineColor;
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
    return this.getPortraitGroupPoint(key);
  }

  protected getPortraitPartPoint(key: keyof typeof AVATAR_PORTRAIT_RIG_LAYOUT.parts): Point2D {
    const point = AVATAR_PORTRAIT_RIG_LAYOUT.parts[key];
    return {
      x: this.context.centerX + point.x,
      y: this.context.faceCenterY + point.y,
    };
  }

  protected getPortraitMirroredPartPoint(key: keyof typeof AVATAR_PORTRAIT_RIG_LAYOUT.parts): Point2D {
    const point = AVATAR_PORTRAIT_RIG_LAYOUT.parts[key];
    return {
      x: this.context.centerX,
      y: this.context.faceCenterY + point.y,
    };
  }

  protected getPortraitMirroredPartOffsetX(key: keyof typeof AVATAR_PORTRAIT_RIG_LAYOUT.parts, side: -1 | 1): number {
    return side * AVATAR_PORTRAIT_RIG_LAYOUT.parts[key].x;
  }

  protected getPortraitGroupPoint(key: AvatarGroupKey): Point2D {
    const point = AVATAR_PORTRAIT_RIG_LAYOUT.groups[key];
    return {
      x: this.context.centerX + point.x,
      y: this.context.faceCenterY + point.y,
    };
  }

  protected getPortraitPartOptionOffset(
    key: keyof typeof AVATAR_PORTRAIT_RIG_LAYOUT.partsByOption,
    optionId = this.state.optionId,
  ): Point2D {
    const offsets = AVATAR_PORTRAIT_RIG_LAYOUT.partsByOption[key] as Record<number, Point2D | undefined>;
    return offsets[optionId] ?? { x: 0, y: 0 };
  }

  protected getPortraitAccessoryOptionOffset(accessory: AvatarAccessoryInstance): Point2D {
    const offsets = AVATAR_PORTRAIT_RIG_LAYOUT.accessoriesByOption[accessory.category] as Record<number, Point2D | undefined>;
    return offsets[accessory.optionId] ?? { x: 0, y: 0 };
  }

  protected updateArtworkColor(): void {
    // Image-backed parts override this when they have tintable layers.
  }
}

export abstract class AvatarControlGroupPart extends AvatarPart {
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

export abstract class ImageAvatarPart extends AvatarPart {
  private readonly images: FabricImage[] = [];
  private loadVersion = 0;

  createObject(): Group {
    const group = super.createObject();
    void this.reloadImages();
    return group;
  }

  update(nextState: AvatarPartState): void {
    const previousOptionId = this.state.optionId;
    const previousColorVariantId = this.state.colorVariantId;
    const previousColor = this.state.color;
    const previousColorGradient = this.state.colorGradient;
    const previousColorGradientSpace = this.state.colorGradientSpace;
    const previousSharedHairTintTransformKey = getSharedHairTintTransformKey(this.state);
    const previousSecondaryColor = this.state.secondaryColor;
    const previousSecondaryColorGradient = this.state.secondaryColorGradient;
    const previousLineColor = this.state.lineColor;
    const previousLineColorGradient = this.state.lineColorGradient;
    this.state = { ...this.state, ...nextState };
    this.applyTransform();

    if (
      previousOptionId !== this.state.optionId ||
      previousColorVariantId !== this.state.colorVariantId ||
      previousColor !== this.state.color ||
      getAvatarTintCacheKey(previousColorGradient) !== getAvatarTintCacheKey(this.state.colorGradient) ||
      previousColorGradientSpace !== this.state.colorGradientSpace ||
      (
        this.state.colorGradientSpace === 'sharedHair' &&
        previousSharedHairTintTransformKey !== getSharedHairTintTransformKey(this.state)
      ) ||
      previousSecondaryColor !== this.state.secondaryColor ||
      getAvatarTintCacheKey(previousSecondaryColorGradient) !== getAvatarTintCacheKey(this.state.secondaryColorGradient) ||
      previousLineColor !== this.state.lineColor ||
      getAvatarTintCacheKey(previousLineColorGradient) !== getAvatarTintCacheKey(this.state.lineColorGradient)
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
            layer.tintColor ?? this.getTintSource(layer.tint),
            layer.tint,
            {
              anchorPoint: this.getTintAnchorPoint(layer),
              coordinateSpace: layer.tintCoordinateSpace ?? this.getTintCoordinateSpace(layer.tint),
              ...this.getTintPixelScale(),
            },
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
    this.applyStoredRuntimeTransform();
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

  protected getTintSource(tint: 'color' | 'line' | 'skin'): AvatarTintSource {
    if (tint === 'skin') {
      return this.getFaceTintSource();
    }

    return tint === 'color' ? this.getColorTintSource() : this.lineTintSource;
  }

  protected getColorTintSource(): AvatarTintSource {
    return this.state.colorGradient ?? this.color;
  }

  protected getTintCoordinateSpace(tint: 'color' | 'line' | 'skin'): AvatarGradientCoordinateSpace {
    return tint === 'color' ? this.state.colorGradientSpace ?? 'local' : 'local';
  }

  protected getTintAnchorPoint(_layer: AvatarImageLayer): Point2D {
    const transform = this.resolveWorldTransform(this.getPartOffset(), this.getPartRotation(), 1);

    return {
      x: transform.left,
      y: transform.top,
    };
  }

  protected getTintPixelScale(): { pixelScaleX: number; pixelScaleY: number } {
    const transform = this.resolveWorldTransform(this.getPartOffset(), this.getPartRotation(), 1);

    return {
      pixelScaleX: Math.abs(transform.scaleX) * AVATAR_PIXEL_SCALE * this.scale,
      pixelScaleY: Math.abs(transform.scaleY) * AVATAR_PIXEL_SCALE * this.scale,
    };
  }

  protected getFaceTintSource(): AvatarTintSource {
    const faceState = this.context.getPartState('face');
    return faceState.colorGradient ?? faceState.color ?? AVATAR_RIG_COLORS.skin;
  }
}

export abstract class CenterAssetPart extends ImageAvatarPart {
  protected configureImage(image: FabricImage): void {
    image.set({
      left: 0,
      top: 0,
      scaleX: AVATAR_PIXEL_SCALE * this.scale,
      scaleY: AVATAR_PIXEL_SCALE * this.scale,
    });
  }

  protected applyTransform(): void {
    if (!this.object) {
      return;
    }

    this.updateCenterImages();
    const transform = this.resolveWorldTransform(this.getPartOffset(), this.getPartRotation(), 1);
    this.object.set(transform);
    this.object.setCoords();
  }

  private updateCenterImages(): void {
    if (!this.object) {
      return;
    }

    this.object.getObjects().forEach(object => {
      object.set({
        scaleX: AVATAR_PIXEL_SCALE * this.scale,
        scaleY: AVATAR_PIXEL_SCALE * this.scale,
      });
    });
  }
}

export abstract class MirroredAssetPart extends ImageAvatarPart {
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

  protected getTintAnchorPoint(layer: AvatarImageLayer): Point2D {
    const side = layer.file.includes('__right') ? 1 : -1;
    const transform = this.resolveWorldTransform({ x: 0, y: 0 }, 0, 1);

    return {
      x: transform.left + this.getSideBaseX(side) + this.getSideOffsetX(side),
      y: transform.top + this.getSideBaseY() + (this.state.offsetY ?? 0),
    };
  }

  protected getSideBaseX(side: -1 | 1): number {
    return side * EYE_DISTANCE + this.getMirroredRigOffsetX(side);
  }

  protected getMirroredRigOffsetX(_side: -1 | 1): number {
    return 0;
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

function rotatePoint(point: Point2D, degrees: number): Point2D {
  const radians = degrees * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}
