import { DraggablePanel } from '~/components/common/DraggablePanel';
import styles from './ApartmentPanel.module.scss';

export interface ApartmentResident {
  id: string;
  name: string;
  statusText: string;
  requests: readonly ApartmentResidentRequest[];
}

export interface ApartmentResidentRequest {
  id: string;
  label: string;
  level: 'critical' | 'social' | 'minor';
  levelLabel: string;
  status: string;
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

export function ApartmentPanel({
  title,
  residents,
  initialPosition,
  onClose,
  onLeaveApartment,
}: ApartmentPanelProps) {
  return (
    <DraggablePanel
      title={title}
      initialPosition={initialPosition}
      closeAriaLabel="關閉公寓面板"
      className={styles.panel}
      contentClassName={styles.content}
      onClose={onClose}
    >
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
              {resident.requests.length > 0 ? (
                <div className={styles.requestList}>
                  {resident.requests.map(request => (
                    <div className={styles.requestRow} key={request.id}>
                      <span className={styles[getRequestLevelClassName(request.level)]}>
                        {request.levelLabel}
                      </span>
                      <strong>{request.label}</strong>
                      <em>{request.status}</em>
                    </div>
                  ))}
                </div>
              ) : null}
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
    </DraggablePanel>
  );
}

function getRequestLevelClassName(level: ApartmentResidentRequest['level']): string {
  if (level === 'critical') {
    return 'requestLevelCritical';
  }

  if (level === 'social') {
    return 'requestLevelSocial';
  }

  return 'requestLevelMinor';
}
