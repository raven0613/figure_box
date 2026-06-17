import { useEffect, useMemo, useState } from 'react';

import {
  ACCESSORY_LAYER_SLOT_DEFINITIONS,
  AccessoryCategory,
  AccessoryPoseKey,
  AVATAR_EDITOR_PART_DEFINITIONS,
  AvatarPartKey,
  AvatarPartState,
  AvatarState,
  getAccessoryCategoryDefinition,
  getAccessoryColorVariantOptions,
  getAccessoryDisplayName,
  getAccessoryPoseState,
  isAvatarPartOptionColorEditable,
  MINI_UPPER_EYELID_OFFSET_Y_LIMITS,
} from '~/widgets/avatarCanvas';
import {
  EYE_LIGHT_CHIBI_EDITABLE_PROPERTIES,
  EYELID_CHIBI_EDITABLE_PROPERTIES,
  HAIR_LIGHT_MINI_EDITABLE_PROPERTIES,
  UPPER_EYELID_CHIBI_EDITABLE_PROPERTIES,
} from './avatarEditorConstants';
import { AvatarEditorOptionPanel } from './AvatarEditorOptionPanel';
import { AvatarEditorSidebar } from './AvatarEditorSidebar';
import { AvatarEditorStage } from './AvatarEditorStage';
import { AvatarEditorTemplateActionModal } from './AvatarEditorTemplateActionModal';
import type {
  HairApplyTarget,
  HairLightPoseKey,
  PortraitChibiPoseKey,
  SelectedTarget,
} from './avatarEditorTypes';
import {
  getHairApplyTargetColorState,
  getHairLightMiniPartKey,
  getSelectedLightDistance,
} from '~/utils/avatarEditorUtils';
import { useAvatarAccessoryActions } from '~/hooks/avatarEditor/useAvatarAccessoryActions';
import { useAvatarAppearanceActions } from '~/hooks/avatarEditor/useAvatarAppearanceActions';
import { useAvatarCanvasInstances } from '~/hooks/avatarEditor/useAvatarCanvasInstances';
import { useAvatarDraftAutosave } from '~/hooks/avatarEditor/useAvatarDraftAutosave';
import { useAvatarTemplates } from '~/hooks/avatarEditor/useAvatarTemplates';
import { useAvatarTransformActions } from '~/hooks/avatarEditor/useAvatarTransformActions';
import styles from './avatarEditor.module.scss';

interface AvatarEditorContainerProps {
  initialState?: Partial<AvatarState>;
  onAvatarChange?: (state: AvatarState) => void;
}

const HAIR_COLOR_PART_KEYS: readonly AvatarPartKey[] = ['hair.backHair', 'hair.topHair', 'hair.bangs'];
const HAIR_ACCESSORY_CATEGORIES: readonly AccessoryCategory[] = ['sideHair', 'ponytail'];

export function AvatarEditorContainer({ initialState, onAvatarChange }: AvatarEditorContainerProps) {
  // 預設選項
  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget>({ type: 'part', key: 'mini.bodyType' });
  const [selectedAccessoryPoseKey, setSelectedAccessoryPoseKey] = useState<AccessoryPoseKey>('portrait');
  const [selectedUpperEyelidPoseKey, setSelectedUpperEyelidPoseKey] = useState<PortraitChibiPoseKey>('portrait');
  const [selectedEyeLightPoseKey, setSelectedEyeLightPoseKey] = useState<PortraitChibiPoseKey>('portrait');
  const [selectedEyelidPoseKey, setSelectedEyelidPoseKey] = useState<PortraitChibiPoseKey>('portrait');
  const [selectedHairLightPoseKey, setSelectedHairLightPoseKey] = useState<HairLightPoseKey>('portrait');
  const [draggingAccessoryId, setDraggingAccessoryId] = useState<string | null>(null);
  const [canUseNativeDrag, setCanUseNativeDrag] = useState(false);
  const {
    draftSaveStatus,
    scheduleDraftAutosave,
    setDraftSaveStatus,
  } = useAvatarDraftAutosave();
  const {
    avatarCanvasRef,
    avatarState,
    canvasHostRef,
    miniAnimationCanvasHostRef,
    miniBackCanvasHostRef,
    miniCanvasHostRef,
    miniSideCanvasHostRef,
    selectedMiniAnimationId,
    setSelectedMiniAnimationId,
    spriteSheet,
    spriteSheetAnimationStyle,
    spriteSheetFrameIndex,
  } = useAvatarCanvasInstances({
    initialState,
    onAvatarChange,
    onAvatarStateChange: scheduleDraftAutosave,
  });
  const {
    avatarTemplates,
    confirmTemplateAction,
    pendingTemplateAction,
    saveCurrentTemplate,
    setPendingTemplateAction,
    setTemplateName,
    templateName,
  } = useAvatarTemplates({
    avatarCanvasRef,
    avatarState,
    onError: () => setDraftSaveStatus('error'),
    onLoadTemplate: () => {
      setSelectedTarget({ type: 'part', key: 'face' });
      setSelectedAccessoryPoseKey('portrait');
    },
    onResetAvatar: () => {
      setSelectedTarget({ type: 'part', key: 'mini.bodyType' });
      setSelectedAccessoryPoseKey('portrait');
      setSelectedUpperEyelidPoseKey('portrait');
      setSelectedEyeLightPoseKey('portrait');
      setSelectedEyelidPoseKey('portrait');
      setSelectedHairLightPoseKey('portrait');
    },
  });
  const selectedPart = useMemo(
    () => selectedTarget.type === 'part'
      ? AVATAR_EDITOR_PART_DEFINITIONS.find(part => part.key === selectedTarget.key) ?? AVATAR_EDITOR_PART_DEFINITIONS[0]
      : null,
    [selectedTarget]
  );
  const selectedAccessory = useMemo(
    () => selectedTarget.type === 'accessory'
      ? avatarState.accessories.find(accessory => accessory.instanceId === selectedTarget.instanceId) ?? null
      : null,
    [avatarState.accessories, selectedTarget]
  );
  const selectedAccessoryDefinition = selectedAccessory
    ? getAccessoryCategoryDefinition(selectedAccessory.category)
    : null;
  const selectedAccessoryColorVariants = selectedAccessory
    ? getAccessoryColorVariantOptions(selectedAccessory.category, selectedAccessory.optionId)
    : [];
  const selectedAccessoryColorVariantId = selectedAccessoryColorVariants.some(
    variant => variant.id === selectedAccessory?.colorVariantId,
  )
    ? selectedAccessory?.colorVariantId
    : selectedAccessoryColorVariants[0]?.id;
  const selectedOptions = selectedAccessoryDefinition?.options ?? selectedPart?.options ?? [];
  const baseEditableProperties = selectedAccessoryDefinition?.editableProperties ?? selectedPart?.editableProperties ?? [];
  const isUpperEyelidPart = selectedTarget.type === 'part' && selectedPart?.key === 'eyes.upperEyelid';
  const isEyeLightPart = selectedTarget.type === 'part' && selectedPart?.key === 'eyes.light';
  const isEyelidPart = selectedTarget.type === 'part' && selectedPart?.key === 'eyes.eyelid';
  const isHairLightPart = selectedTarget.type === 'part' && selectedPart?.key === 'hair.light';
  const isMiniClothingBottomPart = selectedTarget.type === 'part' && selectedPart?.key === 'mini.clothingBottom';
  const isUpperEyelidChibiMode = isUpperEyelidPart && selectedUpperEyelidPoseKey === 'chibi';
  const isEyeLightChibiMode = isEyeLightPart && selectedEyeLightPoseKey === 'chibi';
  const isEyelidChibiMode = isEyelidPart && selectedEyelidPoseKey === 'chibi';
  const isHairLightMiniMode = isHairLightPart && selectedHairLightPoseKey !== 'portrait';
  const selectedEditableProperties = isUpperEyelidChibiMode
    ? UPPER_EYELID_CHIBI_EDITABLE_PROPERTIES
    : isEyeLightChibiMode
      ? EYE_LIGHT_CHIBI_EDITABLE_PROPERTIES
      : isEyelidChibiMode
        ? EYELID_CHIBI_EDITABLE_PROPERTIES
        : isHairLightMiniMode
          ? HAIR_LIGHT_MINI_EDITABLE_PROPERTIES
          : baseEditableProperties;
  const selectedLabel = selectedAccessory ? getAccessoryDisplayName(selectedAccessory) : selectedPart?.label ?? '';
  const selectedAccessoryPose = selectedAccessory
    ? getAccessoryPoseState(selectedAccessory, selectedAccessoryPoseKey)
    : null;
  const isAccessoryBackPoseFollowingFront = selectedAccessoryPoseKey === 'chibiBack'
    && selectedAccessory?.isChibiBackFollowingFront === true;
  const canMoveX = selectedEditableProperties.includes('offsetX') && !isAccessoryBackPoseFollowingFront;
  const canMoveY = selectedEditableProperties.includes('offsetY') && !isAccessoryBackPoseFollowingFront;
  const selectedPartState = selectedPart ? avatarState[selectedPart.key] : avatarState.face;
  const selectedPartControlKey = isUpperEyelidChibiMode
    ? 'mini.upperEyelid'
    : isEyeLightChibiMode
      ? 'mini.eyeLight'
      : isEyelidChibiMode
        ? 'mini.eyelid'
        : isHairLightMiniMode
          ? getHairLightMiniPartKey(selectedHairLightPoseKey)
          : selectedPart?.key;
  const selectedPartControlState = isUpperEyelidChibiMode
    ? avatarState['mini.upperEyelid']
    : isEyeLightChibiMode
      ? avatarState['mini.eyeLight']
      : isEyelidChibiMode
        ? avatarState['mini.eyelid']
        : isHairLightMiniMode
          ? avatarState[getHairLightMiniPartKey(selectedHairLightPoseKey)]
          : selectedPartState;
  const selectedAppearanceState = selectedAccessory ?? selectedPartState;
  const selectedState = selectedAccessoryPose ?? selectedPartControlState;
  const selectedLineColorState = isEyelidChibiMode ? avatarState['mini.eyelid'] : selectedAppearanceState;
  const selectedLineColorPartKey = isEyelidChibiMode ? 'mini.eyelid' : selectedPart?.key;
  const isMiniUpperEyelidControl = selectedPartControlKey === 'mini.upperEyelid';
  const isMoveUpDisabled = !canMoveY || (
    isMiniUpperEyelidControl &&
    (selectedState.offsetY ?? 0) <= MINI_UPPER_EYELID_OFFSET_Y_LIMITS.min
  );
  const isMoveDownDisabled = !canMoveY || (
    isMiniUpperEyelidControl &&
    (selectedState.offsetY ?? 0) >= MINI_UPPER_EYELID_OFFSET_Y_LIMITS.max
  );
  const selectedLightDistance = selectedPartControlKey
    ? getSelectedLightDistance(selectedPartControlKey, selectedState as AvatarPartState)
    : DEFAULT_PORTRAIT_EYE_LIGHT_DISTANCE;
  const selectedPoseKey = selectedAccessory
    ? selectedAccessoryPoseKey
    : isHairLightPart
      ? selectedHairLightPoseKey
      : isEyeLightPart
        ? selectedEyeLightPoseKey
        : isEyelidPart
          ? selectedEyelidPoseKey
          : selectedUpperEyelidPoseKey;
  const selectedOptionId = selectedAppearanceState.optionId;
  const isSelectedOptionColorEditable = selectedTarget.type === 'accessory' || (
    selectedPart ? isAvatarPartOptionColorEditable(selectedPart.key, selectedOptionId) : true
  );
  const canUseColorGradient = selectedTarget.type === 'accessory' || selectedPart?.key !== 'eyes.sclera';
  const isSelectedHairColorSource = selectedTarget.type === 'accessory'
    ? selectedAccessory !== null && HAIR_ACCESSORY_CATEGORIES.includes(selectedAccessory.category)
    : selectedPart !== null && HAIR_COLOR_PART_KEYS.includes(selectedPart.key);
  const hairApplyTargets = useMemo<HairApplyTarget[]>(() => {
    const partTargets = HAIR_COLOR_PART_KEYS
      .flatMap<HairApplyTarget>(key => {
        const definition = AVATAR_EDITOR_PART_DEFINITIONS.find(part => part.key === key);

        return definition
          ? [{ id: `part:${key}`, type: 'part' as const, key, label: definition.label }]
          : [];
      });
    const accessoryTargets = avatarState.accessories
      .filter(accessory => HAIR_ACCESSORY_CATEGORIES.includes(accessory.category))
      .map(accessory => ({
        id: `accessory:${accessory.instanceId}`,
        type: 'accessory' as const,
        instanceId: accessory.instanceId,
        label: getAccessoryDisplayName(accessory),
      }));

    return [...partTargets, ...accessoryTargets];
  }, [avatarState.accessories]);
  const sharedHairColorTargets = useMemo(
    () => hairApplyTargets.filter(target => getHairApplyTargetColorState(target, avatarState)?.colorGradientSpace === 'sharedHair'),
    [avatarState, hairApplyTargets]
  );
  const accessoriesBySlot = useMemo(
    () => ACCESSORY_LAYER_SLOT_DEFINITIONS.map(slotDefinition => ({
      slot: slotDefinition,
      accessories: avatarState.accessories
        .filter(accessory => accessory.layerSlot === slotDefinition.id)
        .sort((first, second) => first.order - second.order),
    })),
    [avatarState.accessories]
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      setCanUseNativeDrag(true);
      return;
    }

    const pointerMedia = window.matchMedia('(hover: hover) and (pointer: fine)');
    const updateCanUseNativeDrag = () => setCanUseNativeDrag(pointerMedia.matches);
    updateCanUseNativeDrag();
    pointerMedia.addEventListener('change', updateCanUseNativeDrag);

    return () => {
      pointerMedia.removeEventListener('change', updateCanUseNativeDrag);
    };
  }, []);

  useEffect(() => {
    if (
      selectedTarget.type === 'accessory' &&
      !avatarState.accessories.some(accessory => accessory.instanceId === selectedTarget.instanceId)
    ) {
      setSelectedTarget({ type: 'part', key: 'face' });
      setSelectedAccessoryPoseKey('portrait');
    }
  }, [avatarState.accessories, selectedTarget]);

  const {
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
  } = useAvatarAppearanceActions({
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
  });
  const {
    changeLightDistance,
    flipPart,
    movePart,
    rotatePart,
    scalePart,
    setSideVisible,
    startHoldMove,
    stopHoldMove,
  } = useAvatarTransformActions({
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
  });
  const {
    addAccessory,
    applyChibiBackMirror,
    changeAccessoryLayerSlot,
    dropAccessoryOn,
    estimateChibiPoseFromPortrait,
    removeSelectedAccessory,
    setChibiBackFollowingFront,
  } = useAvatarAccessoryActions({
    avatarCanvasRef,
    draggingAccessoryId,
    selectedAccessory,
    selectedAccessoryPoseKey,
    onDraggingAccessoryChange: setDraggingAccessoryId,
    onSelectAccessoryPose: setSelectedAccessoryPoseKey,
    onSelectTarget: setSelectedTarget,
  });

  return (
    <section className={styles.container} aria-label="紙娃娃臉部編輯器">
      <AvatarEditorSidebar
        accessoriesBySlot={accessoriesBySlot}
        avatarTemplates={avatarTemplates}
        canUseNativeDrag={canUseNativeDrag}
        draftSaveStatus={draftSaveStatus}
        selectedTarget={selectedTarget}
        templateName={templateName}
        onAddAccessory={addAccessory}
        onAccessoryDragEnd={() => setDraggingAccessoryId(null)}
        onAccessoryDragStart={instanceId => setDraggingAccessoryId(instanceId)}
        onAccessoryDrop={dropAccessoryOn}
        onRequestTemplateAction={action => setPendingTemplateAction(action)}
        onSaveCurrentTemplate={() => saveCurrentTemplate()}
        onSelectAccessory={instanceId => {
          setSelectedTarget({ type: 'accessory', instanceId });
          setSelectedAccessoryPoseKey('portrait');
        }}
        onSelectPart={key => setSelectedTarget({ type: 'part', key })}
        onTemplateNameChange={nextTemplateName => setTemplateName(nextTemplateName)}
      />

      <AvatarEditorStage
        canvasHostRef={canvasHostRef}
        miniAnimationCanvasHostRef={miniAnimationCanvasHostRef}
        miniBackCanvasHostRef={miniBackCanvasHostRef}
        miniCanvasHostRef={miniCanvasHostRef}
        miniSideCanvasHostRef={miniSideCanvasHostRef}
        selectedMiniAnimationId={selectedMiniAnimationId}
        spriteSheet={spriteSheet}
        spriteSheetAnimationStyle={spriteSheetAnimationStyle}
        spriteSheetFrameIndex={spriteSheetFrameIndex}
        onSelectMiniAnimation={animationId => setSelectedMiniAnimationId(animationId)}
      />

      <AvatarEditorOptionPanel
        canMoveX={canMoveX}
        canUseColorGradient={canUseColorGradient}
        hairApplyPanel={hairApplyPanel}
        hairApplyTargets={hairApplyTargets}
        isAccessoryBackPoseFollowingFront={isAccessoryBackPoseFollowingFront}
        isEyeLightPart={isEyeLightPart}
        isEyelidPart={isEyelidPart}
        isHairLightPart={isHairLightPart}
        isMiniClothingBottomPart={isMiniClothingBottomPart}
        isMoveDownDisabled={isMoveDownDisabled}
        isMoveUpDisabled={isMoveUpDisabled}
        isSelectedHairColorSource={isSelectedHairColorSource}
        isSelectedOptionColorEditable={isSelectedOptionColorEditable}
        isUpperEyelidPart={isUpperEyelidPart}
        selectedAccessory={selectedAccessory}
        selectedAccessoryColorVariantId={selectedAccessoryColorVariantId}
        selectedAccessoryColorVariants={selectedAccessoryColorVariants}
        selectedAccessoryDefinition={selectedAccessoryDefinition}
        selectedAccessoryPose={selectedAccessoryPose}
        selectedAccessoryPoseKey={selectedAccessoryPoseKey}
        selectedAppearanceState={selectedAppearanceState}
        selectedEditableProperties={selectedEditableProperties}
        selectedHairLightPoseKey={selectedHairLightPoseKey}
        selectedLabel={selectedLabel}
        selectedLightDistance={selectedLightDistance}
        selectedLineColorState={selectedLineColorState}
        selectedOptionId={selectedOptionId}
        selectedOptions={selectedOptions}
        selectedPart={selectedPart}
        selectedPartState={selectedPartState}
        selectedPoseKey={selectedPoseKey}
        selectedState={selectedState}
        onAccessoryColorVariantChange={changeAccessoryColorVariant}
        onAccessoryLayerSlotChange={changeAccessoryLayerSlot}
        onApplyChibiBackMirror={applyChibiBackMirror}
        onApplyHairSettingsToTargets={applyHairSettingsToTargets}
        onChibiBackFollowingFrontChange={setChibiBackFollowingFront}
        onClothingLayerOrderChange={setClothingLayerOrder}
        onColorChange={changeColor}
        onColorGradientModeChange={changeColorGradientMode}
        onColorGradientUpdate={updateColorGradient}
        onEstimateChibiPoseFromPortrait={estimateChibiPoseFromPortrait}
        onEyeLightPoseChange={poseKey => setSelectedEyeLightPoseKey(poseKey)}
        onEyelidPoseChange={poseKey => setSelectedEyelidPoseKey(poseKey)}
        onFlipPart={flipPart}
        onHairLightPoseChange={poseKey => setSelectedHairLightPoseKey(poseKey)}
        onLightDistanceChange={changeLightDistance}
        onLineColorChange={changeLineColor}
        onLineColorGradientModeChange={changeLineColorGradientMode}
        onLineColorGradientUpdate={updateLineColorGradient}
        onMovePart={movePart}
        onOpenHairApplyPanel={openHairApplyPanel}
        onPartVisibleChange={setPartVisible}
        onRemoveSelectedAccessory={removeSelectedAccessory}
        onRotatePart={rotatePart}
        onScalePart={scalePart}
        onSecondaryColorChange={changeSecondaryColor}
        onSecondaryColorGradientModeChange={changeSecondaryColorGradientMode}
        onSecondaryColorGradientUpdate={updateSecondaryColorGradient}
        onSelectAccessoryPose={poseKey => setSelectedAccessoryPoseKey(poseKey)}
        onSelectOption={selectOption}
        onSetAllHairApplyTargets={setAllHairApplyTargets}
        onSideVisibleChange={setSideVisible}
        onStartHoldMove={startHoldMove}
        onStopHoldMove={stopHoldMove}
        onToggleHairApplyTarget={toggleHairApplyTarget}
        onToggleSelectedSharedHairGradientSpace={toggleSelectedSharedHairGradientSpace}
        onUpperEyelidPoseChange={poseKey => setSelectedUpperEyelidPoseKey(poseKey)}
      />

      {pendingTemplateAction && (
        <AvatarEditorTemplateActionModal
          action={pendingTemplateAction}
          onConfirm={confirmTemplateAction}
          onCancel={() => setPendingTemplateAction(null)}
        />
      )}
    </section>
  );
}
