import { Circle, FabricImage, FabricObject } from 'fabric';

import { AVATAR_PORTRAIT_RIG_LAYOUT } from '../../constants/avatarRig';
import {
  getAccessoryCategoryDefinition,
  getAccessoryDisplayName,
  getAccessoryLayerSlotDefinition,
  resolveAccessoryColorFileName,
} from './avatarAccessoryDefinitions';
import {
  formatOptionId,
  hasAvatarAsset,
} from './avatarAssets';
import {
  AVATAR_PIXEL_SCALE,
  AvatarControlGroupPart,
  AvatarPart,
  CenterAssetPart,
  ImageAvatarPart,
  MirroredAssetPart,
  type AvatarImageLayer,
  type AvatarPartContext,
} from './avatarPartBase';
import type {
  AccessoryCategoryDefinition,
  AvatarAccessoryInstance,
  AvatarPartDefinition,
  AvatarPartState,
} from './avatarTypes';

const ACCESSORY_ORDER_STEP = 0.01;
const EYE_DISTANCE = AVATAR_PORTRAIT_RIG_LAYOUT.mirrored.eyeDistance;

export function getAccessoryZIndex(accessory: AvatarAccessoryInstance): number {
  return getAccessoryLayerSlotDefinition(accessory.layerSlot).zIndex + accessory.order * ACCESSORY_ORDER_STEP;
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

class EyeGroupPart extends AvatarControlGroupPart {
  protected get baseX(): number {
    return this.getPortraitGroupPoint('eyes').x;
  }

  protected get baseY(): number {
    return this.getPortraitGroupPoint('eyes').y;
  }
}

class HairGroupPart extends AvatarControlGroupPart {
  protected get baseX(): number {
    return this.getPortraitGroupPoint('hair').x;
  }

  protected get baseY(): number {
    return this.getPortraitGroupPoint('hair').y;
  }
}

class FaceControlPart extends AvatarControlGroupPart {
  protected get baseX(): number {
    return this.getPortraitPartPoint('face').x;
  }

  protected get baseY(): number {
    return this.getPortraitPartPoint('face').y;
  }
}

class FaceColorPart extends CenterAssetPart {
  protected get baseX(): number {
    return this.getPortraitPartPoint('face').x;
  }

  protected get baseY(): number {
    return this.getPortraitPartPoint('face').y;
  }

  protected resolveLayers(): AvatarImageLayer[] {
    return [{ folder: 'face', file: `${formatOptionId(this.state.optionId)}_color.png`, tint: 'color' }];
  }
}

class FaceLinePart extends CenterAssetPart {
  protected get baseX(): number {
    return this.getPortraitPartPoint('face').x;
  }

  protected get baseY(): number {
    return this.getPortraitPartPoint('face').y;
  }

  protected resolveLayers(): AvatarImageLayer[] {
    return [{ folder: 'face', file: `${formatOptionId(this.state.optionId)}_line.png`, tint: 'line' }];
  }
}

class EarPart extends MirroredAssetPart {
  protected get baseX(): number {
    return this.getPortraitMirroredPartPoint('ear').x;
  }

  protected get baseY(): number {
    return this.getPortraitMirroredPartPoint('ear').y;
  }

  protected resolveSideLayers(): AvatarImageLayer[] {
    return createSkinAndLineLayers('ear', formatOptionId(this.state.optionId));
  }

  protected getSideBaseX(side: -1 | 1): number {
    return side * AVATAR_PORTRAIT_RIG_LAYOUT.mirrored.earDistance + this.getPortraitMirroredPartOffsetX('ear', side);
  }
}

class ScleraPart extends AvatarPart {
  protected get baseX(): number {
    return this.getPortraitMirroredPartPoint('sclera').x;
  }

  protected get baseY(): number {
    return this.getPortraitMirroredPartPoint('sclera').y;
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
      radius: 28,
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
        left: side * EYE_DISTANCE + this.getPortraitMirroredPartOffsetX('sclera', side) + side * (this.state.offsetX ?? 0),
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
    return this.getPortraitMirroredPartPoint('eyeBall').x;
  }

  protected get baseY(): number {
    return this.getPortraitMirroredPartPoint('eyeBall').y;
  }

  protected resolveSideLayers(side: -1 | 1): AvatarImageLayer[] {
    return createLineAndColorLayers('eyeball', formatOptionId(this.state.optionId))
      .map(layer => layer.tint === 'color'
        ? {
          ...layer,
          tintColor: side === -1
            ? this.getColorTintSource()
            : this.state.secondaryColorGradient ?? this.state.secondaryColor ?? this.getColorTintSource(),
        }
        : layer);
  }

  protected getMirroredRigOffsetX(side: -1 | 1): number {
    return this.getPortraitMirroredPartOffsetX('eyeBall', side);
  }
}

class EyeLightPart extends MirroredAssetPart {
  protected get baseX(): number {
    return this.getPortraitMirroredPartPoint('eyeLight').x;
  }

  protected get baseY(): number {
    return this.getPortraitMirroredPartPoint('eyeLight').y;
  }

  protected resolveSideLayers(): AvatarImageLayer[] {
    return [{ folder: 'eye_light', file: '01.png' }];
  }

  protected getSideBaseX(side: -1 | 1): number {
    return side * (this.state.lightDistance ?? AVATAR_PORTRAIT_RIG_LAYOUT.mirrored.defaultEyeLightDistance)
      + this.getPortraitMirroredPartOffsetX('eyeLight', side);
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
    return this.getPortraitMirroredPartPoint('eyebrow').x;
  }

  protected get baseY(): number {
    return this.getPortraitMirroredPartPoint('eyebrow').y;
  }

  protected resolveSideLayers(): AvatarImageLayer[] {
    return [{ folder: 'eyebrow', file: `${formatOptionId(this.state.optionId)}.png`, tint: 'line' }];
  }

  protected getSideBaseY(): number {
    return AVATAR_PORTRAIT_RIG_LAYOUT.mirrored.eyebrowY;
  }

  protected getMirroredRigOffsetX(side: -1 | 1): number {
    return this.getPortraitMirroredPartOffsetX('eyebrow', side);
  }
}

class EyeLidPart extends MirroredAssetPart {
  protected get baseX(): number {
    return this.getPortraitMirroredPartPoint('eyelid').x;
  }

  protected get baseY(): number {
    return this.getPortraitMirroredPartPoint('eyelid').y;
  }

  protected resolveSideLayers(): AvatarImageLayer[] {
    return [{ folder: 'eyelid', file: `${formatOptionId(this.state.optionId)}.png`, tint: 'line' }];
  }

  protected getMirroredRigOffsetX(side: -1 | 1): number {
    return this.getPortraitMirroredPartOffsetX('eyelid', side);
  }
}

class UpperEyelidPart extends MirroredAssetPart {
  protected get baseX(): number {
    return this.getPortraitMirroredPartPoint('upperEyelid').x;
  }

  protected get baseY(): number {
    return this.getPortraitMirroredPartPoint('upperEyelid').y;
  }

  protected resolveSideLayers(): AvatarImageLayer[] {
    return createSkinAndLineLayers('upper_eyelid', formatOptionId(this.state.optionId), true);
  }

  protected getSideBaseY(): number {
    return AVATAR_PORTRAIT_RIG_LAYOUT.mirrored.upperEyelidY;
  }

  protected getMirroredRigOffsetX(side: -1 | 1): number {
    return this.getPortraitMirroredPartOffsetX('upperEyelid', side);
  }
}

class LowerEyelidPart extends MirroredAssetPart {
  protected get baseX(): number {
    return this.getPortraitMirroredPartPoint('lowerEyelid').x;
  }

  protected get baseY(): number {
    return this.getPortraitMirroredPartPoint('lowerEyelid').y;
  }

  protected resolveSideLayers(): AvatarImageLayer[] {
    return createSkinAndLineLayers('lower_eyelid', formatOptionId(this.state.optionId), true);
  }

  protected getSideBaseY(): number {
    return AVATAR_PORTRAIT_RIG_LAYOUT.mirrored.lowerEyelidY;
  }

  protected getMirroredRigOffsetX(side: -1 | 1): number {
    return this.getPortraitMirroredPartOffsetX('lowerEyelid', side);
  }
}

class NosePart extends CenterAssetPart {
  protected get baseX(): number {
    return this.getPortraitPartPoint('nose').x;
  }

  protected get baseY(): number {
    return this.getPortraitPartPoint('nose').y;
  }

  protected resolveLayers(): AvatarImageLayer[] {
    return createOptionalLineAndColorLayers('nose', formatOptionId(this.state.optionId), `${formatOptionId(this.state.optionId)}.png`);
  }
}

class MouthPart extends CenterAssetPart {
  protected get baseX(): number {
    return this.getPortraitPartPoint('mouth').x;
  }

  protected get baseY(): number {
    return this.getPortraitPartPoint('mouth').y;
  }

  protected resolveLayers(): AvatarImageLayer[] {
    const optionId = formatOptionId(this.state.optionId);
    return createOptionalLineAndColorLayers('mouth', optionId, `${optionId}_line.png`);
  }
}

class BackHairPart extends CenterAssetPart {
  protected get baseX(): number {
    return this.getPortraitPartPoint('backHairBottom').x
      + this.getPortraitPartOptionOffset('backHairBottom').x;
  }

  protected get baseY(): number {
    return this.getPortraitPartPoint('backHairBottom').y
      + this.getPortraitPartOptionOffset('backHairBottom').y;
  }

  protected resolveLayers(): AvatarImageLayer[] {
    return createLineAndColorLayers('back_hair_bottom', formatOptionId(this.state.optionId));
  }
}

class TopHairPart extends CenterAssetPart {
  protected get baseX(): number {
    return this.getPortraitPartPoint('backHairTop').x
      + this.getPortraitPartOptionOffset('backHairTop').x;
  }

  protected get baseY(): number {
    return this.getPortraitPartPoint('backHairTop').y
      + this.getPortraitPartOptionOffset('backHairTop').y;
  }

  protected resolveLayers(): AvatarImageLayer[] {
    return createLineAndColorLayers('back_hair_top', formatOptionId(this.state.optionId));
  }
}

class BangsPart extends CenterAssetPart {
  protected get baseX(): number {
    return this.getPortraitPartPoint('bangs').x
      + this.getPortraitPartOptionOffset('bangs').x;
  }

  protected get baseY(): number {
    return this.getPortraitPartPoint('bangs').y
      + this.getPortraitPartOptionOffset('bangs').y;
  }

  protected resolveLayers(): AvatarImageLayer[] {
    return createLineAndColorLayers('bangs', formatOptionId(this.state.optionId));
  }
}

class HairLightPart extends CenterAssetPart {
  protected get baseX(): number {
    return this.getPortraitPartPoint('hairLight').x;
  }

  protected get baseY(): number {
    return this.getPortraitPartPoint('hairLight').y;
  }

  protected resolveLayers(): AvatarImageLayer[] {
    if (this.state.optionId <= 0) {
      return [];
    }

    const file = `${formatOptionId(this.state.optionId)}_line.png`;
    return hasAvatarAsset('hair_light', file)
      ? [{ folder: 'hair_light', file, tint: 'color' }]
      : [];
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
    return this.getPortraitPartPoint('accessory').x
      + this.getPortraitAccessoryOptionOffset(this.accessoryState).x;
  }

  protected get baseY(): number {
    return this.getPortraitPartPoint('accessory').y
      + this.getPortraitAccessoryOptionOffset(this.accessoryState).y;
  }

  protected resolveAccessoryLayers(): AvatarImageLayer[] {
    return createOptionalLineAndColorLayers(
      this.categoryDefinition.assetFolder,
      formatOptionId(this.state.optionId),
      `${formatOptionId(this.state.optionId)}.png`,
      resolveAccessoryColorFileName(
        this.accessoryState.category,
        this.state.optionId,
        this.state.colorVariantId,
      ),
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
    return this.getPortraitMirroredPartPoint('accessory').x;
  }

  protected get baseY(): number {
    return this.getPortraitMirroredPartPoint('accessory').y;
  }

  protected resolveSideLayers(): AvatarImageLayer[] {
    const accessoryState = this.state as AvatarAccessoryInstance;

    return createOptionalLineAndColorLayers(
      getAccessoryCategoryDefinition(accessoryState.category).assetFolder,
      formatOptionId(this.state.optionId),
      `${formatOptionId(this.state.optionId)}.png`,
      resolveAccessoryColorFileName(
        accessoryState.category,
        this.state.optionId,
        this.state.colorVariantId,
      ),
    );
  }

  protected getSideBaseX(side: -1 | 1): number {
    const accessoryState = this.state as AvatarAccessoryInstance;
    const optionOffset = this.getPortraitAccessoryOptionOffset(accessoryState);

    return side * AVATAR_PORTRAIT_RIG_LAYOUT.mirrored.accessoryDistance
      + AVATAR_PORTRAIT_RIG_LAYOUT.parts.accessory.x
      + side * optionOffset.x;
  }

  protected getSideBaseY(): number {
    const accessoryState = this.state as AvatarAccessoryInstance;
    const optionOffset = this.getPortraitAccessoryOptionOffset(accessoryState);

    return AVATAR_PORTRAIT_RIG_LAYOUT.mirrored.accessoryY + optionOffset.y;
  }
}

export class AvatarPartFactory {
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
      case 'hair.light':
        return new HairLightPart(definition, context, state);
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
  colorFile = `${optionId}_color.png`,
): AvatarImageLayer[] {
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
