import { useEffect, useState } from 'react';

import type {
  AccessoryCategoryDefinition,
  AvatarCanvas,
  AvatarColorGradient,
  AvatarGradientCoordinateSpace,
  AvatarGradientType,
  AvatarPartDefinition,
  AvatarPartKey,
  AvatarPartState,
} from '~/widgets/avatarCanvas';
import type { HairApplyKind, HairApplyTarget, SelectedTarget } from '~/components/avatarEditor/avatarEditorTypes';
import {
  cloneAvatarColorGradient,
  createDefaultColorGradient,
} from '~/utils/avatarEditorUtils';

interface HairApplyPanelState {
  kind: HairApplyKind;
  selectedTargetIds: string[];
}

interface UseAvatarAppearanceActionsOptions {
  avatarCanvasRef: { current: AvatarCanvas | null };
  hairApplyTargets: HairApplyTarget[];
  isSelectedHairColorSource: boolean;
  selectedAccessoryDefinition: AccessoryCategoryDefinition | null;
  selectedAppearanceState: AvatarPartState;
  selectedLineColorPartKey?: AvatarPartKey;
  selectedLineColorState: AvatarPartState;
  selectedPart: AvatarPartDefinition | null;
  selectedPartState: AvatarPartState;
  selectedTarget: SelectedTarget;
  sharedHairColorTargets: HairApplyTarget[];
}

export function useAvatarAppearanceActions({
  avatarCanvasRef,
  hairApplyTargets,
  isSelectedHairColorSource,
  selectedAccessoryDefinition,
  selectedAppearanceState,
  selectedLineColorPartKey,
  selectedLineColorState,
  selectedPart,
  selectedPartState,
  selectedTarget,
  sharedHairColorTargets,
}: UseAvatarAppearanceActionsOptions) {
  const [hairApplyPanel, setHairApplyPanel] = useState<HairApplyPanelState | null>(null);

  useEffect(() => {
    setHairApplyPanel(null);
  }, [selectedTarget]);

  const selectOption = (optionId: number) => {
    if (selectedTarget.type === 'accessory') {
      avatarCanvasRef.current?.setAccessoryOption(selectedTarget.instanceId, optionId);
      return;
    }

    if (selectedPart) {
      avatarCanvasRef.current?.setOption(selectedPart.key, optionId);
    }
  };

  const setHairTargetColor = (
    target: HairApplyTarget,
    color: string,
    colorGradientSpace?: AvatarGradientCoordinateSpace,
  ) => {
    if (target.type === 'part') {
      avatarCanvasRef.current?.setColorWithGradientSpace(target.key, color, colorGradientSpace);
      return;
    }

    avatarCanvasRef.current?.setAccessoryColorWithGradientSpace(target.instanceId, color, colorGradientSpace);
  };

  const setHairTargetColorGradient = (
    target: HairApplyTarget,
    colorGradient: AvatarColorGradient | undefined,
    colorGradientSpace?: AvatarGradientCoordinateSpace,
  ) => {
    if (target.type === 'part') {
      avatarCanvasRef.current?.setColorGradientWithGradientSpace(target.key, colorGradient, colorGradientSpace);
      return;
    }

    avatarCanvasRef.current?.setAccessoryColorGradientWithGradientSpace(target.instanceId, colorGradient, colorGradientSpace);
  };

  const changeSharedHairColorTargets = (
    updateTarget: (target: HairApplyTarget) => void,
  ) => {
    sharedHairColorTargets.forEach(updateTarget);
  };

  const changeColor = (color: string) => {
    if (isSelectedHairColorSource && selectedAppearanceState.colorGradientSpace === 'sharedHair') {
      changeSharedHairColorTargets(target => setHairTargetColor(target, color, 'sharedHair'));
      return;
    }

    if (selectedTarget.type === 'accessory') {
      avatarCanvasRef.current?.setAccessoryColor(selectedTarget.instanceId, color);
      return;
    }

    if (selectedPart) {
      avatarCanvasRef.current?.setColor(selectedPart.key, color);
    }
  };

  const changeAccessoryColorVariant = (colorVariantId: number) => {
    if (selectedTarget.type !== 'accessory') {
      return;
    }

    avatarCanvasRef.current?.setAccessoryColorVariant(selectedTarget.instanceId, colorVariantId);
  };

  const changeColorGradient = (colorGradient: AvatarColorGradient | undefined) => {
    if (isSelectedHairColorSource && selectedAppearanceState.colorGradientSpace === 'sharedHair') {
      changeSharedHairColorTargets(target => (
        setHairTargetColorGradient(target, cloneAvatarColorGradient(colorGradient), 'sharedHair')
      ));
      return;
    }

    if (selectedTarget.type === 'accessory') {
      avatarCanvasRef.current?.setAccessoryColorGradient(selectedTarget.instanceId, colorGradient);
      return;
    }

    if (selectedPart) {
      avatarCanvasRef.current?.setColorGradient(selectedPart.key, colorGradient);
    }
  };

  const toggleSelectedSharedHairGradientSpace = () => {
    const nextGradientSpace = selectedAppearanceState.colorGradientSpace === 'sharedHair'
      ? undefined
      : 'sharedHair';

    if (selectedTarget.type === 'accessory') {
      avatarCanvasRef.current?.setAccessoryColorGradientSpace(selectedTarget.instanceId, nextGradientSpace);
      return;
    }

    if (selectedPart) {
      avatarCanvasRef.current?.setColorGradientSpace(selectedPart.key, nextGradientSpace);
    }
  };

  const changeColorGradientMode = (type: AvatarGradientType | 'solid') => {
    if (type === 'solid') {
      changeColorGradient(undefined);
      return;
    }

    changeColorGradient({
      ...(selectedAppearanceState.colorGradient
        ?? createDefaultColorGradient(type, selectedAppearanceState.color ?? selectedAccessoryDefinition?.defaultColor ?? selectedPart?.defaultColor)),
      type,
    });
  };

  const updateColorGradient = (patch: Partial<AvatarColorGradient>) => {
    const currentGradient = selectedAppearanceState.colorGradient
      ?? createDefaultColorGradient('linear', selectedAppearanceState.color ?? selectedAccessoryDefinition?.defaultColor ?? selectedPart?.defaultColor);

    changeColorGradient({
      ...currentGradient,
      ...patch,
    });
  };

  const changeLineColor = (lineColor: string) => {
    if (selectedTarget.type === 'accessory') {
      avatarCanvasRef.current?.setAccessoryLineColor(selectedTarget.instanceId, lineColor);
      return;
    }

    if (selectedLineColorPartKey) {
      avatarCanvasRef.current?.setLineColor(selectedLineColorPartKey, lineColor);
    }
  };

  const changeLineColorGradient = (lineColorGradient: AvatarColorGradient | undefined) => {
    if (selectedTarget.type === 'accessory') {
      avatarCanvasRef.current?.setAccessoryLineColorGradient(selectedTarget.instanceId, lineColorGradient);
      return;
    }

    if (selectedLineColorPartKey) {
      avatarCanvasRef.current?.setLineColorGradient(selectedLineColorPartKey, lineColorGradient);
    }
  };

  const changeLineColorGradientMode = (type: AvatarGradientType | 'solid') => {
    if (type === 'solid') {
      changeLineColorGradient(undefined);
      return;
    }

    changeLineColorGradient({
      ...(selectedLineColorState.lineColorGradient
        ?? createDefaultColorGradient(
          type,
          selectedLineColorState.lineColor ?? selectedAccessoryDefinition?.defaultLineColor ?? selectedPart?.defaultLineColor,
        )),
      type,
    });
  };

  const updateLineColorGradient = (patch: Partial<AvatarColorGradient>) => {
    const currentGradient = selectedLineColorState.lineColorGradient
      ?? createDefaultColorGradient(
        'linear',
        selectedLineColorState.lineColor ?? selectedAccessoryDefinition?.defaultLineColor ?? selectedPart?.defaultLineColor,
      );

    changeLineColorGradient({
      ...currentGradient,
      ...patch,
    });
  };

  const openHairApplyPanel = (kind: HairApplyKind) => {
    setHairApplyPanel(currentPanel => currentPanel?.kind === kind
      ? null
      : { kind, selectedTargetIds: [] });
  };

  const toggleHairApplyTarget = (targetId: string, isSelected: boolean) => {
    setHairApplyPanel(currentPanel => {
      if (!currentPanel) {
        return currentPanel;
      }

      const selectedTargetIds = isSelected
        ? [...currentPanel.selectedTargetIds, targetId]
        : currentPanel.selectedTargetIds.filter(selectedTargetId => selectedTargetId !== targetId);

      return {
        ...currentPanel,
        selectedTargetIds: Array.from(new Set(selectedTargetIds)),
      };
    });
  };

  const setAllHairApplyTargets = (isSelected: boolean) => {
    setHairApplyPanel(currentPanel => currentPanel
      ? {
        ...currentPanel,
        selectedTargetIds: isSelected ? hairApplyTargets.map(target => target.id) : [],
      }
      : currentPanel);
  };

  const applyHairSettingsToTargets = (colorGradientSpace?: AvatarGradientCoordinateSpace) => {
    if (!hairApplyPanel) {
      return;
    }

    const selectedTargets = hairApplyTargets.filter(target => hairApplyPanel.selectedTargetIds.includes(target.id));
    const sourceColor = selectedAppearanceState.color
      ?? selectedAccessoryDefinition?.defaultColor
      ?? selectedPart?.defaultColor
      ?? '#000000';
    const sourceLineColor = selectedLineColorState.lineColor
      ?? selectedAccessoryDefinition?.defaultLineColor
      ?? selectedPart?.defaultLineColor
      ?? '#262626';
    const sourceColorGradient = cloneAvatarColorGradient(selectedAppearanceState.colorGradient);
    const sourceLineColorGradient = cloneAvatarColorGradient(selectedLineColorState.lineColorGradient);

    selectedTargets.forEach(target => {
      if (hairApplyPanel.kind === 'color') {
        if (target.type === 'part') {
          avatarCanvasRef.current?.setColor(target.key, sourceColor);
          avatarCanvasRef.current?.setColorGradient(target.key, cloneAvatarColorGradient(sourceColorGradient));
          avatarCanvasRef.current?.setColorGradientSpace(target.key, colorGradientSpace);
          return;
        }

        avatarCanvasRef.current?.setAccessoryColor(target.instanceId, sourceColor);
        avatarCanvasRef.current?.setAccessoryColorGradient(target.instanceId, cloneAvatarColorGradient(sourceColorGradient));
        avatarCanvasRef.current?.setAccessoryColorGradientSpace(target.instanceId, colorGradientSpace);
        return;
      }

      if (target.type === 'part') {
        avatarCanvasRef.current?.setLineColor(target.key, sourceLineColor);
        avatarCanvasRef.current?.setLineColorGradient(target.key, cloneAvatarColorGradient(sourceLineColorGradient));
        return;
      }

      avatarCanvasRef.current?.setAccessoryLineColor(target.instanceId, sourceLineColor);
      avatarCanvasRef.current?.setAccessoryLineColorGradient(target.instanceId, cloneAvatarColorGradient(sourceLineColorGradient));
    });

    setHairApplyPanel(null);
  };

  const changeSecondaryColor = (secondaryColor: string) => {
    if (selectedTarget.type === 'part' && selectedPart) {
      avatarCanvasRef.current?.setSecondaryColor(selectedPart.key, secondaryColor);
    }
  };

  const changeSecondaryColorGradient = (secondaryColorGradient: AvatarColorGradient | undefined) => {
    if (selectedTarget.type === 'part' && selectedPart) {
      avatarCanvasRef.current?.setSecondaryColorGradient(selectedPart.key, secondaryColorGradient);
    }
  };

  const changeSecondaryColorGradientMode = (type: AvatarGradientType | 'solid') => {
    if (type === 'solid') {
      changeSecondaryColorGradient(undefined);
      return;
    }

    changeSecondaryColorGradient({
      ...(selectedPartState.secondaryColorGradient
        ?? createDefaultColorGradient(type, selectedPartState.secondaryColor ?? selectedPartState.color ?? selectedPart?.defaultColor)),
      type,
    });
  };

  const updateSecondaryColorGradient = (patch: Partial<AvatarColorGradient>) => {
    const currentGradient = selectedPartState.secondaryColorGradient
      ?? createDefaultColorGradient('linear', selectedPartState.secondaryColor ?? selectedPartState.color ?? selectedPart?.defaultColor);

    changeSecondaryColorGradient({
      ...currentGradient,
      ...patch,
    });
  };

  const setPartVisible = (isVisible: boolean) => {
    if (selectedTarget.type === 'part' && selectedPart) {
      avatarCanvasRef.current?.setVisible(selectedPart.key, isVisible);
    }
  };

  const setClothingLayerOrder = (layerOrder: number) => {
    if (selectedTarget.type === 'part' && selectedPart) {
      avatarCanvasRef.current?.setClothingLayerOrder(selectedPart.key, layerOrder);
    }
  };

  return {
    applyHairSettingsToTargets,
    changeAccessoryColorVariant,
    changeColor,
    changeColorGradientMode,
    changeLineColor,
    changeLineColorGradientMode,
    changeSecondaryColor,
    changeSecondaryColorGradientMode,
    hairApplyPanel,
    openHairApplyPanel,
    selectOption,
    setAllHairApplyTargets,
    setClothingLayerOrder,
    setPartVisible,
    toggleHairApplyTarget,
    toggleSelectedSharedHairGradientSpace,
    updateColorGradient,
    updateLineColorGradient,
    updateSecondaryColorGradient,
  };
}
