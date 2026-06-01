import { useEffect, useMemo, useRef, useState } from 'react';

import {
  ACCESSORY_CATEGORY_DEFINITIONS,
  ACCESSORY_LAYER_SLOT_DEFINITIONS,
  AccessoryCategory,
  AccessoryLayerSlot,
  AccessoryPoseKey,
  AVATAR_EDITOR_PART_DEFINITIONS,
  AvatarCanvas,
  AvatarAccessoryInstance,
  AvatarPartDefinition,
  AvatarPartKey,
  AvatarState,
  createDefaultAvatarState,
  getAccessoryCategoryDefinition,
  getAccessoryDisplayName,
  getAccessoryLayerSlotDefinition,
  getAccessoryPoseState,
} from '~/widgets/avatarCanvas';
import { MiniAvatarCanvas } from '~/widgets/miniAvatarCanvas';
import styles from './avatarEditor.module.scss';

const MOVE_STEP = 1;
const HOLD_MOVE_DELAY_MS = 300;
const HOLD_MOVE_INTERVAL_MS = 90;
const HOLD_ACCELERATION_TICKS = 8;
const MAX_HOLD_MOVE_MULTIPLIER = 16;
const ROTATE_STEP = 5;
const SCALE_STEP = 0.05;
const LIGHT_DISTANCE_STEP = 2;

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

export function AvatarEditorContainer({ initialState, onAvatarChange }: AvatarEditorContainerProps) {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const miniCanvasHostRef = useRef<HTMLDivElement | null>(null);
  const avatarCanvasRef = useRef<AvatarCanvas | null>(null);
  const miniAvatarCanvasRef = useRef<MiniAvatarCanvas | null>(null);
  const holdMoveRef = useRef<HoldMoveState>({
    timeoutId: null,
    intervalId: null,
    tickCount: 0,
  });
  const onAvatarChangeRef = useRef(onAvatarChange);
  const initialStateRef = useRef(initialState);
  const [selectedTarget, setSelectedTarget] = useState<SelectedTarget>({ type: 'part', key: 'face' });
  const [selectedAccessoryPoseKey, setSelectedAccessoryPoseKey] = useState<AccessoryPoseKey>('portrait');
  const [draggingAccessoryId, setDraggingAccessoryId] = useState<string | null>(null);
  const [avatarState, setAvatarState] = useState<AvatarState>(() => createDefaultAvatarState());

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
  const selectedEditableProperties = selectedAccessoryDefinition?.editableProperties ?? selectedPart?.editableProperties ?? [];
  const selectedLabel = selectedAccessory ? getAccessoryDisplayName(selectedAccessory) : selectedPart?.label ?? '';
  const selectedAccessoryPose = selectedAccessory
    ? getAccessoryPoseState(selectedAccessory, selectedAccessoryPoseKey)
    : null;
  const selectedPartState = selectedPart ? avatarState[selectedPart.key] : avatarState.face;
  const selectedAppearanceState = selectedAccessory ?? selectedPartState;
  const selectedState = selectedAccessoryPose ?? selectedPartState;
  const selectedOptionId = selectedAppearanceState.optionId;
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
    onAvatarChangeRef.current = onAvatarChange;
  }, [onAvatarChange]);

  useEffect(() => {
    initialStateRef.current = initialState;
  }, [initialState]);

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
    if (!canvasHostRef.current || !miniCanvasHostRef.current) {
      return;
    }

    const canvasHost = canvasHostRef.current;
    const miniCanvasHost = miniCanvasHostRef.current;
    const avatarCanvas = AvatarCanvas.mount(canvasHost, {
      initialState: initialStateRef.current,
      onChange: state => {
        setAvatarState(state);
        miniAvatarCanvasRef.current?.setState(state);
        onAvatarChangeRef.current?.(state);
      },
    });
    const miniAvatarCanvas = MiniAvatarCanvas.mount(miniCanvasHost, {
      initialState: avatarCanvas.getState(),
    });
    avatarCanvasRef.current = avatarCanvas;
    miniAvatarCanvasRef.current = miniAvatarCanvas;

    return () => {
      avatarCanvasRef.current = null;
      miniAvatarCanvasRef.current = null;
      void avatarCanvas.destroy();
      void miniAvatarCanvas.destroy();
      canvasHost.replaceChildren();
      miniCanvasHost.replaceChildren();
    };
  }, []);

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

    if (selectedPart) {
      avatarCanvasRef.current?.setLineColor(selectedPart.key, lineColor);
    }
  };

  const changeSecondaryColor = (secondaryColor: string) => {
    if (selectedTarget.type === 'part' && selectedPart) {
      avatarCanvasRef.current?.setSecondaryColor(selectedPart.key, secondaryColor);
    }
  };

  const movePart = (deltaX: number, deltaY: number) => {
    if (selectedTarget.type === 'accessory') {
      avatarCanvasRef.current?.moveAccessory(selectedTarget.instanceId, deltaX, deltaY, selectedAccessoryPoseKey);
      return;
    }

    if (selectedPart) {
      avatarCanvasRef.current?.move(selectedPart.key, deltaX, deltaY);
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

  const rotatePart = (delta: number) => {
    if (selectedTarget.type === 'accessory') {
      avatarCanvasRef.current?.rotateAccessory(selectedTarget.instanceId, delta, selectedAccessoryPoseKey);
      return;
    }

    if (selectedPart) {
      avatarCanvasRef.current?.rotate(selectedPart.key, delta);
    }
  };

  const scalePart = (delta: number) => {
    if (selectedTarget.type === 'accessory') {
      avatarCanvasRef.current?.scaleAccessory(selectedTarget.instanceId, delta, selectedAccessoryPoseKey);
      return;
    }

    if (selectedPart) {
      avatarCanvasRef.current?.scale(selectedPart.key, delta);
    }
  };

  const flipPart = () => {
    if (selectedTarget.type === 'accessory') {
      avatarCanvasRef.current?.flipAccessory(selectedTarget.instanceId, selectedAccessoryPoseKey);
      return;
    }

    if (selectedPart) {
      avatarCanvasRef.current?.flip(selectedPart.key);
    }
  };

  const setSideVisible = (side: 'left' | 'right', isVisible: boolean) => {
    if (selectedTarget.type === 'accessory') {
      avatarCanvasRef.current?.setAccessorySideVisible(
        selectedTarget.instanceId,
        side,
        isVisible,
        selectedAccessoryPoseKey
      );
    }
  };

  const changeLightDistance = (delta: number) => {
    if (!selectedPart) {
      return;
    }

    avatarCanvasRef.current?.setLightDistance(
      selectedPart.key,
      (selectedPartState.lightDistance ?? 45) + delta
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
      layerSlot,
      selectedAccessoryPoseKey
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
      </aside>

      <div className={styles.stageShell}>
        <div className={styles.canvasShell}>
          <div className={styles.canvasHost} ref={canvasHostRef} />
        </div>
        <div className={styles.miniPreviewShell} aria-label="Mini front idle preview">
          <div className={styles.miniCanvasHost} ref={miniCanvasHostRef} />
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

        {selectedAccessory && (
          <div className={styles.segmentedControl} role="tablist" aria-label="配件位置模式">
            <button
              className={selectedAccessoryPoseKey === 'portrait' ? styles.activeSegmentButton : styles.segmentButton}
              type="button"
              onClick={() => setSelectedAccessoryPoseKey('portrait')}
              role="tab"
              aria-selected={selectedAccessoryPoseKey === 'portrait'}
            >
              胸像
            </button>
            <button
              className={selectedAccessoryPoseKey === 'chibi' ? styles.activeSegmentButton : styles.segmentButton}
              type="button"
              onClick={() => setSelectedAccessoryPoseKey('chibi')}
              role="tab"
              aria-selected={selectedAccessoryPoseKey === 'chibi'}
            >
              Q版
            </button>
          </div>
        )}

        {selectedEditableProperties.includes('color') && (
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

        {selectedEditableProperties.includes('lineColor') && (
          <label className={styles.colorField}>
            <span>line</span>
            <input
              type="color"
              value={selectedAppearanceState.lineColor ?? selectedAccessoryDefinition?.defaultLineColor ?? selectedPart?.defaultLineColor ?? '#262626'}
              onChange={event => changeLineColor(event.target.value)}
            />
          </label>
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
                deltaX={0}
                deltaY={-MOVE_STEP}
                onMove={movePart}
                onHoldStart={startHoldMove}
                onHoldStop={stopHoldMove}
              />
              <NudgeButton
                label="左"
                ariaLabel="向左移動"
                deltaX={-MOVE_STEP}
                deltaY={0}
                onMove={movePart}
                onHoldStart={startHoldMove}
                onHoldStop={stopHoldMove}
              />
              <NudgeButton
                label="右"
                ariaLabel="向右移動"
                deltaX={MOVE_STEP}
                deltaY={0}
                onMove={movePart}
                onHoldStart={startHoldMove}
                onHoldStop={stopHoldMove}
              />
              <NudgeButton
                label="下"
                ariaLabel="向下移動"
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
            <div className={styles.valueRow}>{selectedPartState.lightDistance ?? 45}</div>
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
    </section>
  );
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
  deltaX,
  deltaY,
  onMove,
  onHoldStart,
  onHoldStop,
}: {
  label: string;
  ariaLabel: string;
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
      onClick={event => {
        if (event.detail === 0) {
          onMove(deltaX, deltaY);
        }
      }}
      onContextMenu={event => event.preventDefault()}
      onPointerCancel={onHoldStop}
      onPointerDown={event => {
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

function getHoldMoveMultiplier(tickCount: number): number {
  const multiplier = 2 ** Math.floor(tickCount / HOLD_ACCELERATION_TICKS);
  return Math.min(MAX_HOLD_MOVE_MULTIPLIER, multiplier);
}
