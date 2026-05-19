import { useState, type MouseEvent, type PointerEvent } from 'react';
import styles from './ApartmentPanel.module.scss';

export interface ApartmentResident {
  id: string;
  name: string;
  statusText: string;
}

interface ApartmentPanelProps {
  title: string;
  residents: readonly ApartmentResident[];
  initialPosition: {
    left: number;
    top: number;
  };
  onClose: () => void;
  onLeaveApartment: (characterId: string) => void;
}

interface DragState {
  pointerId: number;
  offsetX: number;
  offsetY: number;
}

export function ApartmentPanel({
  title,
  residents,
  initialPosition,
  onClose,
  onLeaveApartment,
}: ApartmentPanelProps) {
  const [position, setPosition] = useState(initialPosition);
  const [dragState, setDragState] = useState<DragState | null>(null);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLElement && event.target.closest('button')) {
      return;
    }

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
      className={styles.panel}
      style={{
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
          aria-label="關閉公寓面板"
        >
          ×
        </button>
      </div>

      <div className={styles.content}>
        <div className={styles.sectionTitle}>在家角色</div>
        {residents.length === 0 ? (
          <div className={styles.empty}>目前無人在家</div>
        ) : (
          <div className={styles.residentList}>
            {residents.map(resident => (
              <div className={styles.residentRow} key={resident.id}>
                <div className={styles.residentText}>
                  <span>{resident.name}</span>
                  <strong>{resident.statusText}</strong>
                </div>
                <button
                  className={styles.leaveButton}
                  type="button"
                  onClick={() => onLeaveApartment(resident.id)}
                >
                  出門
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
