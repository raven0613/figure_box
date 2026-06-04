import { type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './Modal.module.scss';

export interface ModalOptions {
  title?: ReactNode;
  content?: ReactNode;
  innerHtml?: string;
  hasConfirmButton?: boolean;
  hasConfirmCancelButtons?: boolean;
  closeOnBackdropClick?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface ModalProps {
  options?: ModalOptions;
  onClose?: () => void;
}

export function Modal({ options = {}, onClose }: ModalProps) {
  if (typeof document === 'undefined') {
    return null;
  }

  const shouldShowActions = options.hasConfirmButton === true || options.hasConfirmCancelButtons === true;
  const handleBackdropClick = () => {
    if (options.closeOnBackdropClick === true) {
      onClose?.();
    }
  };
  const handleDialogClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };
  const handleConfirm = () => {
    options.onConfirm?.();

    if (!options.onConfirm) {
      onClose?.();
    }
  };
  const handleCancel = () => {
    if (options.onCancel) {
      options.onCancel();
      return;
    }

    onClose?.();
  };

  return createPortal(
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={typeof options.title === 'string' ? options.title : 'Modal'}
        onClick={handleDialogClick}
      >
        {options.title !== undefined && (
          <div className={styles.header}>
            <h2>{options.title}</h2>
          </div>
        )}

        <div className={styles.content}>
          {renderModalContent(options)}
        </div>

        {shouldShowActions && (
          <div className={`${styles.actions} ${options.hasConfirmCancelButtons === true ? '' : styles.singleAction}`}>
            <button type="button" className={styles.confirmButton} onClick={handleConfirm}>
              {options.confirmLabel ?? '確認'}
            </button>
            {options.hasConfirmCancelButtons === true && (
              <button type="button" className={styles.cancelButton} onClick={handleCancel}>
                {options.cancelLabel ?? '取消'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function renderModalContent(options: ModalOptions): ReactNode {
  if (options.content !== undefined) {
    return typeof options.content === 'string'
      ? <p>{options.content}</p>
      : options.content;
  }

  if (options.innerHtml !== undefined) {
    return <div dangerouslySetInnerHTML={{ __html: options.innerHtml }} />;
  }

  return null;
}
