import { getAccessoryLayerSlotDefinition } from '../../avatar/avatarAccessoryDefinitions';
import type { AccessoryCategory, AccessoryLayerSlot } from '../../avatar/avatarTypes';
import {
  getCombinedMiniContentBounds,
  getMiniBoundsBottomOffset,
  hasMiniAvatarAsset,
} from '../miniAvatarAssets';
import {
  MINI_ACCESSORY_ORDER_STEP,
  MINI_ACCESSORY_SLOT_Z_INDEX,
  MINI_CENTER_X,
  MINI_CLOTHING_BODY_Z_INDEX,
  MINI_CLOTHING_LAYER_Z_STEP,
  MINI_PIXEL_SCALE,
} from '../miniAvatarRig';
import type {
  MiniAccessoryRigLayout,
  MiniBodyRigLayout,
  MiniIdleRigLayout,
  MiniLocalLayer,
  MiniOptionOffsetMap,
  MiniPoint,
  MiniTransform,
} from '../miniAvatarTypes';

export interface MiniMirroredSocketPoints {
  left: MiniPoint;
  right: MiniPoint;
}

export interface MiniAssetPair {
  folder: string;
  colorFile: string;
  lineFile: string;
}

export function createMiniNodeTransform(basePoint: MiniPoint, transform: MiniTransform = {}): MiniTransform {
  return {
    ...transform,
    x: basePoint.x + (transform.x ?? 0),
    y: basePoint.y + (transform.y ?? 0),
  };
}

export function createMiniAnchoredNodeTransform(
  visualPoint: MiniPoint,
  anchorOffset: MiniPoint,
  transform: MiniTransform = {},
): MiniTransform {
  return createMiniNodeTransform(subtractMiniPoints(visualPoint, anchorOffset), transform);
}

export function getMiniArmIdleSocketPoints(
  bodyRig: MiniBodyRigLayout,
  armIdleOffset: MiniPoint,
  armIdleAnchorOffset: MiniPoint,
): MiniMirroredSocketPoints {
  const socketOffset = bodyRig.armIdleSocketOffset
    ? getMiniScaledOffset(bodyRig.armIdleSocketOffset)
    : { x: 0, y: armIdleOffset.y - armIdleAnchorOffset.y };
  const socketDistance = (
    bodyRig.armIdleSocketDistance ?? bodyRig.armIdleDistance + armIdleOffset.x - armIdleAnchorOffset.x
  ) + socketOffset.x;
  const fallbackSocketPoints = createMirroredMiniSocketPoints(socketDistance, socketOffset.y);

  return {
    left: bodyRig.armIdleLeftSocket ?? fallbackSocketPoints.left,
    right: bodyRig.armIdleRightSocket ?? fallbackSocketPoints.right,
  };
}

export function createMirroredMiniSocketPoints(distance: number, y: number): MiniMirroredSocketPoints {
  return {
    left: { x: -distance, y },
    right: { x: distance, y },
  };
}

export function cloneMiniLocalLayers(
  layers: MiniLocalLayer[],
  flipX = false,
  anchorOffset: MiniPoint = { x: 0, y: 0 },
): MiniLocalLayer[] {
  return layers.map(layer => ({
    ...layer,
    x: anchorOffset.x + (flipX ? -(layer.x ?? 0) : (layer.x ?? 0)),
    y: anchorOffset.y + (layer.y ?? 0),
    flipX: flipX ? layer.flipX !== true : layer.flipX,
  }));
}

export function mirrorMiniPointX(point: MiniPoint): MiniPoint {
  return {
    x: -point.x,
    y: point.y,
  };
}

export function addMiniPoints(firstPoint: MiniPoint, secondPoint: MiniPoint): MiniPoint {
  return {
    x: firstPoint.x + secondPoint.x,
    y: firstPoint.y + secondPoint.y,
  };
}

export function subtractMiniPoints(firstPoint: MiniPoint, secondPoint: MiniPoint): MiniPoint {
  return {
    x: firstPoint.x - secondPoint.x,
    y: firstPoint.y - secondPoint.y,
  };
}

export async function getMiniBodyCenter(
  rig: MiniIdleRigLayout,
  selectedBodyRig: MiniBodyRigLayout,
): Promise<MiniPoint> {
  const defaultBodyCenter = getMiniCanvasPoint(rig.bodyCenter);
  const baselineBodyRig = rig.bodyByType[rig.baselineBodyTypeId] ?? rig.bodyByType[rig.bodyTypeId] ?? rig.bodyByType[1];
  const legFootOffset = await getMiniLegFootOffset();
  const feetBaselineY = defaultBodyCenter.y + getMiniScaledOffset(baselineBodyRig.legOffset).y + legFootOffset;
  const selectedLegOffset = getMiniScaledOffset(selectedBodyRig.legOffset);

  return {
    ...defaultBodyCenter,
    y: feetBaselineY - selectedLegOffset.y - legFootOffset,
  };
}

async function getMiniLegFootOffset(): Promise<number> {
  const legBounds = await getCombinedMiniContentBounds('leg', ['01_color.png', '01_line.png']);
  return getMiniBoundsBottomOffset(legBounds);
}

export function getMiniOptionOffset(offsets: MiniOptionOffsetMap, optionId: string): MiniPoint {
  return offsets[Number(optionId)] ?? { x: 0, y: 0 };
}

export function getMiniAccessoryOptionOffset(
  accessoryRig: MiniAccessoryRigLayout,
  category: AccessoryCategory,
  optionId: string,
): MiniPoint {
  return getMiniOptionOffset(accessoryRig.byCategoryOption[category], optionId);
}

export function getMiniClothingBodyZIndex(layerOrder: number): number {
  return MINI_CLOTHING_BODY_Z_INDEX + layerOrder * MINI_CLOTHING_LAYER_Z_STEP;
}

export function isAccessoryInLayerSlots(
  layerSlot: AccessoryLayerSlot,
  allowedLayerSlots?: readonly AccessoryLayerSlot[],
): boolean {
  return allowedLayerSlots === undefined || allowedLayerSlots.includes(layerSlot);
}

export function getMiniAccessoryZIndex(layerSlot: AccessoryLayerSlot, order: number): number {
  const slotDefinition = getAccessoryLayerSlotDefinition(layerSlot);
  return (MINI_ACCESSORY_SLOT_Z_INDEX[slotDefinition.id] ?? slotDefinition.zIndex) + order * MINI_ACCESSORY_ORDER_STEP;
}

export function getMiniMirroredAccessoryFlipX(
  side: -1 | 1,
  isUserFlipped: boolean,
): boolean {
  const sourceSide = 1;

  return side !== sourceSide ? !isUserFlipped : isUserFlipped;
}

export function getMiniBackFolderWithFallback(folder: string, optionId: string): string {
  const backFolder = `${folder}/back`;
  const hasBackPair = hasMiniAvatarAsset(backFolder, `${optionId}_color.png`)
    && hasMiniAvatarAsset(backFolder, `${optionId}_line.png`);

  return hasBackPair ? backFolder : folder;
}

export function resolveMiniBackAssetPair(
  folder: string,
  backColorFile: string,
  backLineFile: string,
  frontColorFile: string,
  frontLineFile: string,
  useBackAssets: boolean,
): MiniAssetPair {
  const backFolder = `${folder}/back`;
  const hasBackPair = useBackAssets
    && hasMiniAvatarAsset(backFolder, backColorFile)
    && hasMiniAvatarAsset(backFolder, backLineFile);

  return hasBackPair
    ? { folder: backFolder, colorFile: backColorFile, lineFile: backLineFile }
    : { folder, colorFile: frontColorFile, lineFile: frontLineFile };
}

export function getMiniSideFolderWithFallback(folder: string, optionId: string): string {
  const sideFolder = `${folder}/side`;

  if (hasMiniAvatarAsset(sideFolder, `${optionId}_color.png`) || hasMiniAvatarAsset(sideFolder, `${optionId}_line.png`)) {
    return sideFolder;
  }

  return folder;
}

export function getMiniHairLightFolder(direction: 'front' | 'back' | 'side', optionId: string): string {
  if (direction === 'front') {
    return 'hair_light';
  }

  const directionalFolder = `hair_light/${direction}`;
  return hasMiniAvatarAsset(directionalFolder, `${optionId}_line.png`)
    ? directionalFolder
    : 'hair_light';
}

export function getMiniCanvasPoint(point: MiniPoint): MiniPoint {
  return {
    x: MINI_CENTER_X + point.x * MINI_PIXEL_SCALE,
    y: point.y,
  };
}

export function getMiniScaledOffset(offset: MiniPoint): MiniPoint {
  return {
    x: offset.x * MINI_PIXEL_SCALE,
    y: offset.y * MINI_PIXEL_SCALE,
  };
}
