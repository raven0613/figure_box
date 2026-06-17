import {
  type AvatarAccessoryInstance,
  type AvatarColorGradient,
  type AvatarGradientType,
  type AvatarPartKey,
  type AvatarPartState,
  type AvatarState,
} from '~/widgets/avatarCanvas';
import { MINI_DEFAULT_EYE_LIGHT_DISTANCE } from '~/widgets/miniAvatarCanvas';
import {
  DEFAULT_PORTRAIT_EYE_LIGHT_DISTANCE,
  HOLD_ACCELERATION_TICKS,
  MAX_HOLD_MOVE_MULTIPLIER,
} from '~/components/avatarEditor/avatarEditorConstants';
import type { HairApplyTarget, HairLightPoseKey } from '~/components/avatarEditor/avatarEditorTypes';

export function isKeyboardInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
  );
}

export function hasPositionControls(editableProperties: readonly string[]): boolean {
  return editableProperties.includes('offsetX') || editableProperties.includes('offsetY');
}

export function getHoldMoveMultiplier(tickCount: number): number {
  const multiplier = 2 ** Math.floor(tickCount / HOLD_ACCELERATION_TICKS);
  return Math.min(MAX_HOLD_MOVE_MULTIPLIER, multiplier);
}

export function getSelectedLightDistance(partKey: AvatarPartKey, state: AvatarPartState): number {
  return state.lightDistance ?? (
    partKey === 'mini.eyeLight'
      ? MINI_DEFAULT_EYE_LIGHT_DISTANCE
      : DEFAULT_PORTRAIT_EYE_LIGHT_DISTANCE
  );
}

export function createDefaultColorGradient(type: AvatarGradientType, baseColor: string | undefined): AvatarColorGradient {
  return {
    type,
    fromColor: baseColor ?? '#808080',
    toColor: '#ffffff',
    position: 50,
    angle: 0,
    centerX: 0,
    centerY: 0,
  };
}

export function cloneAvatarColorGradient(colorGradient: AvatarColorGradient | undefined): AvatarColorGradient | undefined {
  return colorGradient ? { ...colorGradient } : undefined;
}

export function getHairApplyTargetColorState(
  target: HairApplyTarget,
  avatarState: AvatarState,
): AvatarPartState | AvatarAccessoryInstance | null {
  if (target.type === 'part') {
    return avatarState[target.key];
  }

  return avatarState.accessories.find(accessory => accessory.instanceId === target.instanceId) ?? null;
}

export function getHairLightMiniPartKey(poseKey: HairLightPoseKey): AvatarPartKey {
  if (poseKey === 'back') {
    return 'mini.hairLightBack';
  }

  if (poseKey === 'side') {
    return 'mini.hairLightSide';
  }

  return 'mini.hairLightFront';
}
