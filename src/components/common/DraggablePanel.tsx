import {
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import styles from './DraggablePanel.module.scss';

interface DraggablePanelProps {
  title: string;
  initialPosition: {
    left: number;
    top: number;
  };
  closeAriaLabel: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  style?: CSSProperties;
  onClose: () => void;
}

interface DragState {
  pointerId: number;
  offsetX: number;
  offsetY: number;
}

export function DraggablePanel({
  title,
  initialPosition,
  closeAriaLabel,
  children,
  className = '',
  contentClassName = '',
  style,
  onClose,
}: DraggablePanelProps) {
  const [position, setPosition] = useState(initialPosition);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({
      pointerId: event.pointerId,
      offsetX: event.clientX - position.left,
      offsetY: event.clientY - position.top,
    });
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragState || event.pointerId !== dragState.pointerId) {
      return;
    }

    setPosition({
      left: event.clientX - dragState.offsetX,
      top: event.clientY - dragState.offsetY,
    });
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (dragState && event.pointerId === dragState.pointerId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      setDragState(null);
    }
  };

  const handleClosePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation();
  };

  const handleCloseClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onClose();
  };

  return (
    <aside
      className={`${styles.panel} ${className}`}
      style={{
        ...style,
        transform: `translate(${position.left}px, ${position.top}px)`,
      }}
    >
      <div
        className={styles.header}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <h2>{title}</h2>
        <button
          className={styles.closeButton}
          type="button"
          onPointerDown={handleClosePointerDown}
          onClick={handleCloseClick}
          aria-label={closeAriaLabel}
        >
          ×
        </button>
      </div>

      <div className={`${styles.content} ${contentClassName}`}>
        {children}
      </div>
    </aside>
  );
}
