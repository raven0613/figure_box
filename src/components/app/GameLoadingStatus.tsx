import styles from '~/App.module.scss';

interface GameLoadingState {
  label: string;
  completed: number;
  total: number;
}

interface GameLoadingStatusProps {
  isGameLoading: boolean;
  loadingState: GameLoadingState;
  saveInitializationError: string | null;
}

export function GameLoadingStatus({
  isGameLoading,
  loadingState,
  saveInitializationError,
}: GameLoadingStatusProps) {
  if (saveInitializationError) {
    return (
      <div className={styles.saveStatus}>{saveInitializationError}</div>
    );
  }

  if (!isGameLoading) {
    return null;
  }

  return (
    <div className={styles.saveStatus}>
      <strong>Game loading</strong>
      <span>{loadingState.label}</span>
      {loadingState.total > 0 ? (
        <span>{loadingState.completed} / {loadingState.total}</span>
      ) : null}
    </div>
  );
}
