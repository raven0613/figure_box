import { useEffect, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import styles from './Toast.module.scss';

export type ToastTone = 'info' | 'warning' | 'error';

interface ToastProps {
  message: string;
  tone?: ToastTone;
  durationMs?: number;
  onDismiss: () => void;
}

const DEFAULT_TOAST_DURATION_MS = 2400;

export function Toast({
  message,
  tone = 'info',
  durationMs = DEFAULT_TOAST_DURATION_MS,
  onDismiss,
}: ToastProps) {
  useEffect(() => {
    const timeoutId = window.setTimeout(onDismiss, durationMs);

    return () => window.clearTimeout(timeoutId);
  }, [durationMs, onDismiss]);

  if (typeof document === 'undefined') {
    return null;
  }

  const style = {
    '--toast-duration': `${durationMs}ms`,
  } as CSSProperties;

  return createPortal(
    <div className={styles.viewport} aria-live="polite" aria-atomic="true">
      <div
        className={`${styles.toast} ${styles[tone]}`}
        role="status"
        style={style}
      >
        {message}
      </div>
    </div>,
    document.body,
  );
}
