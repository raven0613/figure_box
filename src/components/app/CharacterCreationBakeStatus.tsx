import styles from '~/App.module.scss';

interface CharacterCreationBakeStatusState {
  characterName: string;
  label: string;
  completed: number;
  total: number;
  error: string | null;
}

interface CharacterCreationBakeStatusProps {
  state: CharacterCreationBakeStatusState | null;
  onDismiss: () => void;
}

export function CharacterCreationBakeStatus({
  state,
  onDismiss,
}: CharacterCreationBakeStatusProps) {
  if (!state) {
    return null;
  }

  return (
    <div className={styles.creationBakeStatus} role="status" aria-live="polite">
      <strong>{state.error ? '創建角色失敗' : '正在烘焙角色'}</strong>
      <span>{state.characterName}</span>
      <span>{state.error ?? state.label}</span>
      {!state.error && state.total > 0 ? (
        <span>{state.completed} / {state.total}</span>
      ) : null}
      {state.error ? (
        <button
          className={styles.creationBakeDismissButton}
          type="button"
          onClick={onDismiss}
        >
          關閉
        </button>
      ) : null}
    </div>
  );
}
