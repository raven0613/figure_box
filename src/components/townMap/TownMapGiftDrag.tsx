import type { CharacterSeed } from '~/services/townCharacterTypes';

import styles from './townMap.module.scss';

interface GiftDragPreviewProps {
  badgeLabel: string;
  candidateCount: number;
  pointer: {
    x: number;
    y: number;
  };
}

export function GiftDragPreview({
  badgeLabel,
  candidateCount,
  pointer,
}: GiftDragPreviewProps) {
  return (
    <div
      className={styles.giftDragPreview}
      style={{
        transform: `translate(${pointer.x + 12}px, ${pointer.y + 12}px)`,
      }}
    >
      <strong>{badgeLabel}</strong>
      <span>{candidateCount > 0 ? `${candidateCount} target` : 'drag to character'}</span>
    </div>
  );
}

interface GiftTargetPickerViewState {
  candidateCharacterIds: readonly string[];
  pointer: {
    x: number;
    y: number;
  };
}

interface GiftTargetPickerProps {
  state: GiftTargetPickerViewState;
  characters: readonly CharacterSeed[];
  onSelectTarget: (characterId: string) => void;
  onCancel: () => void;
}

export function GiftTargetPicker({
  state,
  characters,
  onSelectTarget,
  onCancel,
}: GiftTargetPickerProps) {
  return (
    <div
      className={styles.giftTargetPicker}
      style={{
        left: state.pointer.x,
        top: state.pointer.y,
      }}
    >
      <div className={styles.giftTargetPickerTitle}>選擇要送給誰</div>
      {state.candidateCharacterIds.map(characterId => (
        <button
          className={styles.giftTargetButton}
          key={characterId}
          type="button"
          onClick={() => onSelectTarget(characterId)}
        >
          {characters.find(character => character.id === characterId)?.name ?? characterId}
        </button>
      ))}
      <button
        className={styles.giftTargetCancelButton}
        type="button"
        onClick={onCancel}
      >
        取消
      </button>
    </div>
  );
}
