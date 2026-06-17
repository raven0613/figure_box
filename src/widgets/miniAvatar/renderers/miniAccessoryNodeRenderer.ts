import {
  getAccessoryCategoryDefinition,
  resolveAccessoryColorFileName,
} from '../../avatar/avatarAccessoryDefinitions';
import { getAccessoryPoseState } from '../../avatar/avatarAccessoryState';
import type {
  AccessoryLayerSlot,
  AccessoryRenderMode,
  AvatarAccessoryInstance,
  AvatarGradientCoordinateSpace,
  AvatarState,
  AvatarTintSource,
} from '../../avatar/avatarTypes';
import { formatMiniOptionId } from '../miniAvatarAssets';
import { MINI_PIXEL_SCALE } from '../miniAvatarRig';
import type {
  MiniAccessoryRigLayout,
  MiniIdleRigLayout,
  MiniLocalLayer,
  MiniPoint,
  MiniRigNode,
} from '../miniAvatarTypes';
import {
  getMiniAccessoryOptionOffset,
  getMiniAccessoryZIndex,
  getMiniMirroredAccessoryFlipX,
  getMiniScaledOffset,
  getMiniSideFolderWithFallback,
  isAccessoryInLayerSlots,
} from './miniRendererUtils';

type CreateAccessoryImageLayers = (
  folder: string,
  optionId: string,
  colorFile: string,
  color: AvatarTintSource,
  lineColor: AvatarTintSource,
  zIndex: number,
  colorGradientSpace?: AvatarGradientCoordinateSpace,
) => MiniLocalLayer[];

export class MiniAccessoryNodeRenderer {
  constructor(
    private readonly state: AvatarState,
    private readonly createAccessoryImageLayers: CreateAccessoryImageLayers,
  ) {}

  createFrontBackNodes(
    direction: 'front' | 'back',
    bases: Record<AccessoryRenderMode, MiniPoint>,
    accessoryRig: MiniAccessoryRigLayout,
    layerSlots?: readonly AccessoryLayerSlot[],
  ): MiniRigNode[] {
    return this.state.accessories.flatMap(accessory => {
      const definition = getAccessoryCategoryDefinition(accessory.category);
      const pose = getAccessoryPoseState(accessory, direction === 'back' ? 'chibiBack' : 'chibi');

      if (!isAccessoryInLayerSlots(pose.layerSlot, layerSlots)) {
        return [];
      }

      const base = bases[definition.renderMode];
      const optionId = formatMiniOptionId(accessory.optionId);
      const optionOffset = getMiniScaledOffset(getMiniAccessoryOptionOffset(accessoryRig, accessory.category, optionId));
      const zIndex = getMiniAccessoryZIndex(pose.layerSlot, pose.order);
      const folder = definition.assetFolder;

      if (definition.renderMode === 'mirrored') {
        return [
          this.createFrontBackSideNode(accessory, direction, folder, optionId, -1, base, optionOffset, zIndex, accessoryRig.mirroredDistance),
          this.createFrontBackSideNode(accessory, direction, folder, optionId, 1, base, optionOffset, zIndex, accessoryRig.mirroredDistance),
        ].filter((node): node is MiniRigNode => node !== null);
      }

      return [
        {
          transform: {
            x: base.x + optionOffset.x + pose.offsetX * MINI_PIXEL_SCALE,
            y: base.y + optionOffset.y + pose.offsetY * MINI_PIXEL_SCALE,
            angle: pose.rotate,
            scale: pose.scale,
            flipX: pose.flipX,
          },
          layers: this.createAccessoryLayers(accessory, folder, optionId, zIndex),
        },
      ];
    });
  }

  createSideNodes(rig: MiniIdleRigLayout, layerSlots?: readonly AccessoryLayerSlot[]): MiniRigNode[] {
    return this.state.accessories.flatMap(accessory => {
      const definition = getAccessoryCategoryDefinition(accessory.category);
      const pose = getAccessoryPoseState(accessory, 'chibiSide');

      if (!isAccessoryInLayerSlots(pose.layerSlot, layerSlots)) {
        return [];
      }

      const optionId = formatMiniOptionId(accessory.optionId);
      const zIndex = getMiniAccessoryZIndex(pose.layerSlot, pose.order);
      const folder = getMiniSideFolderWithFallback(definition.assetFolder, optionId);
      const optionOffset = getMiniScaledOffset(getMiniAccessoryOptionOffset(rig.accessories, accessory.category, optionId));
      const baseOffset = definition.renderMode === 'mirrored'
        ? rig.accessories.mirrored
        : rig.accessories.center;
      const base = getMiniScaledOffset(baseOffset);

      if (definition.renderMode === 'mirrored' && pose.leftVisible === false && pose.rightVisible === false) {
        return [];
      }

      return [{
        transform: {
          x: base.x + optionOffset.x + pose.offsetX * MINI_PIXEL_SCALE,
          y: base.y + optionOffset.y + pose.offsetY * MINI_PIXEL_SCALE,
          angle: pose.rotate,
          scale: pose.scale,
          flipX: pose.flipX,
        },
        layers: this.createAccessoryLayers(accessory, folder, optionId, zIndex),
      }];
    });
  }

  private createFrontBackSideNode(
    accessory: AvatarAccessoryInstance,
    direction: 'front' | 'back',
    folder: string,
    optionId: string,
    side: -1 | 1,
    base: MiniPoint,
    optionOffset: MiniPoint,
    zIndex: number,
    mirroredDistance: number,
  ): MiniRigNode | null {
    const pose = getAccessoryPoseState(accessory, direction === 'back' ? 'chibiBack' : 'chibi');

    if ((side === -1 && pose.leftVisible === false) || (side === 1 && pose.rightVisible === false)) {
      return null;
    }

    return {
      transform: {
        x: base.x + side * (mirroredDistance + optionOffset.x + pose.offsetX * MINI_PIXEL_SCALE),
        y: base.y + optionOffset.y + pose.offsetY * MINI_PIXEL_SCALE,
        angle: side * pose.rotate,
        scale: pose.scale,
        flipX: getMiniMirroredAccessoryFlipX(side, pose.flipX),
      },
      layers: this.createAccessoryLayers(accessory, folder, optionId, zIndex),
    };
  }

  private createAccessoryLayers(
    accessory: AvatarAccessoryInstance,
    folder: string,
    optionId: string,
    zIndex: number,
  ): MiniLocalLayer[] {
    const definition = getAccessoryCategoryDefinition(accessory.category);

    return this.createAccessoryImageLayers(
      folder,
      optionId,
      resolveAccessoryColorFileName(accessory.category, accessory.optionId, accessory.colorVariantId),
      accessory.colorGradient ?? accessory.color ?? definition.defaultColor,
      accessory.lineColorGradient ?? accessory.lineColor ?? definition.defaultLineColor,
      zIndex,
      accessory.colorGradientSpace,
    );
  }
}
