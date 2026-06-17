import type {
  AccessoryCategory,
  AccessoryLayerSlot,
  AccessoryPoseKey,
  AvatarAccessoryInstance,
  AvatarCanvas,
} from '~/widgets/avatarCanvas';
import type { SelectedTarget } from '~/components/avatarEditor/avatarEditorTypes';

interface UseAvatarAccessoryActionsOptions {
  avatarCanvasRef: { current: AvatarCanvas | null };
  draggingAccessoryId: string | null;
  selectedAccessory: AvatarAccessoryInstance | null;
  selectedAccessoryPoseKey: AccessoryPoseKey;
  onDraggingAccessoryChange: (instanceId: string | null) => void;
  onSelectAccessoryPose: (poseKey: AccessoryPoseKey) => void;
  onSelectTarget: (target: SelectedTarget) => void;
}

export function useAvatarAccessoryActions({
  avatarCanvasRef,
  draggingAccessoryId,
  selectedAccessory,
  selectedAccessoryPoseKey,
  onDraggingAccessoryChange,
  onSelectAccessoryPose,
  onSelectTarget,
}: UseAvatarAccessoryActionsOptions) {
  const addAccessory = (category: AccessoryCategory) => {
    const instanceId = avatarCanvasRef.current?.addAccessory(category);

    if (instanceId) {
      onSelectTarget({ type: 'accessory', instanceId });
      onSelectAccessoryPose('portrait');
    }
  };

  const removeSelectedAccessory = () => {
    if (!selectedAccessory) {
      return;
    }

    avatarCanvasRef.current?.removeAccessory(selectedAccessory.instanceId);
    onSelectTarget({ type: 'part', key: 'face' });
    onSelectAccessoryPose('portrait');
  };

  const changeAccessoryLayerSlot = (layerSlot: AccessoryLayerSlot) => {
    if (!selectedAccessory) {
      return;
    }

    avatarCanvasRef.current?.setAccessoryLayerSlot(
      selectedAccessory.instanceId,
      layerSlot
    );
  };

  const estimateChibiPoseFromPortrait = () => {
    if (
      !selectedAccessory ||
      (selectedAccessoryPoseKey !== 'chibi' && selectedAccessoryPoseKey !== 'chibiSide')
    ) {
      return;
    }

    avatarCanvasRef.current?.estimateAccessoryChibiPoseFromPortrait(
      selectedAccessory.instanceId,
      selectedAccessoryPoseKey,
    );
  };

  const setChibiBackFollowingFront = (shouldFollow: boolean) => {
    if (!selectedAccessory) {
      return;
    }

    avatarCanvasRef.current?.setAccessoryChibiBackFollowingFront(
      selectedAccessory.instanceId,
      shouldFollow,
    );
  };

  const applyChibiBackMirror = () => {
    if (!selectedAccessory || selectedAccessory.isChibiBackFollowingFront) {
      return;
    }

    avatarCanvasRef.current?.applyAccessoryChibiBackMirror(selectedAccessory.instanceId);
  };

  const dropAccessoryOn = (targetAccessory: AvatarAccessoryInstance) => {
    if (!draggingAccessoryId || draggingAccessoryId === targetAccessory.instanceId) {
      return;
    }

    avatarCanvasRef.current?.reorderAccessoryWithinSlot(draggingAccessoryId, targetAccessory.instanceId);
    onDraggingAccessoryChange(null);
  };

  return {
    addAccessory,
    applyChibiBackMirror,
    changeAccessoryLayerSlot,
    dropAccessoryOn,
    estimateChibiPoseFromPortrait,
    removeSelectedAccessory,
    setChibiBackFollowingFront,
  };
}
