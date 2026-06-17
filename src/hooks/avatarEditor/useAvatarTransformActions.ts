import { useEffect } from 'react';

import type {
  AccessoryPoseKey,
  AvatarCanvas,
  AvatarEditableProperty,
  AvatarPartKey,
} from '~/widgets/avatarCanvas';
import { MOVE_STEP } from '~/components/avatarEditor/avatarEditorConstants';
import type { SelectedTarget } from '~/components/avatarEditor/avatarEditorTypes';
import { hasPositionControls, isKeyboardInputTarget } from '~/utils/avatarEditorUtils';
import { useHoldMove } from './useHoldMove';

interface UseAvatarTransformActionsOptions {
  avatarCanvasRef: { current: AvatarCanvas | null };
  canMoveX: boolean;
  isAccessoryBackPoseFollowingFront: boolean;
  isMoveDownDisabled: boolean;
  isMoveUpDisabled: boolean;
  selectedAccessoryPoseKey: AccessoryPoseKey;
  selectedEditableProperties: readonly AvatarEditableProperty[];
  selectedLightDistance: number;
  selectedPartControlKey?: AvatarPartKey;
  selectedTarget: SelectedTarget;
}

export function useAvatarTransformActions({
  avatarCanvasRef,
  canMoveX,
  isAccessoryBackPoseFollowingFront,
  isMoveDownDisabled,
  isMoveUpDisabled,
  selectedAccessoryPoseKey,
  selectedEditableProperties,
  selectedLightDistance,
  selectedPartControlKey,
  selectedTarget,
}: UseAvatarTransformActionsOptions) {
  const movePart = (deltaX: number, deltaY: number) => {
    if (selectedTarget.type === 'accessory') {
      if (isAccessoryBackPoseFollowingFront) {
        return;
      }

      avatarCanvasRef.current?.moveAccessory(selectedTarget.instanceId, deltaX, deltaY, selectedAccessoryPoseKey);
      return;
    }

    if (selectedPartControlKey) {
      avatarCanvasRef.current?.move(selectedPartControlKey, deltaX, deltaY);
    }
  };

  const { startHoldMove, stopHoldMove } = useHoldMove(movePart);

  useEffect(() => {
    const handleKeyboardMove = (event: KeyboardEvent) => {
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isKeyboardInputTarget(event.target) ||
        !hasPositionControls(selectedEditableProperties)
      ) {
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();

        if (!isMoveUpDisabled) {
          movePart(0, -MOVE_STEP);
        }
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();

        if (!isMoveDownDisabled) {
          movePart(0, MOVE_STEP);
        }
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();

        if (canMoveX) {
          movePart(-MOVE_STEP, 0);
        }
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();

        if (canMoveX) {
          movePart(MOVE_STEP, 0);
        }
      }
    };

    window.addEventListener('keydown', handleKeyboardMove);

    return () => {
      window.removeEventListener('keydown', handleKeyboardMove);
    };
  }, [canMoveX, isMoveDownDisabled, isMoveUpDisabled, movePart, selectedEditableProperties]);

  const rotatePart = (delta: number) => {
    if (selectedTarget.type === 'accessory') {
      if (isAccessoryBackPoseFollowingFront) {
        return;
      }

      avatarCanvasRef.current?.rotateAccessory(selectedTarget.instanceId, delta, selectedAccessoryPoseKey);
      return;
    }

    if (selectedPartControlKey) {
      avatarCanvasRef.current?.rotate(selectedPartControlKey, delta);
    }
  };

  const scalePart = (delta: number) => {
    if (selectedTarget.type === 'accessory') {
      if (isAccessoryBackPoseFollowingFront) {
        return;
      }

      avatarCanvasRef.current?.scaleAccessory(selectedTarget.instanceId, delta, selectedAccessoryPoseKey);
      return;
    }

    if (selectedPartControlKey) {
      avatarCanvasRef.current?.scale(selectedPartControlKey, delta);
    }
  };

  const flipPart = () => {
    if (selectedTarget.type === 'accessory') {
      if (isAccessoryBackPoseFollowingFront) {
        return;
      }

      avatarCanvasRef.current?.flipAccessory(selectedTarget.instanceId, selectedAccessoryPoseKey);
      return;
    }

    if (selectedPartControlKey) {
      avatarCanvasRef.current?.flip(selectedPartControlKey);
    }
  };

  const setSideVisible = (side: 'left' | 'right', isVisible: boolean) => {
    if (selectedTarget.type === 'accessory') {
      if (isAccessoryBackPoseFollowingFront) {
        return;
      }

      avatarCanvasRef.current?.setAccessorySideVisible(
        selectedTarget.instanceId,
        side,
        isVisible,
        selectedAccessoryPoseKey,
      );
    }
  };

  const changeLightDistance = (delta: number) => {
    if (!selectedPartControlKey) {
      return;
    }

    avatarCanvasRef.current?.setLightDistance(
      selectedPartControlKey,
      selectedLightDistance + delta
    );
  };

  return {
    changeLightDistance,
    flipPart,
    movePart,
    rotatePart,
    scalePart,
    setSideVisible,
    startHoldMove,
    stopHoldMove,
  };
}
