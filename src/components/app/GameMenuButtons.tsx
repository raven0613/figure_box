import styles from '~/App.module.scss';

interface GameMenuButtonsProps {
  isCharacterMenuDisabled: boolean;
  onOpenCharacterPanel: () => void;
  onOpenSettings: () => void;
}

export function GameMenuButtons({
  isCharacterMenuDisabled,
  onOpenCharacterPanel,
  onOpenSettings,
}: GameMenuButtonsProps) {
  return (
    <>
      <button
        className={styles.characterMenuButton}
        type="button"
        disabled={isCharacterMenuDisabled}
        onClick={onOpenCharacterPanel}
      >
        角色
      </button>
      <button
        className={styles.menuButton}
        type="button"
        title="設定"
        aria-label="開啟設定"
        onClick={onOpenSettings}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>
    </>
  );
}
