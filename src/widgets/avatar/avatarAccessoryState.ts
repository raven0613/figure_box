import { getAccessoryCategoryDefinition, getAccessoryColorVariantOptions } from './avatarAccessoryDefinitions';
import type {
  AccessoryCategory,
  AccessoryLayerSlot,
  AccessoryPoseKey,
  AvatarAccessoryInstance,
  AvatarAccessoryPoseState,
} from './avatarTypes';

const DEFAULT_SCALE = 1;

export function createDefaultAccessoryInstance(
  category: AccessoryCategory,
  order: number,
  layerSlot?: AccessoryLayerSlot,
): AvatarAccessoryInstance {
  const definition = getAccessoryCategoryDefinition(category);
  const optionId = definition.options[0]?.id ?? 1;

  return {
    instanceId: createAccessoryInstanceId(),
    category,
    optionId,
    colorVariantId: getAccessoryColorVariantOptions(category, optionId)[0]?.id,
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
    chibiBack: createDefaultAccessoryPoseState(layerSlot ?? definition.defaultLayerSlot, order),
    chibiSide: createDefaultAccessoryPoseState(layerSlot ?? definition.defaultLayerSlot, order),
    isChibiBackFollowingFront: true,
  };
}

export function getAccessoryPoseState(
  accessory: AvatarAccessoryInstance,
  poseKey: AccessoryPoseKey,
): AvatarAccessoryPoseState {
  if (poseKey !== 'portrait') {
    const pose = poseKey === 'chibiBack' && accessory.isChibiBackFollowingFront
      ? createMirroredAccessoryPoseState(accessory.chibi, accessory.category)
      : poseKey === 'chibiBack'
        ? accessory.chibiBack
        : poseKey === 'chibiSide'
          ? accessory.chibiSide
          : accessory.chibi;

    return {
      ...createDefaultAccessoryPoseState(accessory.layerSlot, accessory.order),
      ...pose,
      layerSlot: accessory.layerSlot,
      order: accessory.order,
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

export function createDefaultAccessoryPoseState(
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

export function createMirroredAccessoryPoseState(
  pose: AvatarAccessoryPoseState,
  category: AccessoryCategory,
): AvatarAccessoryPoseState {
  const isMirroredAccessory = getAccessoryCategoryDefinition(category).renderMode === 'mirrored';

  return {
    ...pose,
    offsetX: isMirroredAccessory ? pose.offsetX : -pose.offsetX,
    rotate: isMirroredAccessory ? pose.rotate : -pose.rotate,
    flipX: isMirroredAccessory ? pose.flipX : !pose.flipX,
    leftVisible: pose.rightVisible,
    rightVisible: pose.leftVisible,
  };
}

function createAccessoryInstanceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `accessory-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
