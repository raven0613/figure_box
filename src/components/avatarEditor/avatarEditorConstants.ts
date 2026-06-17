import type { AvatarEditableProperty } from '~/widgets/avatarCanvas';

export const MOVE_STEP = 1;
export const AVATAR_DRAFT_AUTOSAVE_DELAY_MS = 900;
export const HOLD_MOVE_DELAY_MS = 300;
export const HOLD_MOVE_INTERVAL_MS = 90;
export const HOLD_ACCELERATION_TICKS = 8;
export const MAX_HOLD_MOVE_MULTIPLIER = 16;
export const ROTATE_STEP = 5;
export const SCALE_STEP = 0.05;
export const LIGHT_DISTANCE_STEP = 2;
export const UPPER_EYELID_CHIBI_EDITABLE_PROPERTIES: AvatarEditableProperty[] = ['lineColor', 'offsetY', 'rotate'];
export const EYE_LIGHT_CHIBI_EDITABLE_PROPERTIES: AvatarEditableProperty[] = ['offsetX', 'offsetY'];
export const EYELID_CHIBI_EDITABLE_PROPERTIES: AvatarEditableProperty[] = ['lineColor'];
export const HAIR_LIGHT_MINI_EDITABLE_PROPERTIES: AvatarEditableProperty[] = ['offsetX', 'offsetY'];
export const DEFAULT_PORTRAIT_EYE_LIGHT_DISTANCE = 45;
