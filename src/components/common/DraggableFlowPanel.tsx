import type { CSSProperties, ReactNode } from 'react';
import { DraggablePanel } from './DraggablePanel';
import styles from './DraggableFlowPanel.module.scss';

interface DraggableFlowPanelProps {
  title: string;
  initialPosition: {
    left: number;
    top: number;
  };
  closeAriaLabel: string;
  children: ReactNode;
  canGoBack?: boolean;
  backAriaLabel?: string;
  className?: string;
  contentClassName?: string;
  style?: CSSProperties;
  onBack?: () => void;
  onClose: () => void;
}

export function DraggableFlowPanel({
  title,
  initialPosition,
  closeAriaLabel,
  children,
  canGoBack = false,
  backAriaLabel = '返回上一頁',
  className = '',
  contentClassName = '',
  style,
  onBack,
  onClose,
}: DraggableFlowPanelProps) {
  return (
    <DraggablePanel
      title={title}
      initialPosition={initialPosition}
      closeAriaLabel={closeAriaLabel}
      className={className}
      contentClassName={`${styles.content} ${contentClassName}`}
      style={style}
      onClose={onClose}
    >
      {canGoBack ? (
        <div className={styles.navigation}>
          <button
            className={styles.backButton}
            type="button"
            title={backAriaLabel}
            aria-label={backAriaLabel}
            onClick={onBack}
          >
            ←
          </button>
        </div>
      ) : null}
      {children}
    </DraggablePanel>
  );
}
