import { AVATAR_RIG_COLORS } from '../../constants/avatarRig';
import {
  createAssetOptionDefinitions,
  createHairLightOptionDefinitions,
  createMiniDirectoryOptionDefinitions,
  createMouthOptionDefinitions,
} from './avatarAssets';
import type {
  AvatarEditableProperty,
  AvatarGroupKey,
  AvatarPartDefinition,
  AvatarPartKey,
  AvatarPartOption,
} from './avatarTypes';

const DEFAULT_LINE_COLOR = AVATAR_RIG_COLORS.line;

const NON_TINTABLE_MINI_CLOTHING_OPTIONS = {
  tops: new Set([1, 2, 3, 4]),
  bottoms: new Set<number>(),
};

export const AVATAR_PART_DEFINITIONS: AvatarPartDefinition[] = [
  createDefinition('hair.backHair', 'back hair bottom', 0, AVATAR_RIG_COLORS.hair, createAssetOptionDefinitions('back_hair_bottom', 'back hair bottom'), 'hair'),
  createDefinition('hair.topHair', 'back hair top', 1, AVATAR_RIG_COLORS.hair, createAssetOptionDefinitions('back_hair_top', 'back hair top'), 'hair'),
  createDefinition('face.color', 'face color', 2, AVATAR_RIG_COLORS.skin, createAssetOptionDefinitions('face', 'face color'), undefined, ['color', 'offsetX', 'offsetY', 'rotate', 'scale', 'flipX'], true),
  createDefinition('ear', 'ear', 3, AVATAR_RIG_COLORS.skin, createAssetOptionDefinitions('ear', 'ear'), undefined, ['lineColor', 'offsetX', 'offsetY', 'rotate', 'scale', 'flipX']),
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
  createDefinition('eyes.color', 'eye ball', 7, AVATAR_RIG_COLORS.eyeBall, createAssetOptionDefinitions('eyeball', 'eye ball'), 'eyes'),
  createDefinition('eyes.light', 'eye light', 8, AVATAR_RIG_COLORS.eyeLight, 1, 'eyes'),
  createDefinition('eyes.lowerEyelid', 'lower eyelid', 9, AVATAR_RIG_COLORS.lowerEyelidColor, createAssetOptionDefinitions('lower_eyelid', 'lower eyelid'), 'eyes', ['lineColor', 'offsetX', 'offsetY', 'rotate', 'scale', 'flipX'], false, AVATAR_RIG_COLORS.lowerEyelidLine),
  createDefinition('eyes.upperEyelid', 'upper eyelid', 10, AVATAR_RIG_COLORS.upperEyelid, createAssetOptionDefinitions('upper_eyelid', 'upper eyelid'), 'eyes', ['lineColor', 'offsetX', 'offsetY', 'rotate', 'scale', 'flipX'], false, AVATAR_RIG_COLORS.upperEyelid),
  createDefinition('eyes.eyelid', 'eyelid', 11, AVATAR_RIG_COLORS.eyelid, createAssetOptionDefinitions('eyelid', 'eyelid'), 'eyes', undefined, false, AVATAR_RIG_COLORS.eyelid),
  createDefinition('eyes.eyebrow', 'eyebrow', 12, AVATAR_RIG_COLORS.eyebrow, createAssetOptionDefinitions('eyebrow', 'eyebrow'), 'eyes', undefined, false, AVATAR_RIG_COLORS.eyebrow),
  createDefinition('nose', 'nose', 13, AVATAR_RIG_COLORS.nose, createAssetOptionDefinitions('nose', 'nose')),
  createDefinition('mouth', 'mouth', 14, AVATAR_RIG_COLORS.mouth, createMouthOptionDefinitions(), undefined, undefined, false, AVATAR_RIG_COLORS.mouth),
  createDefinition('face.line', 'face line', 15, AVATAR_RIG_COLORS.skin, createAssetOptionDefinitions('face', 'face line'), undefined, ['lineColor', 'offsetX', 'offsetY', 'rotate', 'scale', 'flipX'], true),
  createDefinition('hair.bangs', 'bangs', 17, AVATAR_RIG_COLORS.hair, createAssetOptionDefinitions('bangs', 'bangs'), 'hair'),
  createDefinition(
    'hair.light',
    'hair light',
    18,
    AVATAR_RIG_COLORS.hairLight,
    createHairLightOptionDefinitions(),
    'hair',
    ['color', 'offsetX', 'offsetY', 'rotate', 'scale', 'flipX'],
  ),
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
    'mini.hairLightFront',
    'mini front hair light',
    AVATAR_RIG_COLORS.hairLight,
    [{ id: 1, label: 'mini front hair light 1' }],
    ['offsetX', 'offsetY'],
    DEFAULT_LINE_COLOR,
    true,
  ),
  createMiniOnlyDefinition(
    'mini.hairLightBack',
    'mini back hair light',
    AVATAR_RIG_COLORS.hairLight,
    [{ id: 1, label: 'mini back hair light 1' }],
    ['offsetX', 'offsetY'],
    DEFAULT_LINE_COLOR,
    true,
  ),
  createMiniOnlyDefinition(
    'mini.hairLightSide',
    'mini side hair light',
    AVATAR_RIG_COLORS.hairLight,
    [{ id: 1, label: 'mini side hair light 1' }],
    ['offsetX', 'offsetY'],
    DEFAULT_LINE_COLOR,
    true,
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

export function getDefaultSecondaryColor(key: AvatarPartKey, defaultColor?: string): string | undefined {
  if (key === 'eyes.color') {
    return defaultColor;
  }

  if (key === 'mini.clothingBottom') {
    return AVATAR_RIG_COLORS.clothingBottomSideDeco;
  }

  return undefined;
}

export function isAvatarPartOptionColorEditable(key: AvatarPartKey, optionId: number): boolean {
  const definition = AVATAR_PART_DEFINITIONS.find(item => item.key === key);
  const option = definition?.options.find(item => item.id === optionId);

  return option?.isColorEditable !== false;
}

function createDefinition(
  key: AvatarPartKey,
  label: string,
  zIndex: number,
  defaultColor: string,
  optionSource: number | AvatarPartOption[],
  parentKey?: AvatarGroupKey,
  editableProperties: AvatarEditableProperty[] = ['color', 'lineColor', 'offsetX', 'offsetY', 'rotate', 'scale', 'flipX'],
  isEditorHidden = false,
  defaultLineColor: string = DEFAULT_LINE_COLOR,
): AvatarPartDefinition {
  return {
    key,
    label,
    zIndex,
    defaultColor,
    defaultLineColor,
    editableProperties,
    isEditorHidden,
    options: typeof optionSource === 'number'
      ? createNumberedOptionDefinitions(optionSource, label)
      : optionSource,
    parentKey,
  };
}

function createMiniOnlyDefinition(
  key: AvatarPartKey,
  label: string,
  defaultColor: string,
  options: AvatarPartOption[],
  editableProperties: AvatarEditableProperty[],
  defaultLineColor: string = DEFAULT_LINE_COLOR,
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
