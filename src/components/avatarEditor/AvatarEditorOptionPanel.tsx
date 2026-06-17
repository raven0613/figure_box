import {
  type AccessoryCategoryDefinition,
  type AccessoryColorVariantOption,
  type AccessoryLayerSlot,
  type AccessoryPoseKey,
  type AvatarAccessoryInstance,
  type AvatarAccessoryPoseState,
  type AvatarColorGradient,
  type AvatarEditableProperty,
  type AvatarGradientType,
  type AvatarPartDefinition,
  type AvatarPartOption,
  type AvatarPartState,
  getAccessoryLayerSlotDefinition,
} from '~/widgets/avatarCanvas';
import { hasPositionControls } from '~/utils/avatarEditorUtils';
import {
  LIGHT_DISTANCE_STEP,
  MOVE_STEP,
  ROTATE_STEP,
  SCALE_STEP,
} from './avatarEditorConstants';
import {
  GradientColorControl,
  HairApplyButton,
  HairApplyPanel,
  NudgeButton,
} from './AvatarEditorControls';
import type {
  ApplyHairSettings,
  HairApplyKind,
  HairApplyTarget,
  HairLightPoseKey,
  PortraitChibiPoseKey,
} from './avatarEditorTypes';
import styles from './avatarEditor.module.scss';

interface HairApplyPanelState {
  kind: HairApplyKind;
  selectedTargetIds: string[];
}

interface AvatarEditorOptionPanelProps {
  canMoveX: boolean;
  canUseColorGradient: boolean;
  hairApplyPanel: HairApplyPanelState | null;
  hairApplyTargets: HairApplyTarget[];
  isAccessoryBackPoseFollowingFront: boolean;
  isEyeLightPart: boolean;
  isEyelidPart: boolean;
  isHairLightPart: boolean;
  isMiniClothingBottomPart: boolean;
  isMoveDownDisabled: boolean;
  isMoveUpDisabled: boolean;
  isSelectedHairColorSource: boolean;
  isSelectedOptionColorEditable: boolean;
  isUpperEyelidPart: boolean;
  selectedAccessory: AvatarAccessoryInstance | null;
  selectedAccessoryColorVariantId?: number;
  selectedAccessoryColorVariants: AccessoryColorVariantOption[];
  selectedAccessoryDefinition: AccessoryCategoryDefinition | null;
  selectedAccessoryPose: AvatarAccessoryPoseState | null;
  selectedAccessoryPoseKey: AccessoryPoseKey;
  selectedAppearanceState: AvatarPartState;
  selectedEditableProperties: readonly AvatarEditableProperty[];
  selectedHairLightPoseKey: HairLightPoseKey;
  selectedLabel: string;
  selectedLightDistance: number;
  selectedLineColorState: AvatarPartState;
  selectedOptionId: number;
  selectedOptions: AvatarPartOption[];
  selectedPart: AvatarPartDefinition | null;
  selectedPartState: AvatarPartState;
  selectedPoseKey: AccessoryPoseKey | PortraitChibiPoseKey | HairLightPoseKey;
  selectedState: AvatarPartState | AvatarAccessoryPoseState;
  onAccessoryColorVariantChange: (colorVariantId: number) => void;
  onAccessoryLayerSlotChange: (layerSlot: AccessoryLayerSlot) => void;
  onApplyChibiBackMirror: () => void;
  onApplyHairSettingsToTargets: ApplyHairSettings;
  onChibiBackFollowingFrontChange: (shouldFollow: boolean) => void;
  onClothingLayerOrderChange: (layerOrder: number) => void;
  onColorChange: (color: string) => void;
  onColorGradientModeChange: (type: AvatarGradientType | 'solid') => void;
  onColorGradientUpdate: (patch: Partial<AvatarColorGradient>) => void;
  onEstimateChibiPoseFromPortrait: () => void;
  onEyeLightPoseChange: (poseKey: PortraitChibiPoseKey) => void;
  onEyelidPoseChange: (poseKey: PortraitChibiPoseKey) => void;
  onFlipPart: () => void;
  onHairLightPoseChange: (poseKey: HairLightPoseKey) => void;
  onLineColorChange: (lineColor: string) => void;
  onLineColorGradientModeChange: (type: AvatarGradientType | 'solid') => void;
  onLineColorGradientUpdate: (patch: Partial<AvatarColorGradient>) => void;
  onMovePart: (deltaX: number, deltaY: number) => void;
  onOpenHairApplyPanel: (kind: HairApplyKind) => void;
  onPartVisibleChange: (isVisible: boolean) => void;
  onRemoveSelectedAccessory: () => void;
  onRotatePart: (delta: number) => void;
  onScalePart: (delta: number) => void;
  onSecondaryColorChange: (secondaryColor: string) => void;
  onSecondaryColorGradientModeChange: (type: AvatarGradientType | 'solid') => void;
  onSecondaryColorGradientUpdate: (patch: Partial<AvatarColorGradient>) => void;
  onSelectAccessoryPose: (poseKey: AccessoryPoseKey) => void;
  onSelectOption: (optionId: number) => void;
  onSetAllHairApplyTargets: (isSelected: boolean) => void;
  onSideVisibleChange: (side: 'left' | 'right', isVisible: boolean) => void;
  onStartHoldMove: (deltaX: number, deltaY: number) => void;
  onStopHoldMove: () => void;
  onToggleHairApplyTarget: (targetId: string, isSelected: boolean) => void;
  onToggleSelectedSharedHairGradientSpace: () => void;
  onUpperEyelidPoseChange: (poseKey: PortraitChibiPoseKey) => void;
  onLightDistanceChange: (delta: number) => void;
}

export function AvatarEditorOptionPanel({
  canMoveX,
  canUseColorGradient,
  hairApplyPanel,
  hairApplyTargets,
  isAccessoryBackPoseFollowingFront,
  isEyeLightPart,
  isEyelidPart,
  isHairLightPart,
  isMiniClothingBottomPart,
  isMoveDownDisabled,
  isMoveUpDisabled,
  isSelectedHairColorSource,
  isSelectedOptionColorEditable,
  isUpperEyelidPart,
  selectedAccessory,
  selectedAccessoryColorVariantId,
  selectedAccessoryColorVariants,
  selectedAccessoryDefinition,
  selectedAccessoryPose,
  selectedAccessoryPoseKey,
  selectedAppearanceState,
  selectedEditableProperties,
  selectedHairLightPoseKey,
  selectedLabel,
  selectedLightDistance,
  selectedLineColorState,
  selectedOptionId,
  selectedOptions,
  selectedPart,
  selectedPartState,
  selectedPoseKey,
  selectedState,
  onAccessoryColorVariantChange,
  onAccessoryLayerSlotChange,
  onApplyChibiBackMirror,
  onApplyHairSettingsToTargets,
  onChibiBackFollowingFrontChange,
  onClothingLayerOrderChange,
  onColorChange,
  onColorGradientModeChange,
  onColorGradientUpdate,
  onEstimateChibiPoseFromPortrait,
  onEyeLightPoseChange,
  onEyelidPoseChange,
  onFlipPart,
  onHairLightPoseChange,
  onLineColorChange,
  onLineColorGradientModeChange,
  onLineColorGradientUpdate,
  onMovePart,
  onOpenHairApplyPanel,
  onPartVisibleChange,
  onRemoveSelectedAccessory,
  onRotatePart,
  onScalePart,
  onSecondaryColorChange,
  onSecondaryColorGradientModeChange,
  onSecondaryColorGradientUpdate,
  onSelectAccessoryPose,
  onSelectOption,
  onSetAllHairApplyTargets,
  onSideVisibleChange,
  onStartHoldMove,
  onStopHoldMove,
  onToggleHairApplyTarget,
  onToggleSelectedSharedHairGradientSpace,
  onUpperEyelidPoseChange,
  onLightDistanceChange,
}: AvatarEditorOptionPanelProps) {
  const defaultColor = selectedAccessoryDefinition?.defaultColor ?? selectedPart?.defaultColor;
  const defaultLineColor = selectedAccessoryDefinition?.defaultLineColor ?? selectedPart?.defaultLineColor;

  const handlePortraitChibiPoseChange = (poseKey: PortraitChibiPoseKey) => {
    if (selectedAccessory) {
      onSelectAccessoryPose(poseKey);
      return;
    }

    if (isEyeLightPart) {
      onEyeLightPoseChange(poseKey);
      return;
    }

    if (isEyelidPart) {
      onEyelidPoseChange(poseKey);
      return;
    }

    onUpperEyelidPoseChange(poseKey);
  };

  return (
    <aside className={styles.optionMenu} aria-label="選擇選項與調整">
      <div className={styles.panelTitle}>選項</div>

      <div className={styles.optionList} role="radiogroup" aria-label={`${selectedLabel} options`}>
        {selectedOptions.map(option => (
          <button
            className={option.id === selectedOptionId ? styles.activeOptionButton : styles.optionButton}
            type="button"
            key={option.id}
            onClick={() => onSelectOption(option.id)}
            role="radio"
            aria-checked={option.id === selectedOptionId}
          >
            <span>{option.label}</span>
            <span className={styles.optionId}>{option.id}</span>
          </button>
        ))}
      </div>

      {(selectedAccessory || isUpperEyelidPart || isEyeLightPart || isEyelidPart) && (
        <div
          className={selectedAccessory ? styles.accessorySegmentedControl : styles.segmentedControl}
          role="tablist"
          aria-label={`${selectedLabel}位置模式`}
        >
          <button
            className={selectedPoseKey === 'portrait' ? styles.activeSegmentButton : styles.segmentButton}
            type="button"
            onClick={() => handlePortraitChibiPoseChange('portrait')}
            role="tab"
            aria-selected={selectedPoseKey === 'portrait'}
          >
            胸像
          </button>
          <button
            className={selectedPoseKey === 'chibi' ? styles.activeSegmentButton : styles.segmentButton}
            type="button"
            onClick={() => handlePortraitChibiPoseChange('chibi')}
            role="tab"
            aria-selected={selectedPoseKey === 'chibi'}
          >
            {selectedAccessory ? 'Q正面' : 'Q版'}
          </button>
          {selectedAccessory && (
            <>
              <button
                className={selectedAccessoryPoseKey === 'chibiBack'
                  ? styles.activeSegmentButton
                  : styles.segmentButton}
                type="button"
                onClick={() => onSelectAccessoryPose('chibiBack')}
                role="tab"
                aria-selected={selectedAccessoryPoseKey === 'chibiBack'}
              >
                Q背面
              </button>
              <button
                className={selectedAccessoryPoseKey === 'chibiSide'
                  ? styles.activeSegmentButton
                  : styles.segmentButton}
                type="button"
                onClick={() => onSelectAccessoryPose('chibiSide')}
                role="tab"
                aria-selected={selectedAccessoryPoseKey === 'chibiSide'}
              >
                Q側面
              </button>
            </>
          )}
        </div>
      )}

      {isHairLightPart && (
        <div
          className={styles.hairLightSegmentedControl}
          role="tablist"
          aria-label={`${selectedLabel}位置模式`}
        >
          {([
            ['portrait', '胸像'],
            ['front', 'Q正面'],
            ['back', 'Q背面'],
            ['side', 'Q側面'],
          ] as const).map(([poseKey, label]) => (
            <button
              className={selectedHairLightPoseKey === poseKey
                ? styles.activeSegmentButton
                : styles.segmentButton}
              type="button"
              key={poseKey}
              onClick={() => onHairLightPoseChange(poseKey)}
              role="tab"
              aria-selected={selectedHairLightPoseKey === poseKey}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {selectedEditableProperties.includes('color') && isSelectedOptionColorEditable && canUseColorGradient && (
        <>
          {selectedAccessory && selectedAccessoryColorVariants.length > 0 && (
            <div>
              <div className={styles.controlTitle}>color image</div>
              <div className={styles.optionList} role="radiogroup" aria-label="color image options">
                {selectedAccessoryColorVariants.map(variant => (
                  <button
                    className={variant.id === selectedAccessoryColorVariantId
                      ? styles.activeOptionButton
                      : styles.optionButton}
                    type="button"
                    key={variant.id}
                    onClick={() => onAccessoryColorVariantChange(variant.id)}
                    role="radio"
                    aria-checked={variant.id === selectedAccessoryColorVariantId}
                  >
                    <span>{variant.label}</span>
                    <span className={styles.optionId}>{variant.id}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <GradientColorControl
            title={selectedPart?.key === 'eyes.color' ? 'left color' : 'color'}
            color={selectedAppearanceState.color ?? defaultColor ?? '#000000'}
            gradient={selectedAppearanceState.colorGradient}
            onColorChange={onColorChange}
            onGradientModeChange={onColorGradientModeChange}
            onGradientUpdate={onColorGradientUpdate}
          />
          {isSelectedHairColorSource && (
            <button
              className={selectedAppearanceState.colorGradientSpace === 'sharedHair'
                ? styles.sharedGradientStatus
                : styles.joinSharedGradientButton}
              type="button"
              onClick={onToggleSelectedSharedHairGradientSpace}
            >
              {selectedAppearanceState.colorGradientSpace === 'sharedHair'
                ? '共用座標中'
                : '加入共用座標'}
            </button>
          )}
          {isSelectedHairColorSource && (
            <HairApplyButton
              kind="color"
              isActive={hairApplyPanel?.kind === 'color'}
              onClick={() => onOpenHairApplyPanel('color')}
            />
          )}
          {isSelectedHairColorSource && hairApplyPanel?.kind === 'color' && (
            <HairApplyPanel
              targets={hairApplyTargets}
              selectedTargetIds={hairApplyPanel.selectedTargetIds}
              onToggleTarget={onToggleHairApplyTarget}
              onToggleAll={onSetAllHairApplyTargets}
              onApply={() => onApplyHairSettingsToTargets()}
              onApplySharedHairGradient={selectedAppearanceState.colorGradient
                ? () => onApplyHairSettingsToTargets('sharedHair')
                : undefined}
            />
          )}
        </>
      )}

      {selectedEditableProperties.includes('color') && isSelectedOptionColorEditable && !canUseColorGradient && (
        <label className={styles.colorField}>
          <span>color</span>
          <input
            type="color"
            value={selectedAppearanceState.color ?? defaultColor ?? '#000000'}
            onChange={event => onColorChange(event.target.value)}
          />
        </label>
      )}

      {selectedPart?.key === 'eyes.color' && (
        <GradientColorControl
          title="right color"
          color={selectedPartState.secondaryColor ?? selectedPartState.color ?? selectedPart.defaultColor ?? '#000000'}
          gradient={selectedPartState.secondaryColorGradient}
          onColorChange={onSecondaryColorChange}
          onGradientModeChange={onSecondaryColorGradientModeChange}
          onGradientUpdate={onSecondaryColorGradientUpdate}
        />
      )}

      {isMiniClothingBottomPart && (
        <label className={styles.colorField}>
          <span>side deco</span>
          <input
            type="color"
            value={selectedPartState.secondaryColor ?? '#808080'}
            onChange={event => onSecondaryColorChange(event.target.value)}
          />
        </label>
      )}

      {selectedEditableProperties.includes('lineColor') && (
        <>
          <GradientColorControl
            title="line"
            color={selectedLineColorState.lineColor ?? defaultLineColor ?? '#262626'}
            gradient={selectedLineColorState.lineColorGradient}
            onColorChange={onLineColorChange}
            onGradientModeChange={onLineColorGradientModeChange}
            onGradientUpdate={onLineColorGradientUpdate}
          />
          {isSelectedHairColorSource && (
            <HairApplyButton
              kind="line"
              isActive={hairApplyPanel?.kind === 'line'}
              onClick={() => onOpenHairApplyPanel('line')}
            />
          )}
          {isSelectedHairColorSource && hairApplyPanel?.kind === 'line' && (
            <HairApplyPanel
              targets={hairApplyTargets}
              selectedTargetIds={hairApplyPanel.selectedTargetIds}
              onToggleTarget={onToggleHairApplyTarget}
              onToggleAll={onSetAllHairApplyTargets}
              onApply={() => onApplyHairSettingsToTargets()}
            />
          )}
        </>
      )}

      {selectedEditableProperties.includes('visibility') && (
        <label className={styles.toggleField}>
          <input
            type="checkbox"
            checked={selectedPartState.isVisible !== false}
            onChange={event => onPartVisibleChange(event.target.checked)}
          />
          <span>顯示</span>
        </label>
      )}

      {selectedEditableProperties.includes('layerOrder') && (
        <div className={styles.controlGroup}>
          <div className={styles.controlTitle}>layer</div>
          <div className={styles.actionRow}>
            <button type="button" onClick={() => onClothingLayerOrderChange(0)}>
              移到後
            </button>
            <button type="button" onClick={() => onClothingLayerOrderChange(1)}>
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
            onChange={event => onAccessoryLayerSlotChange(event.target.value as AccessoryLayerSlot)}
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

      {selectedAccessory && selectedAccessoryPoseKey === 'chibiBack' && (
        <div className={styles.controlGroup}>
          <label className={styles.toggleField}>
            <input
              type="checkbox"
              checked={selectedAccessory.isChibiBackFollowingFront}
              onChange={event => onChibiBackFollowingFrontChange(event.target.checked)}
            />
            <span>跟隨 Q正面鏡像</span>
          </label>
          <div className={styles.valueRow}>
            {selectedAccessory.isChibiBackFollowingFront
              ? '背面由 Q正面即時計算，目前不可調整'
              : '背面使用獨立設定'}
          </div>
          {!selectedAccessory.isChibiBackFollowingFront && (
            <button type="button" onClick={onApplyChibiBackMirror}>
              重新套用 Q正面鏡像
            </button>
          )}
        </div>
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
              onMove={onMovePart}
              onHoldStart={onStartHoldMove}
              onHoldStop={onStopHoldMove}
            />
            <NudgeButton
              label="左"
              ariaLabel="向左移動"
              disabled={!canMoveX}
              deltaX={-MOVE_STEP}
              deltaY={0}
              onMove={onMovePart}
              onHoldStart={onStartHoldMove}
              onHoldStop={onStopHoldMove}
            />
            <NudgeButton
              label="右"
              ariaLabel="向右移動"
              disabled={!canMoveX}
              deltaX={MOVE_STEP}
              deltaY={0}
              onMove={onMovePart}
              onHoldStart={onStartHoldMove}
              onHoldStop={onStopHoldMove}
            />
            <NudgeButton
              label="下"
              ariaLabel="向下移動"
              disabled={isMoveDownDisabled}
              deltaX={0}
              deltaY={MOVE_STEP}
              onMove={onMovePart}
              onHoldStart={onStartHoldMove}
              onHoldStop={onStopHoldMove}
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
            <button
              type="button"
              disabled={isAccessoryBackPoseFollowingFront}
              onClick={() => onRotatePart(-ROTATE_STEP)}
              aria-label="逆時針旋轉"
            >
              逆時針
            </button>
            <button
              type="button"
              disabled={isAccessoryBackPoseFollowingFront}
              onClick={() => onRotatePart(ROTATE_STEP)}
              aria-label="順時針旋轉"
            >
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
            <button
              type="button"
              disabled={isAccessoryBackPoseFollowingFront}
              onClick={() => onScalePart(-SCALE_STEP)}
              aria-label="縮小"
            >
              縮小
            </button>
            <button
              type="button"
              disabled={isAccessoryBackPoseFollowingFront}
              onClick={() => onScalePart(SCALE_STEP)}
              aria-label="放大"
            >
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
            <button
              type="button"
              disabled={isAccessoryBackPoseFollowingFront}
              onClick={onFlipPart}
              aria-label="左右翻轉"
            >
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
              disabled={isAccessoryBackPoseFollowingFront}
              onChange={event => onSideVisibleChange('left', event.target.checked)}
            />
            <span>左</span>
          </label>
          <label className={styles.toggleField}>
            <input
              type="checkbox"
              checked={selectedState.rightVisible !== false}
              disabled={isAccessoryBackPoseFollowingFront}
              onChange={event => onSideVisibleChange('right', event.target.checked)}
            />
            <span>右</span>
          </label>
        </div>
      )}

      {selectedPart?.key === 'eyes.light' && (
        <div className={styles.controlGroup}>
          <div className={styles.controlTitle}>distance</div>
          <div className={styles.actionRow}>
            <button type="button" onClick={() => onLightDistanceChange(-LIGHT_DISTANCE_STEP)} aria-label="縮短亮點距離">
              縮短
            </button>
            <button type="button" onClick={() => onLightDistanceChange(LIGHT_DISTANCE_STEP)} aria-label="拉開亮點距離">
              拉開
            </button>
          </div>
          <div className={styles.valueRow}>{selectedLightDistance}</div>
        </div>
      )}

      {selectedAccessory && (
        <div className={styles.controlGroup}>
          {(selectedAccessoryPoseKey === 'chibi' || selectedAccessoryPoseKey === 'chibiSide') && (
            <button
              type="button"
              onClick={onEstimateChibiPoseFromPortrait}
            >
              套用胸像比例位置
            </button>
          )}
          <div className={styles.actionRow}>
            <button type="button" onClick={onRemoveSelectedAccessory}>
              刪除配件
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
