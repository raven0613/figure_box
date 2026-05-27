import { useEffect, useMemo, useRef, useState } from 'react';

import {
  AVATAR_EDITOR_PART_DEFINITIONS,
  AvatarCanvas,
  AvatarPartDefinition,
  AvatarPartKey,
  AvatarState,
  createDefaultAvatarState,
} from '~/widgets/avatarCanvas';
import styles from './avatarEditor.module.scss';

const MOVE_STEP = 4;
const ROTATE_STEP = 5;
const SCALE_STEP = 0.05;
const LIGHT_DISTANCE_STEP = 2;

interface AvatarEditorContainerProps {
  initialState?: Partial<AvatarState>;
  onAvatarChange?: (state: AvatarState) => void;
}

export function AvatarEditorContainer({ initialState, onAvatarChange }: AvatarEditorContainerProps) {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const avatarCanvasRef = useRef<AvatarCanvas | null>(null);
  const onAvatarChangeRef = useRef(onAvatarChange);
  const initialStateRef = useRef(initialState);
  const [selectedPartKey, setSelectedPartKey] = useState<AvatarPartKey>('face');
  const [avatarState, setAvatarState] = useState<AvatarState>(() => createDefaultAvatarState());

  const selectedPart = useMemo(
    () => AVATAR_EDITOR_PART_DEFINITIONS.find(part => part.key === selectedPartKey) ?? AVATAR_EDITOR_PART_DEFINITIONS[0],
    [selectedPartKey]
  );
  const selectedPartState = avatarState[selectedPart.key];

  useEffect(() => {
    onAvatarChangeRef.current = onAvatarChange;
  }, [onAvatarChange]);

  useEffect(() => {
    initialStateRef.current = initialState;
  }, [initialState]);

  useEffect(() => {
    if (!canvasHostRef.current) {
      return;
    }

    const canvasHost = canvasHostRef.current;
    const avatarCanvas = AvatarCanvas.mount(canvasHost, {
      initialState: initialStateRef.current,
      onChange: state => {
        setAvatarState(state);
        onAvatarChangeRef.current?.(state);
      },
    });
    avatarCanvasRef.current = avatarCanvas;

    return () => {
      avatarCanvasRef.current = null;
      void avatarCanvas.destroy();
      canvasHost.replaceChildren();
    };
  }, []);

  const selectOption = (optionId: number) => {
    avatarCanvasRef.current?.setOption(selectedPart.key, optionId);
  };

  const changeColor = (color: string) => {
    avatarCanvasRef.current?.setColor(selectedPart.key, color);
  };

  const changeLineColor = (lineColor: string) => {
    avatarCanvasRef.current?.setLineColor(selectedPart.key, lineColor);
  };

  const movePart = (deltaX: number, deltaY: number) => {
    avatarCanvasRef.current?.move(selectedPart.key, deltaX, deltaY);
  };

  const rotatePart = (delta: number) => {
    avatarCanvasRef.current?.rotate(selectedPart.key, delta);
  };

  const scalePart = (delta: number) => {
    avatarCanvasRef.current?.scale(selectedPart.key, delta);
  };

  const flipPart = () => {
    avatarCanvasRef.current?.flip(selectedPart.key);
  };

  const setSideVisible = (side: 'left' | 'right', isVisible: boolean) => {
    avatarCanvasRef.current?.setSideVisible(selectedPart.key, side, isVisible);
  };

  const changeLightDistance = (delta: number) => {
    avatarCanvasRef.current?.setLightDistance(
      selectedPart.key,
      (selectedPartState.lightDistance ?? 45) + delta
    );
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
              isSelected={part.key === selectedPart.key}
              onSelect={() => setSelectedPartKey(part.key)}
            />
          ))}
        </div>
      </aside>

      <div className={styles.canvasShell}>
        <div className={styles.canvasHost} ref={canvasHostRef} />
      </div>

      <aside className={styles.optionMenu} aria-label="選擇選項與調整">
        <div className={styles.panelTitle}>選項</div>

        <div className={styles.optionList} role="radiogroup" aria-label={`${selectedPart.label} options`}>
          {selectedPart.options.map(option => (
            <button
              className={option.id === selectedPartState.optionId ? styles.activeOptionButton : styles.optionButton}
              type="button"
              key={option.id}
              onClick={() => selectOption(option.id)}
              role="radio"
              aria-checked={option.id === selectedPartState.optionId}
            >
              <span>{option.label}</span>
              <span className={styles.optionId}>{option.id}</span>
            </button>
          ))}
        </div>

        {selectedPart.editableProperties.includes('color') && (
          <label className={styles.colorField}>
            <span>color</span>
            <input
              type="color"
              value={selectedPartState.color ?? selectedPart.defaultColor ?? '#000000'}
              onChange={event => changeColor(event.target.value)}
            />
          </label>
        )}

        {selectedPart.editableProperties.includes('lineColor') && (
          <label className={styles.colorField}>
            <span>line</span>
            <input
              type="color"
              value={selectedPartState.lineColor ?? selectedPart.defaultLineColor ?? '#262626'}
              onChange={event => changeLineColor(event.target.value)}
            />
          </label>
        )}

        {hasPositionControls(selectedPart) && (
          <div className={styles.controlGroup}>
            <div className={styles.controlTitle}>x.y 軸</div>
            <div className={styles.nudgeGrid}>
              <button type="button" onClick={() => movePart(0, -MOVE_STEP)} aria-label="向上移動">
                上
              </button>
              <button type="button" onClick={() => movePart(-MOVE_STEP, 0)} aria-label="向左移動">
                左
              </button>
              <button type="button" onClick={() => movePart(MOVE_STEP, 0)} aria-label="向右移動">
                右
              </button>
              <button type="button" onClick={() => movePart(0, MOVE_STEP)} aria-label="向下移動">
                下
              </button>
            </div>
            <div className={styles.valueRow}>
              x {selectedPartState.offsetX ?? 0} / y {selectedPartState.offsetY ?? 0}
            </div>
          </div>
        )}

        {selectedPart.editableProperties.includes('rotate') && (
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
            <div className={styles.valueRow}>{selectedPartState.rotate ?? 0} deg</div>
          </div>
        )}

        {selectedPart.editableProperties.includes('scale') && (
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
            <div className={styles.valueRow}>{(selectedPartState.scale ?? 1).toFixed(2)}</div>
          </div>
        )}

        {selectedPart.editableProperties.includes('flipX') && (
          <div className={styles.controlGroup}>
            <div className={styles.controlTitle}>flip</div>
            <div className={styles.actionRow}>
              <button type="button" onClick={flipPart} aria-label="左右翻轉">
                左右翻轉
              </button>
            </div>
            <div className={styles.valueRow}>{selectedPartState.flipX ? 'on' : 'off'}</div>
          </div>
        )}

        {selectedPart.key === 'hair.sideburns' && (
          <div className={styles.controlGroup}>
            <div className={styles.controlTitle}>side</div>
            <label className={styles.toggleField}>
              <input
                type="checkbox"
                checked={selectedPartState.leftVisible !== false}
                onChange={event => setSideVisible('left', event.target.checked)}
              />
              <span>左</span>
            </label>
            <label className={styles.toggleField}>
              <input
                type="checkbox"
                checked={selectedPartState.rightVisible !== false}
                onChange={event => setSideVisible('right', event.target.checked)}
              />
              <span>右</span>
            </label>
          </div>
        )}

        {selectedPart.key === 'eyes.light' && (
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

function hasPositionControls(part: AvatarPartDefinition): boolean {
  return part.editableProperties.includes('offsetX') || part.editableProperties.includes('offsetY');
}
