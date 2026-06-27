import styles from '~/App.module.scss';

interface GameDebugControlsProps {
  isGameActive: boolean;
  isActivityObservationPaused: boolean;
  isWorldManuallyPaused: boolean;
  onToggleManualWorldPause: () => void;
  onShowTestDialogue: () => void;
  onShowMapFadeDemo: () => void;
  onShowMapBounceDemo: () => void;
  onToggleSaveDebug: () => void;
  onToggleOfflineRecapDebug: () => void;
}

export function GameDebugControls({
  isGameActive,
  isActivityObservationPaused,
  isWorldManuallyPaused,
  onToggleManualWorldPause,
  onShowTestDialogue,
  onShowMapFadeDemo,
  onShowMapBounceDemo,
  onToggleSaveDebug,
  onToggleOfflineRecapDebug,
}: GameDebugControlsProps) {
  return (
    <div className={styles.demoControls}>
      <button
        className={`${styles.demoButton} ${isWorldManuallyPaused ? styles.demoButtonActive : ''}`}
        type="button"
        disabled={!isGameActive || isActivityObservationPaused}
        aria-pressed={isWorldManuallyPaused}
        onClick={onToggleManualWorldPause}
      >
        {isWorldManuallyPaused ? 'Resume World' : 'Pause World'}
      </button>
      <button
        className={styles.demoButton}
        type="button"
        onClick={onShowTestDialogue}
      >
        Test Dialogue
      </button>
      <button
        className={styles.demoButton}
        type="button"
        onClick={onShowMapFadeDemo}
      >
        Map Fade
      </button>
      <button
        className={styles.demoButton}
        type="button"
        onClick={onShowMapBounceDemo}
      >
        Map Bounce
      </button>
      <button
        className={styles.demoButton}
        type="button"
        onClick={onToggleSaveDebug}
      >
        Save DB
      </button>
      <button
        className={styles.demoButton}
        type="button"
        onClick={onToggleOfflineRecapDebug}
      >
        Offline Recap
      </button>
    </div>
  );
}
