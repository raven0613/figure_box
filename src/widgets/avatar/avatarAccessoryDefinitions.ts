import { AVATAR_RIG_COLORS } from '../../constants/avatarRig';
import {
  createAssetOptionDefinitions,
  formatOptionId,
  getAvatarAssetPaths,
} from './avatarAssets';
import type {
  AccessoryCategory,
  AccessoryCategoryDefinition,
  AccessoryColorVariantOption,
  AccessoryLayerSlot,
  AccessoryLayerSlotDefinition,
  AccessoryRenderMode,
  AvatarAccessoryInstance,
  AvatarEditableProperty,
} from './avatarTypes';

const DEFAULT_LINE_COLOR = AVATAR_RIG_COLORS.line;

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
  createAccessoryCategoryDefinition(
    'skinMarking',
    '肌膚印記',
    'accessory/skin_marking',
    'center',
    AVATAR_RIG_COLORS.accessory,
    'frontFace',
    ['onSkin', 'frontBody', 'frontFace', 'frontBangs'],
    ['lineColor', 'offsetX', 'offsetY', 'rotate', 'scale', 'flipX'],
  ),
];

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

export function getAccessoryColorVariantOptions(
  category: AccessoryCategory,
  optionId: number,
): AccessoryColorVariantOption[] {
  const definition = getAccessoryCategoryDefinition(category);
  const formattedOptionId = formatOptionId(optionId);
  const variants = new Map<number, AccessoryColorVariantOption>();
  const assetPathPattern = new RegExp(
    `^\\.\\./\\.\\./assets/avatar_system/${definition.assetFolder}/${formattedOptionId}_color_(\\d+)\\.png$`,
  );

  getAvatarAssetPaths().forEach(assetPath => {
    const match = assetPath.match(assetPathPattern);

    if (!match) {
      return;
    }

    const id = Number(match[1]);
    const file = `${formattedOptionId}_color_${match[1]}.png`;
    variants.set(id, {
      id,
      file,
      label: file.replace(/\.png$/, ''),
    });
  });

  return [...variants.values()].sort((first, second) => first.id - second.id);
}

export function resolveAccessoryColorFileName(
  category: AccessoryCategory,
  optionId: number,
  colorVariantId?: number,
): string {
  const variants = getAccessoryColorVariantOptions(category, optionId);
  const selectedVariant = variants.find(variant => variant.id === colorVariantId) ?? variants[0];

  return selectedVariant?.file ?? `${formatOptionId(optionId)}_color.png`;
}

function createAccessoryCategoryDefinition(
  category: AccessoryCategory,
  label: string,
  assetFolder: string,
  renderMode: AccessoryRenderMode,
  defaultColor: string,
  defaultLayerSlot: AccessoryLayerSlot,
  allowedLayerSlots: AccessoryLayerSlot[],
  editableProperties: AvatarEditableProperty[] = ['color', 'lineColor', 'offsetX', 'offsetY', 'rotate', 'scale', 'flipX'],
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
    editableProperties,
    options: createAssetOptionDefinitions(assetFolder, label),
  };
}
