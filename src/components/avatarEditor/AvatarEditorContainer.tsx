import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Modal } from '~/components/common/Modal';
import {
  ACCESSORY_CATEGORY_DEFINITIONS,
  ACCESSORY_LAYER_SLOT_DEFINITIONS,
  AccessoryCategory,
  AccessoryLayerSlot,
  AccessoryPoseKey,
  AVATAR_EDITOR_PART_DEFINITIONS,
  AvatarCanvas,
  AvatarAccessoryInstance,
  AvatarEditableProperty,
  AvatarPartDefinition,
  AvatarPartKey,
  AvatarPartState,
  AvatarState,
  createDefaultAvatarState,
  getAccessoryCategoryDefinition,
  getAccessoryDisplayName,
  getAccessoryLayerSlotDefinition,
  getAccessoryPoseState,
  isAvatarPartOptionColorEditable,
  MINI_UPPER_EYELID_OFFSET_Y_LIMITS,
} from '~/widgets/avatarCanvas';
import { MiniAvatarCanvas, MINI_DEFAULT_EYE_LIGHT_DISTANCE } from '~/widgets/miniAvatarCanvas';
import type { MiniSpriteSheet } from '~/widgets/miniAvatarCanvas';
import {
  getMiniAnimationFrameDurationMs,
} from '~/widgets/miniAvatar/miniAvatarAnimation';
import {
  MINI_AVATAR_ANIMATION_DEFINITIONS,
  MINI_WAVE_BLINK_ANIMATION,
} from '~/widgets/miniAvatar/miniAvatarAnimationDefinitions';
import {
  listAvatarAppearanceTemplates,
  deleteAvatarAppearanceTemplate,
  loadAvatarAppearanceDraft,
  saveAvatarAppearanceDraft,
  saveAvatarAppearanceTemplate,
} from '~/services/save/avatarAppearanceSaveService';
import type { AvatarAppearanceTemplateRecord } from '~/services/save/avatarAppearanceSaveService';
import styles from './avatarEditor.module.scss';

const MOVE_STEP = 1;
const AVATAR_DRAFT_AUTOSAVE_DELAY_MS = 900;
const HOLD_MOVE_DELAY_MS = 300;
const HOLD_MOVE_INTERVAL_MS = 90;
const HOLD_ACCELERATION_TICKS = 8;
const MAX_HOLD_MOVE_MULTIPLIER = 16;
const ROTATE_STEP = 5;
const SCALE_STEP = 0.05;
const LIGHT_DISTANCE_STEP = 2;
const UPPER_EYELID_CHIBI_EDITABLE_PROPERTIES: AvatarEditableProperty[] = ['lineColor', 'offsetY', 'rotate'];
const EYE_LIGHT_CHIBI_EDITABLE_PROPERTIES: AvatarEditableProperty[] = ['offsetX', 'offsetY'];
const EYELID_CHIBI_EDITABLE_PROPERTIES: AvatarEditableProperty[] = ['lineColor'];
const DEFAULT_PORTRAIT_EYE_LIGHT_DISTANCE = 45;

interface HoldMoveState {
  timeoutId: ReturnType<typeof setTimeout> | null;
  intervalId: ReturnType<typeof setInterval> | null;
  tickCount: number;
}

interface AvatarEditorContainerProps {
  initialState?: Partial<AvatarState>;
  onAvatarChange?: (state: AvatarState) => void;
}

type SelectedTarget =
  | { type: 'part'; key: AvatarPartKey }
  | { type: 'accessory'; instanceId: string };

type DraftSaveStatus = 'idle' | 'pending' | 'saved' | 'error';
type TemplateAction =
  | { type: 'load'; template: AvatarAppearanceTemplateRecord }
  | { type: 'overwrite'; template: AvatarAppearanceTemplateRecord }
  | { type: 'delete'; template: AvatarAppearanceTemplateRecord }
  | { type: 'reset' };

export function AvatarEditorContainer({ initialState, onAvatarChange }: AvatarEditorContainerProps) {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const miniCanvasHostRef = useRef<HTMLDivElement | null>(null);
  const miniSideCanvasHostRef = useRef<HTMLDivElement | null>(null);
  const miniAnimationCanvasHostRef = useRef<HTMLDivElement | null>(null);
  const avatarCanvasRef = useRef<AvatarCanvas | null>(null);
  const miniAvatarCanvasRef = useRef<MiniAvatarCanvas | null>(null);
  const miniSideAvatarCanvasRef = useRef<MiniAvatarCanvas | null>(null);
  const miniAnimationCanvasRef = useRef<MiniAvatarCanvas | null>(null);
  const spriteSheetBakeVersionRef = useRef(0);
  const draftAutosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestAvatarStateRef = useRef<AvatarState | null>(null);
  const holdMoveRef = useRef<HoldMoveState>({
    timeoutId: null,
    intervalId: null,
    tickCount: 0,
  });
  const onAvatarChangeRef = useRef(onAvatarChange);
  const [initialEditorState] = useState<Partial<AvatarState> | undefined>(() => (
    initialState ?? loadAvatarAppearanceDraft()?.avatarState ?? undefined
  ));
  const initialStateRef = useRef(initialEditorState);
  // 預設選項
  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget>({ type: 'part', key: 'mini.bodyType' });
  const [selectedAccessoryPoseKey, setSelectedAccessoryPoseKey] = useState<AccessoryPoseKey>('portrait');
  const [selectedUpperEyelidPoseKey, setSelectedUpperEyelidPoseKey] = useState<AccessoryPoseKey>('portrait');
  const [selectedEyeLightPoseKey, setSelectedEyeLightPoseKey] = useState<AccessoryPoseKey>('portrait');
  const [selectedEyelidPoseKey, setSelectedEyelidPoseKey] = useState<AccessoryPoseKey>('portrait');
  const [draggingAccessoryId, setDraggingAccessoryId] = useState<string | null>(null);
  const [avatarState, setAvatarState] = useState<AvatarState>(() => createDefaultAvatarState());
  const [avatarTemplates, setAvatarTemplates] = useState<AvatarAppearanceTemplateRecord[]>(() => (
    listAvatarAppearanceTemplates()
  ));
  const [templateName, setTemplateName] = useState('');
  const [pendingTemplateAction, setPendingTemplateAction] = useState<TemplateAction | null>(null);
  const [draftSaveStatus, setDraftSaveStatus] = useState<DraftSaveStatus>('idle');
  const [spriteSheet, setSpriteSheet] = useState<MiniSpriteSheet | null>(null);
  const [spriteSheetFrameIndex, setSpriteSheetFrameIndex] = useState(0);
  const [selectedMiniAnimationId, setSelectedMiniAnimationId] = useState(MINI_WAVE_BLINK_ANIMATION.id);

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
  const selectedOptions = selectedAccessoryDefinition?.options ?? selectedPart?.options ?? [];
  const baseEditableProperties = selectedAccessoryDefinition?.editableProperties ?? selectedPart?.editableProperties ?? [];
  const isUpperEyelidPart = selectedTarget.type === 'part' && selectedPart?.key === 'eyes.upperEyelid';
  const isEyeLightPart = selectedTarget.type === 'part' && selectedPart?.key === 'eyes.light';
  const isEyelidPart = selectedTarget.type === 'part' && selectedPart?.key === 'eyes.eyelid';
  const isMiniClothingBottomPart = selectedTarget.type === 'part' && selectedPart?.key === 'mini.clothingBottom';
  const isUpperEyelidChibiMode = isUpperEyelidPart && selectedUpperEyelidPoseKey === 'chibi';
  const isEyeLightChibiMode = isEyeLightPart && selectedEyeLightPoseKey === 'chibi';
  const isEyelidChibiMode = isEyelidPart && selectedEyelidPoseKey === 'chibi';
  const selectedEditableProperties = isUpperEyelidChibiMode
    ? UPPER_EYELID_CHIBI_EDITABLE_PROPERTIES
    : isEyeLightChibiMode
      ? EYE_LIGHT_CHIBI_EDITABLE_PROPERTIES
      : isEyelidChibiMode
        ? EYELID_CHIBI_EDITABLE_PROPERTIES
        : baseEditableProperties;
  const canMoveX = selectedEditableProperties.includes('offsetX');
  const canMoveY = selectedEditableProperties.includes('offsetY');
  const selectedLabel = selectedAccessory ? getAccessoryDisplayName(selectedAccessory) : selectedPart?.label ?? '';
  const selectedAccessoryPose = selectedAccessory
    ? getAccessoryPoseState(selectedAccessory, selectedAccessoryPoseKey)
    : null;
  const selectedPartState = selectedPart ? avatarState[selectedPart.key] : avatarState.face;
  const selectedPartControlKey = isUpperEyelidChibiMode
    ? 'mini.upperEyelid'
    : isEyeLightChibiMode
      ? 'mini.eyeLight'
      : isEyelidChibiMode
        ? 'mini.eyelid'
        : selectedPart?.key;
  const selectedPartControlState = isUpperEyelidChibiMode
    ? avatarState['mini.upperEyelid']
    : isEyeLightChibiMode
      ? avatarState['mini.eyeLight']
      : isEyelidChibiMode
        ? avatarState['mini.eyelid']
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
    : isEyeLightPart
      ? selectedEyeLightPoseKey
      : isEyelidPart
        ? selectedEyelidPoseKey
        : selectedUpperEyelidPoseKey;
  const selectedOptionId = selectedAppearanceState.optionId;
  const isSelectedOptionColorEditable = selectedTarget.type === 'accessory' || (
    selectedPart ? isAvatarPartOptionColorEditable(selectedPart.key, selectedOptionId) : true
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
  const selectedMiniAnimation = useMemo(
    () => MINI_AVATAR_ANIMATION_DEFINITIONS.find(animation => animation.id === selectedMiniAnimationId)
      ?? MINI_WAVE_BLINK_ANIMATION,
    [selectedMiniAnimationId]
  );
  const spriteSheetAnimationStyle = useMemo(() => {
    if (!spriteSheet) {
      return undefined;
    }

    const frameIndex = spriteSheetFrameIndex % spriteSheet.frameCount;
    const column = frameIndex % spriteSheet.columns;
    const row = Math.floor(frameIndex / spriteSheet.columns);

    return {
      width: spriteSheet.frameWidth,
      height: spriteSheet.frameHeight,
      backgroundImage: `url(${spriteSheet.dataUrl})`,
      backgroundPosition: `-${column * spriteSheet.frameWidth}px -${row * spriteSheet.frameHeight}px`,
      backgroundSize: `${spriteSheet.sheetWidth}px ${spriteSheet.sheetHeight}px`,
    };
  }, [spriteSheet, spriteSheetFrameIndex]);

  useEffect(() => {
    onAvatarChangeRef.current = onAvatarChange;
  }, [onAvatarChange]);

  const refreshSpriteSheetPreview = useCallback(() => {
    const miniAvatarCanvas = miniAvatarCanvasRef.current;

    if (!miniAvatarCanvas) {
      return;
    }

    const bakeVersion = spriteSheetBakeVersionRef.current + 1;
    spriteSheetBakeVersionRef.current = bakeVersion;

    void miniAvatarCanvas.exportAnimationSpriteSheet()
      .then(nextSpriteSheet => {
        if (bakeVersion !== spriteSheetBakeVersionRef.current) {
          return;
        }

        setSpriteSheet(nextSpriteSheet);
      })
      .catch(error => {
        console.error('Failed to bake mini sprite sheet:', error);

        if (bakeVersion === spriteSheetBakeVersionRef.current) {
          setSpriteSheet(null);
        }
      });
  }, []);

  const scheduleDraftAutosave = useCallback((state: AvatarState) => {
    latestAvatarStateRef.current = state;

    if (draftAutosaveTimeoutRef.current) {
      clearTimeout(draftAutosaveTimeoutRef.current);
    }

    setDraftSaveStatus('pending');
    draftAutosaveTimeoutRef.current = setTimeout(() => {
      draftAutosaveTimeoutRef.current = null;

      try {
        saveAvatarAppearanceDraft(state);
        setDraftSaveStatus('saved');
      } catch {
        setDraftSaveStatus('error');
      }
    }, AVATAR_DRAFT_AUTOSAVE_DELAY_MS);
  }, []);

  const handleAvatarCanvasChange = useCallback((state: AvatarState) => {
    setAvatarState(state);
    miniAvatarCanvasRef.current?.setState(state);
    miniSideAvatarCanvasRef.current?.setState(state);
    miniAnimationCanvasRef.current?.setState(state);
    onAvatarChangeRef.current?.(state);
    scheduleDraftAutosave(state);
  }, [scheduleDraftAutosave]);

  useEffect(() => {
    if (
      selectedTarget.type === 'accessory' &&
      !avatarState.accessories.some(accessory => accessory.instanceId === selectedTarget.instanceId)
    ) {
      setSelectedTarget({ type: 'part', key: 'face' });
      setSelectedAccessoryPoseKey('portrait');
    }
  }, [avatarState.accessories, selectedTarget]);

  useEffect(() => {
    if (!canvasHostRef.current || !miniCanvasHostRef.current || !miniSideCanvasHostRef.current || !miniAnimationCanvasHostRef.current) {
      return;
    }

    const canvasHost = canvasHostRef.current;
    const miniCanvasHost = miniCanvasHostRef.current;
    const miniSideCanvasHost = miniSideCanvasHostRef.current;
    const miniAnimationCanvasHost = miniAnimationCanvasHostRef.current;
    const avatarCanvas = AvatarCanvas.mount(canvasHost, {
      initialState: initialStateRef.current,
      onChange: handleAvatarCanvasChange,
    });
    const miniAvatarCanvas = MiniAvatarCanvas.mount(miniCanvasHost, {
      initialState: avatarCanvas.getState(),
    });
    const miniSideAvatarCanvas = MiniAvatarCanvas.mount(miniSideCanvasHost, {
      initialState: avatarCanvas.getState(),
      direction: 'side',
    });
    const miniAnimationCanvas = MiniAvatarCanvas.mount(miniAnimationCanvasHost, {
      initialState: avatarCanvas.getState(),
      isAnimationEnabled: true,
    });
    avatarCanvasRef.current = avatarCanvas;
    miniAvatarCanvasRef.current = miniAvatarCanvas;
    miniSideAvatarCanvasRef.current = miniSideAvatarCanvas;
    miniAnimationCanvasRef.current = miniAnimationCanvas;
    refreshSpriteSheetPreview();

    return () => {
      spriteSheetBakeVersionRef.current += 1;
      avatarCanvasRef.current = null;
      miniAvatarCanvasRef.current = null;
      miniSideAvatarCanvasRef.current = null;
      miniAnimationCanvasRef.current = null;
      void avatarCanvas.destroy();
      void miniAvatarCanvas.destroy();
      void miniSideAvatarCanvas.destroy();
      void miniAnimationCanvas.destroy();
      canvasHost.replaceChildren();
      miniCanvasHost.replaceChildren();
      miniSideCanvasHost.replaceChildren();
      miniAnimationCanvasHost.replaceChildren();
    };
  }, [handleAvatarCanvasChange, refreshSpriteSheetPreview]);

  useEffect(() => {
    return () => {
      if (!draftAutosaveTimeoutRef.current || !latestAvatarStateRef.current) {
        return;
      }

      clearTimeout(draftAutosaveTimeoutRef.current);
      draftAutosaveTimeoutRef.current = null;

      try {
        saveAvatarAppearanceDraft(latestAvatarStateRef.current);
      } catch (error) {
        console.error('Failed to flush avatar draft on unmount:', error);
      }
    };
  }, []);

  useEffect(() => {
    refreshSpriteSheetPreview();
  }, [avatarState, refreshSpriteSheetPreview]);

  useEffect(() => {
    miniAvatarCanvasRef.current?.setAnimation(selectedMiniAnimation);
    miniAnimationCanvasRef.current?.setAnimation(selectedMiniAnimation);
    refreshSpriteSheetPreview();
  }, [refreshSpriteSheetPreview, selectedMiniAnimation]);

  useEffect(() => {
    setSpriteSheetFrameIndex(0);

    if (!spriteSheet || spriteSheet.frameCount <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setSpriteSheetFrameIndex(currentFrameIndex => (
        (currentFrameIndex + 1) % spriteSheet.frameCount
      ));
    }, getMiniAnimationFrameDurationMs(selectedMiniAnimation));

    return () => {
      window.clearInterval(intervalId);
    };
  }, [selectedMiniAnimation, spriteSheet]);

  useEffect(() => {
    return () => {
      stopHoldMove();
    };
  }, []);

  const selectOption = (optionId: number) => {
    if (selectedTarget.type === 'accessory') {
      avatarCanvasRef.current?.setAccessoryOption(selectedTarget.instanceId, optionId);
      return;
    }

    if (selectedPart) {
      avatarCanvasRef.current?.setOption(selectedPart.key, optionId);
    }
  };

  const changeColor = (color: string) => {
    if (selectedTarget.type === 'accessory') {
      avatarCanvasRef.current?.setAccessoryColor(selectedTarget.instanceId, color);
      return;
    }

    if (selectedPart) {
      avatarCanvasRef.current?.setColor(selectedPart.key, color);
    }
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

  const changeSecondaryColor = (secondaryColor: string) => {
    if (selectedTarget.type === 'part' && selectedPart) {
      avatarCanvasRef.current?.setSecondaryColor(selectedPart.key, secondaryColor);
    }
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

  const movePart = (deltaX: number, deltaY: number) => {
    if (selectedTarget.type === 'accessory') {
      avatarCanvasRef.current?.moveAccessory(selectedTarget.instanceId, deltaX, deltaY, selectedAccessoryPoseKey);
      return;
    }

    if (selectedPartControlKey) {
      avatarCanvasRef.current?.move(selectedPartControlKey, deltaX, deltaY);
    }
  };

  const startHoldMove = (deltaX: number, deltaY: number) => {
    stopHoldMove();
    movePart(deltaX, deltaY);

    holdMoveRef.current.timeoutId = setTimeout(() => {
      holdMoveRef.current.intervalId = setInterval(() => {
        holdMoveRef.current.tickCount += 1;
        const multiplier = getHoldMoveMultiplier(holdMoveRef.current.tickCount);
        movePart(deltaX * multiplier, deltaY * multiplier);
      }, HOLD_MOVE_INTERVAL_MS);
    }, HOLD_MOVE_DELAY_MS);
  };

  const stopHoldMove = () => {
    if (holdMoveRef.current.timeoutId) {
      clearTimeout(holdMoveRef.current.timeoutId);
    }

    if (holdMoveRef.current.intervalId) {
      clearInterval(holdMoveRef.current.intervalId);
    }

    holdMoveRef.current = {
      timeoutId: null,
      intervalId: null,
      tickCount: 0,
    };
  };

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
      avatarCanvasRef.current?.rotateAccessory(selectedTarget.instanceId, delta, selectedAccessoryPoseKey);
      return;
    }

    if (selectedPartControlKey) {
      avatarCanvasRef.current?.rotate(selectedPartControlKey, delta);
    }
  };

  const scalePart = (delta: number) => {
    if (selectedTarget.type === 'accessory') {
      avatarCanvasRef.current?.scaleAccessory(selectedTarget.instanceId, delta, selectedAccessoryPoseKey);
      return;
    }

    if (selectedPartControlKey) {
      avatarCanvasRef.current?.scale(selectedPartControlKey, delta);
    }
  };

  const flipPart = () => {
    if (selectedTarget.type === 'accessory') {
      avatarCanvasRef.current?.flipAccessory(selectedTarget.instanceId, selectedAccessoryPoseKey);
      return;
    }

    if (selectedPartControlKey) {
      avatarCanvasRef.current?.flip(selectedPartControlKey);
    }
  };

  const setSideVisible = (side: 'left' | 'right', isVisible: boolean) => {
    if (selectedTarget.type === 'accessory') {
      avatarCanvasRef.current?.setAccessorySideVisible(
        selectedTarget.instanceId,
        side,
        isVisible
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

  const addAccessory = (category: AccessoryCategory) => {
    const instanceId = avatarCanvasRef.current?.addAccessory(category);

    if (instanceId) {
      setSelectedTarget({ type: 'accessory', instanceId });
      setSelectedAccessoryPoseKey('portrait');
    }
  };

  const removeSelectedAccessory = () => {
    if (!selectedAccessory) {
      return;
    }

    avatarCanvasRef.current?.removeAccessory(selectedAccessory.instanceId);
    setSelectedTarget({ type: 'part', key: 'face' });
    setSelectedAccessoryPoseKey('portrait');
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
    if (!selectedAccessory) {
      return;
    }

    avatarCanvasRef.current?.estimateAccessoryChibiPoseFromPortrait(selectedAccessory.instanceId);
  };

  const dropAccessoryOn = (targetAccessory: AvatarAccessoryInstance) => {
    if (!draggingAccessoryId || draggingAccessoryId === targetAccessory.instanceId) {
      return;
    }

    avatarCanvasRef.current?.reorderAccessoryWithinSlot(draggingAccessoryId, targetAccessory.instanceId);
    setDraggingAccessoryId(null);
  };

  const saveCurrentTemplate = (templateId?: string, fallbackName?: string) => {
    const currentState = avatarCanvasRef.current?.getState() ?? avatarState;

    try {
      const templateRecord = saveAvatarAppearanceTemplate(fallbackName ?? templateName, currentState, templateId);

      setTemplateName(templateRecord.name);
      setAvatarTemplates(listAvatarAppearanceTemplates());
    } catch (error) {
      console.error('Failed to save avatar template:', error);
      setDraftSaveStatus('error');
    }
  };

  const loadTemplate = (template: AvatarAppearanceTemplateRecord) => {
    avatarCanvasRef.current?.setState(template.avatarState);
    setTemplateName(template.name);
    setSelectedTarget({ type: 'part', key: 'face' });
    setSelectedAccessoryPoseKey('portrait');
  };

  const overwriteTemplate = (template: AvatarAppearanceTemplateRecord) => {
    saveCurrentTemplate(template.id, template.name);
  };

  const deleteTemplate = (templateId: string) => {
    deleteAvatarAppearanceTemplate(templateId);
    setAvatarTemplates(listAvatarAppearanceTemplates());
  };

  const resetAvatarToDefault = () => {
    const defaultState = createDefaultAvatarState();

    avatarCanvasRef.current?.setState(defaultState);
    setTemplateName('');
    setSelectedTarget({ type: 'part', key: 'mini.bodyType' });
    setSelectedAccessoryPoseKey('portrait');
    setSelectedUpperEyelidPoseKey('portrait');
    setSelectedEyeLightPoseKey('portrait');
    setSelectedEyelidPoseKey('portrait');
  };

  const confirmTemplateAction = () => {
    if (!pendingTemplateAction) {
      return;
    }

    if (pendingTemplateAction.type === 'load') {
      loadTemplate(pendingTemplateAction.template);
    }

    if (pendingTemplateAction.type === 'overwrite') {
      overwriteTemplate(pendingTemplateAction.template);
    }

    if (pendingTemplateAction.type === 'delete') {
      deleteTemplate(pendingTemplateAction.template.id);
    }

    if (pendingTemplateAction.type === 'reset') {
      resetAvatarToDefault();
    }

    setPendingTemplateAction(null);
  };

  return (
    <section className={styles.container} aria-label="紙娃娃臉部編輯器">
      <aside className={styles.partMenu} aria-label="選擇部位">
        <div className={styles.panelTitle}>部位</div>
        <div className={styles.partList} role="radiogroup" aria-label="Avatar parts">
          {AVATAR_EDITOR_PART_DEFINITIONS.map(part => (
            <PartButton
              key={part.key}
              part={part}
              isSelected={selectedTarget.type === 'part' && part.key === selectedPart?.key}
              onSelect={() => setSelectedTarget({ type: 'part', key: part.key })}
            />
          ))}
        </div>

        <div className={styles.accessoryToolbar} aria-label="新增配件">
          {ACCESSORY_CATEGORY_DEFINITIONS.map(category => (
            <button
              type="button"
              key={category.category}
              onClick={() => addAccessory(category.category)}
              disabled={category.options.length === 0}
              title={category.options.length === 0 ? '尚未放入素材' : `新增${category.label}`}
            >
              新增{category.label}
            </button>
          ))}
        </div>

        <div className={styles.accessoryList} aria-label="配件清單">
          {accessoriesBySlot.map(({ slot, accessories }) => (
            <div className={styles.accessorySlot} key={slot.id}>
              <div className={styles.accessorySlotTitle}>{slot.label}</div>
              {accessories.length === 0 ? (
                <div className={styles.emptySlot}>空</div>
              ) : accessories.map(accessory => (
                <AccessoryButton
                  key={accessory.instanceId}
                  accessory={accessory}
                  isSelected={selectedTarget.type === 'accessory' && selectedTarget.instanceId === accessory.instanceId}
                  onDragEnd={() => setDraggingAccessoryId(null)}
                  onDragStart={() => setDraggingAccessoryId(accessory.instanceId)}
                  onDrop={() => dropAccessoryOn(accessory)}
                  onSelect={() => {
                    setSelectedTarget({ type: 'accessory', instanceId: accessory.instanceId });
                    setSelectedAccessoryPoseKey('portrait');
                  }}
                />
              ))}
            </div>
          ))}
        </div>

        <div className={styles.templatePanel} aria-label="外觀模板">
          <div className={styles.panelTitle}>模板</div>
          <input
            className={styles.templateNameInput}
            type="text"
            value={templateName}
            onChange={event => setTemplateName(event.target.value)}
            placeholder="模板名稱"
          />
          <button
            className={styles.templateSaveButton}
            type="button"
            onClick={() => saveCurrentTemplate()}
          >
            另存新模板
          </button>
          <button
            className={styles.resetAvatarButton}
            type="button"
            onClick={() => setPendingTemplateAction({ type: 'reset' })}
          >
            重置為預設值
          </button>
          <div className={styles.saveStatusLine}>{getDraftSaveStatusLabel(draftSaveStatus)}</div>
          <div className={styles.templateList}>
            {avatarTemplates.length === 0 ? (
              <div className={styles.emptySlot}>尚無模板</div>
            ) : avatarTemplates.map(template => (
              <div className={styles.templateItem} key={template.id}>
                <button
                  className={styles.templateLoadButton}
                  type="button"
                  onClick={() => setPendingTemplateAction({ type: 'load', template })}
                >
                  {template.name}
                </button>
                <button
                  className={styles.templateOverwriteButton}
                  type="button"
                  onClick={() => setPendingTemplateAction({ type: 'overwrite', template })}
                  aria-label={`覆蓋${template.name}`}
                >
                  覆蓋
                </button>
                <button
                  className={styles.templateDeleteButton}
                  type="button"
                  onClick={() => setPendingTemplateAction({ type: 'delete', template })}
                  aria-label={`刪除${template.name}`}
                >
                  刪除
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <div className={styles.stageShell}>
        <div className={styles.canvasShell}>
          <div className={styles.canvasHost} ref={canvasHostRef} />
        </div>
        <div className={styles.previewColumn}>
          <div className={styles.animationSelector} role="tablist" aria-label="Mini animation">
            {MINI_AVATAR_ANIMATION_DEFINITIONS.map(animation => (
              <button
                type="button"
                key={animation.id}
                className={animation.id === selectedMiniAnimation.id ? styles.activeAnimationButton : styles.animationButton}
                onClick={() => setSelectedMiniAnimationId(animation.id)}
                role="tab"
                aria-selected={animation.id === selectedMiniAnimation.id}
              >
                {animation.label}
              </button>
            ))}
          </div>
          <div className={styles.miniPreviewPair}>
            <div className={styles.miniPreviewShell} aria-label="Mini avatar preview">
              <div className={styles.miniCanvasHost} ref={miniCanvasHostRef} />
            </div>
            <div className={styles.miniPreviewShell} aria-label="Mini side avatar preview">
              <div className={styles.miniCanvasHost} ref={miniSideCanvasHostRef} />
            </div>
          </div>
          <div className={styles.miniPreviewShell} aria-label="Mini live animation preview">
            <div className={styles.miniCanvasHost} ref={miniAnimationCanvasHostRef} />
          </div>
          <div className={styles.spriteSheetShell} aria-label="Mini sprite sheet output">
            <div className={styles.spriteSheetViewport}>
              {spriteSheet && (
                <img
                  alt="Mini animation sprite sheet"
                  src={spriteSheet.dataUrl}
                  width={spriteSheet.sheetWidth}
                  height={spriteSheet.sheetHeight}
                />
              )}
            </div>
            <div className={styles.spriteSheetMeta}>
              {spriteSheet
                ? `${spriteSheet.sheetWidth}x${spriteSheet.sheetHeight} / ${spriteSheet.frameWidth}x${spriteSheet.frameHeight} / ${spriteSheet.frameCount} frames`
                : 'baking'}
            </div>
          </div>
          <div className={styles.spriteSheetAnimationShell} aria-label="Mini sprite sheet animation preview">
            <div className={styles.spriteSheetAnimationViewport}>
              {spriteSheetAnimationStyle && (
                <div
                  className={styles.spriteSheetAnimationFrame}
                  style={spriteSheetAnimationStyle}
                />
              )}
            </div>
            <div className={styles.spriteSheetMeta}>
              {spriteSheet
                ? `${spriteSheetFrameIndex % spriteSheet.frameCount + 1} / ${spriteSheet.frameCount}`
                : 'baking'}
            </div>
          </div>
        </div>
      </div>

      <aside className={styles.optionMenu} aria-label="選擇選項與調整">
        <div className={styles.panelTitle}>選項</div>

        <div className={styles.optionList} role="radiogroup" aria-label={`${selectedLabel} options`}>
          {selectedOptions.map(option => (
            <button
              className={option.id === selectedOptionId ? styles.activeOptionButton : styles.optionButton}
              type="button"
              key={option.id}
              onClick={() => selectOption(option.id)}
              role="radio"
              aria-checked={option.id === selectedOptionId}
            >
              <span>{option.label}</span>
              <span className={styles.optionId}>{option.id}</span>
            </button>
          ))}
        </div>

        {(selectedAccessory || isUpperEyelidPart || isEyeLightPart || isEyelidPart) && (
          <div className={styles.segmentedControl} role="tablist" aria-label={`${selectedLabel}位置模式`}>
            <button
              className={selectedPoseKey === 'portrait' ? styles.activeSegmentButton : styles.segmentButton}
              type="button"
              onClick={() => {
                if (selectedAccessory) {
                  setSelectedAccessoryPoseKey('portrait');
                  return;
                }

                if (isEyeLightPart) {
                  setSelectedEyeLightPoseKey('portrait');
                  return;
                }

                if (isEyelidPart) {
                  setSelectedEyelidPoseKey('portrait');
                  return;
                }

                setSelectedUpperEyelidPoseKey('portrait');
              }}
              role="tab"
              aria-selected={selectedPoseKey === 'portrait'}
            >
              胸像
            </button>
            <button
              className={selectedPoseKey === 'chibi' ? styles.activeSegmentButton : styles.segmentButton}
              type="button"
              onClick={() => {
                if (selectedAccessory) {
                  setSelectedAccessoryPoseKey('chibi');
                  return;
                }

                if (isEyeLightPart) {
                  setSelectedEyeLightPoseKey('chibi');
                  return;
                }

                if (isEyelidPart) {
                  setSelectedEyelidPoseKey('chibi');
                  return;
                }

                setSelectedUpperEyelidPoseKey('chibi');
              }}
              role="tab"
              aria-selected={selectedPoseKey === 'chibi'}
            >
              Q版
            </button>
          </div>
        )}

        {selectedEditableProperties.includes('color') && isSelectedOptionColorEditable && (
          <label className={styles.colorField}>
            <span>{selectedPart?.key === 'eyes.color' ? 'left color' : 'color'}</span>
            <input
              type="color"
              value={selectedAppearanceState.color ?? selectedAccessoryDefinition?.defaultColor ?? selectedPart?.defaultColor ?? '#000000'}
              onChange={event => changeColor(event.target.value)}
            />
          </label>
        )}

        {selectedPart?.key === 'eyes.color' && (
          <label className={styles.colorField}>
            <span>right color</span>
            <input
              type="color"
              value={selectedPartState.secondaryColor ?? selectedPartState.color ?? selectedPart.defaultColor ?? '#000000'}
              onChange={event => changeSecondaryColor(event.target.value)}
            />
          </label>
        )}

        {isMiniClothingBottomPart && (
          <label className={styles.colorField}>
            <span>side deco</span>
            <input
              type="color"
              value={selectedPartState.secondaryColor ?? '#808080'}
              onChange={event => changeSecondaryColor(event.target.value)}
            />
          </label>
        )}

        {selectedEditableProperties.includes('lineColor') && (
          <label className={styles.colorField}>
            <span>line</span>
            <input
              type="color"
              value={selectedLineColorState.lineColor ?? selectedAccessoryDefinition?.defaultLineColor ?? selectedPart?.defaultLineColor ?? '#262626'}
              onChange={event => changeLineColor(event.target.value)}
            />
          </label>
        )}

        {selectedEditableProperties.includes('visibility') && (
          <label className={styles.toggleField}>
            <input
              type="checkbox"
              checked={selectedPartState.isVisible !== false}
              onChange={event => setPartVisible(event.target.checked)}
            />
            <span>顯示</span>
          </label>
        )}

        {selectedEditableProperties.includes('layerOrder') && (
          <div className={styles.controlGroup}>
            <div className={styles.controlTitle}>layer</div>
            <div className={styles.actionRow}>
              <button type="button" onClick={() => setClothingLayerOrder(0)}>
                移到後
              </button>
              <button type="button" onClick={() => setClothingLayerOrder(1)}>
                移到前
              </button>
            </div>
            <div className={styles.valueRow}>{selectedPartState.layerOrder === 1 ? '前' : '後'}</div>
          </div>
        )}

        {selectedAccessory && (
          <label className={styles.selectField}>
            <span>layer</span>
            <select
              value={selectedAccessoryPose?.layerSlot ?? selectedAccessory.layerSlot}
              onChange={event => changeAccessoryLayerSlot(event.target.value as AccessoryLayerSlot)}
            >
              {selectedAccessoryDefinition?.allowedLayerSlots.map(layerSlot => {
                const slotDefinition = getAccessoryLayerSlotDefinition(layerSlot);

                return (
                  <option value={slotDefinition.id} key={slotDefinition.id}>
                    {slotDefinition.label}
                  </option>
                );
              })}
            </select>
          </label>
        )}

        {hasPositionControls(selectedEditableProperties) && (
          <div className={styles.controlGroup}>
            <div className={styles.controlTitle}>x.y 軸</div>
            <div className={styles.nudgeGrid}>
              <NudgeButton
                label="上"
                ariaLabel="向上移動"
                disabled={isMoveUpDisabled}
                deltaX={0}
                deltaY={-MOVE_STEP}
                onMove={movePart}
                onHoldStart={startHoldMove}
                onHoldStop={stopHoldMove}
              />
              <NudgeButton
                label="左"
                ariaLabel="向左移動"
                disabled={!canMoveX}
                deltaX={-MOVE_STEP}
                deltaY={0}
                onMove={movePart}
                onHoldStart={startHoldMove}
                onHoldStop={stopHoldMove}
              />
              <NudgeButton
                label="右"
                ariaLabel="向右移動"
                disabled={!canMoveX}
                deltaX={MOVE_STEP}
                deltaY={0}
                onMove={movePart}
                onHoldStart={startHoldMove}
                onHoldStop={stopHoldMove}
              />
              <NudgeButton
                label="下"
                ariaLabel="向下移動"
                disabled={isMoveDownDisabled}
                deltaX={0}
                deltaY={MOVE_STEP}
                onMove={movePart}
                onHoldStart={startHoldMove}
                onHoldStop={stopHoldMove}
              />
            </div>
            <div className={styles.valueRow}>
              x {selectedState.offsetX ?? 0} / y {selectedState.offsetY ?? 0}
            </div>
          </div>
        )}

        {selectedEditableProperties.includes('rotate') && (
          <div className={styles.controlGroup}>
            <div className={styles.controlTitle}>rotate</div>
            <div className={styles.actionRow}>
              <button type="button" onClick={() => rotatePart(-ROTATE_STEP)} aria-label="逆時針旋轉">
                逆時針
              </button>
              <button type="button" onClick={() => rotatePart(ROTATE_STEP)} aria-label="順時針旋轉">
                順時針
              </button>
            </div>
            <div className={styles.valueRow}>{selectedState.rotate ?? 0} deg</div>
          </div>
        )}

        {selectedEditableProperties.includes('scale') && (
          <div className={styles.controlGroup}>
            <div className={styles.controlTitle}>scale</div>
            <div className={styles.actionRow}>
              <button type="button" onClick={() => scalePart(-SCALE_STEP)} aria-label="縮小">
                縮小
              </button>
              <button type="button" onClick={() => scalePart(SCALE_STEP)} aria-label="放大">
                放大
              </button>
            </div>
            <div className={styles.valueRow}>{(selectedState.scale ?? 1).toFixed(2)}</div>
          </div>
        )}

        {selectedEditableProperties.includes('flipX') && (
          <div className={styles.controlGroup}>
            <div className={styles.controlTitle}>flip</div>
            <div className={styles.actionRow}>
              <button type="button" onClick={flipPart} aria-label="左右翻轉">
                左右翻轉
              </button>
            </div>
            <div className={styles.valueRow}>{selectedState.flipX ? 'on' : 'off'}</div>
          </div>
        )}

        {selectedAccessory?.category === 'sideHair' && (
          <div className={styles.controlGroup}>
            <div className={styles.controlTitle}>side</div>
            <label className={styles.toggleField}>
              <input
                type="checkbox"
                checked={selectedState.leftVisible !== false}
                onChange={event => setSideVisible('left', event.target.checked)}
              />
              <span>左</span>
            </label>
            <label className={styles.toggleField}>
              <input
                type="checkbox"
                checked={selectedState.rightVisible !== false}
                onChange={event => setSideVisible('right', event.target.checked)}
              />
              <span>右</span>
            </label>
          </div>
        )}

        {selectedPart?.key === 'eyes.light' && (
          <div className={styles.controlGroup}>
            <div className={styles.controlTitle}>distance</div>
            <div className={styles.actionRow}>
              <button type="button" onClick={() => changeLightDistance(-LIGHT_DISTANCE_STEP)} aria-label="縮短亮點距離">
                縮短
              </button>
              <button type="button" onClick={() => changeLightDistance(LIGHT_DISTANCE_STEP)} aria-label="拉開亮點距離">
                拉開
              </button>
            </div>
            <div className={styles.valueRow}>{selectedLightDistance}</div>
          </div>
        )}

        {selectedAccessory && (
          <div className={styles.controlGroup}>
            {selectedAccessoryPoseKey === 'chibi' && (
              <button type="button" onClick={estimateChibiPoseFromPortrait}>
                套用胸像比例位置
              </button>
            )}
            <div className={styles.actionRow}>
              <button type="button" onClick={removeSelectedAccessory}>
                刪除配件
              </button>
            </div>
          </div>
        )}
      </aside>

      {pendingTemplateAction && (
        <Modal
          options={{
            title: getTemplateActionTitle(pendingTemplateAction),
            content: getTemplateActionMessage(pendingTemplateAction),
            hasConfirmCancelButtons: true,
            closeOnBackdropClick: true,
            confirmLabel: getTemplateActionConfirmLabel(pendingTemplateAction),
            cancelLabel: '取消',
            onConfirm: confirmTemplateAction,
            onCancel: () => setPendingTemplateAction(null),
          }}
          onClose={() => setPendingTemplateAction(null)}
        />
      )}
    </section>
  );
}

function getTemplateActionTitle(action: TemplateAction): string {
  if (action.type === 'reset') {
    return '重置外觀';
  }

  if (action.type === 'load') {
    return '套用模板';
  }

  if (action.type === 'overwrite') {
    return '覆蓋模板';
  }

  return '刪除模板';
}

function getTemplateActionMessage(action: TemplateAction): string {
  if (action.type === 'reset') {
    return '要把目前正在編輯的外觀全部重置為預設值嗎？';
  }

  if (action.type === 'load') {
    return `要用「${action.template.name}」覆蓋目前正在編輯的外觀嗎？`;
  }

  if (action.type === 'overwrite') {
    return `要用目前正在編輯的外觀覆蓋「${action.template.name}」嗎？`;
  }

  return `要刪除「${action.template.name}」嗎？`;
}

function getTemplateActionConfirmLabel(action: TemplateAction): string {
  if (action.type === 'reset') {
    return '重置';
  }

  if (action.type === 'load') {
    return '套用';
  }

  if (action.type === 'overwrite') {
    return '覆蓋';
  }

  return '刪除';
}

function PartButton({
  part,
  isSelected,
  onSelect,
}: {
  part: AvatarPartDefinition;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={isSelected ? styles.activePartButton : styles.partButton}
      type="button"
      onClick={onSelect}
      role="radio"
      aria-checked={isSelected}
    >
      <span>{part.label}</span>
      <span className={styles.zIndex}>z {part.zIndex}</span>
    </button>
  );
}

function AccessoryButton({
  accessory,
  isSelected,
  onDragEnd,
  onDragStart,
  onDrop,
  onSelect,
}: {
  accessory: AvatarAccessoryInstance;
  isSelected: boolean;
  onDragEnd: () => void;
  onDragStart: () => void;
  onDrop: () => void;
  onSelect: () => void;
}) {
  return (
    <button
      className={isSelected ? styles.activeAccessoryButton : styles.accessoryButton}
      type="button"
      draggable
      onClick={onSelect}
      onDragEnd={onDragEnd}
      onDragOver={event => event.preventDefault()}
      onDragStart={event => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', accessory.instanceId);
        onDragStart();
      }}
      onDrop={event => {
        event.preventDefault();
        onDrop();
      }}
    >
      <span>{getAccessoryDisplayName(accessory)}</span>
      <span className={styles.zIndex}>{getAccessoryLayerSlotDefinition(accessory.layerSlot).label}</span>
    </button>
  );
}

function NudgeButton({
  label,
  ariaLabel,
  disabled = false,
  deltaX,
  deltaY,
  onMove,
  onHoldStart,
  onHoldStop,
}: {
  label: string;
  ariaLabel: string;
  disabled?: boolean;
  deltaX: number;
  deltaY: number;
  onMove: (deltaX: number, deltaY: number) => void;
  onHoldStart: (deltaX: number, deltaY: number) => void;
  onHoldStop: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={event => {
        if (disabled) {
          return;
        }

        if (event.detail === 0) {
          onMove(deltaX, deltaY);
        }
      }}
      onContextMenu={event => event.preventDefault()}
      onPointerCancel={onHoldStop}
      onPointerDown={event => {
        if (disabled) {
          return;
        }

        event.currentTarget.setPointerCapture(event.pointerId);
        onHoldStart(deltaX, deltaY);
      }}
      onPointerLeave={onHoldStop}
      onPointerUp={event => {
        event.currentTarget.releasePointerCapture(event.pointerId);
        onHoldStop();
      }}
    >
      {label}
    </button>
  );
}

function hasPositionControls(editableProperties: readonly string[]): boolean {
  return editableProperties.includes('offsetX') || editableProperties.includes('offsetY');
}

function isKeyboardInputTarget(target: EventTarget | null): boolean {
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

function getHoldMoveMultiplier(tickCount: number): number {
  const multiplier = 2 ** Math.floor(tickCount / HOLD_ACCELERATION_TICKS);
  return Math.min(MAX_HOLD_MOVE_MULTIPLIER, multiplier);
}

function getSelectedLightDistance(partKey: AvatarPartKey, state: AvatarPartState): number {
  return state.lightDistance ?? (
    partKey === 'mini.eyeLight'
      ? MINI_DEFAULT_EYE_LIGHT_DISTANCE
      : DEFAULT_PORTRAIT_EYE_LIGHT_DISTANCE
  );
}

function getDraftSaveStatusLabel(status: DraftSaveStatus): string {
  if (status === 'pending') {
    return '草稿待儲存';
  }

  if (status === 'saved') {
    return '草稿已儲存';
  }

  if (status === 'error') {
    return '草稿儲存失敗';
  }

  return '草稿未變更';
}
