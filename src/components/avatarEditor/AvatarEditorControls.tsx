import { useRef } from 'react';

import type {
  AvatarColorGradient,
  AvatarGradientType,
} from '~/widgets/avatarCanvas';
import type { HairApplyKind, HairApplyTarget } from './avatarEditorTypes';
import styles from './avatarEditor.module.scss';

interface GradientColorControlProps {
  title: string;
  color: string;
  gradient?: AvatarColorGradient;
  onColorChange: (color: string) => void;
  onGradientModeChange: (type: AvatarGradientType | 'solid') => void;
  onGradientUpdate: (patch: Partial<AvatarColorGradient>) => void;
}

export function GradientColorControl({
  title,
  color,
  gradient,
  onColorChange,
  onGradientModeChange,
  onGradientUpdate,
}: GradientColorControlProps) {
  return (
    <div className={styles.controlGroup}>
      <label className={styles.selectField}>
        <span>{title}</span>
        <select
          value={gradient?.type ?? 'solid'}
          onChange={event => onGradientModeChange(event.target.value as AvatarGradientType | 'solid')}
        >
          <option value="solid">單色</option>
          <option value="linear">直向漸層</option>
          <option value="radial">圓形漸層</option>
        </select>
      </label>

      {!gradient ? (
        <label className={styles.colorField}>
          <span>color</span>
          <input
            type="color"
            value={color}
            onChange={event => onColorChange(event.target.value)}
          />
        </label>
      ) : (
        <div className={styles.gradientControls}>
          <label className={styles.colorField}>
            <span>{gradient.type === 'radial' ? 'center' : 'top'}</span>
            <input
              type="color"
              value={gradient.fromColor}
              onChange={event => onGradientUpdate({ fromColor: event.target.value })}
            />
          </label>
          <label className={styles.colorField}>
            <span>{gradient.type === 'radial' ? 'outer' : 'bottom'}</span>
            <input
              type="color"
              value={gradient.toColor}
              onChange={event => onGradientUpdate({ toColor: event.target.value })}
            />
          </label>
          <button
            className={styles.swapGradientButton}
            type="button"
            onClick={() => onGradientUpdate({
              fromColor: gradient.toColor,
              toColor: gradient.fromColor,
            })}
          >
            交換兩端顏色
          </button>
          <label className={styles.rangeField}>
            <span>position {gradient.position}</span>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={gradient.position}
              onChange={event => onGradientUpdate({ position: Number(event.target.value) })}
            />
          </label>
          {gradient.type === 'linear' && (
            <label className={styles.rangeField}>
              <span>angle {gradient.angle}</span>
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                value={gradient.angle}
                onChange={event => onGradientUpdate({ angle: Number(event.target.value) })}
              />
            </label>
          )}
          {gradient.type === 'radial' && (
            <>
              <label className={styles.rangeField}>
                <span>center x {gradient.centerX}</span>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={gradient.centerX}
                  onChange={event => onGradientUpdate({ centerX: Number(event.target.value) })}
                />
              </label>
              <label className={styles.rangeField}>
                <span>center y {gradient.centerY}</span>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={gradient.centerY}
                  onChange={event => onGradientUpdate({ centerY: Number(event.target.value) })}
                />
              </label>
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface HairApplyButtonProps {
  kind: HairApplyKind;
  isActive: boolean;
  onClick: () => void;
}

export function HairApplyButton({
  kind,
  isActive,
  onClick,
}: HairApplyButtonProps) {
  return (
    <button
      className={isActive ? styles.activeApplyButton : styles.applyButton}
      type="button"
      onClick={onClick}
    >
      套用{kind === 'color' ? '顏色' : '線色'}
    </button>
  );
}

interface HairApplyPanelProps {
  targets: HairApplyTarget[];
  selectedTargetIds: string[];
  onToggleTarget: (targetId: string, isSelected: boolean) => void;
  onToggleAll: (isSelected: boolean) => void;
  onApply: () => void;
  onApplySharedHairGradient?: () => void;
}

export function HairApplyPanel({
  targets,
  selectedTargetIds,
  onToggleTarget,
  onToggleAll,
  onApply,
  onApplySharedHairGradient,
}: HairApplyPanelProps) {
  const isAllSelected = targets.length > 0 && selectedTargetIds.length === targets.length;

  return (
    <div className={styles.applyPanel}>
      <label className={styles.toggleField}>
        <input
          type="checkbox"
          checked={isAllSelected}
          onChange={event => onToggleAll(event.target.checked)}
        />
        <span>全選</span>
      </label>
      <div className={styles.applyTargetList}>
        {targets.map(target => (
          <label className={styles.toggleField} key={target.id}>
            <input
              type="checkbox"
              checked={selectedTargetIds.includes(target.id)}
              onChange={event => onToggleTarget(target.id, event.target.checked)}
            />
            <span>{target.label}</span>
          </label>
        ))}
      </div>
      <button
        type="button"
        disabled={selectedTargetIds.length === 0}
        onClick={onApply}
      >
        確定套用
      </button>
      {onApplySharedHairGradient && (
        <button
          type="button"
          disabled={selectedTargetIds.length === 0}
          onClick={onApplySharedHairGradient}
        >
          套用共用座標漸層
        </button>
      )}
    </div>
  );
}

interface NudgeButtonProps {
  label: string;
  ariaLabel: string;
  disabled?: boolean;
  deltaX: number;
  deltaY: number;
  onMove: (deltaX: number, deltaY: number) => void;
  onHoldStart: (deltaX: number, deltaY: number) => void;
  onHoldStop: () => void;
}

export function NudgeButton({
  label,
  ariaLabel,
  disabled = false,
  deltaX,
  deltaY,
  onMove,
  onHoldStart,
  onHoldStop,
}: NudgeButtonProps) {
  const didHandlePointerDownRef = useRef(false);

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={event => {
        if (disabled) {
          return;
        }

        if (event.detail === 0 || !didHandlePointerDownRef.current) {
          onMove(deltaX, deltaY);
        }

        didHandlePointerDownRef.current = false;
      }}
      onContextMenu={event => event.preventDefault()}
      onPointerCancel={() => {
        didHandlePointerDownRef.current = false;
        onHoldStop();
      }}
      onPointerDown={event => {
        if (disabled) {
          return;
        }

        if (event.pointerType === 'touch') {
          didHandlePointerDownRef.current = false;
          return;
        }

        event.currentTarget.setPointerCapture(event.pointerId);
        didHandlePointerDownRef.current = true;
        onHoldStart(deltaX, deltaY);
      }}
      onPointerLeave={onHoldStop}
      onPointerUp={event => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }

        onHoldStop();
      }}
    >
      {label}
    </button>
  );
}
