import { useTranslation } from 'react-i18next';

import type { ItemInstance, PlacedObject } from '~/typing/item';

import styles from './townMap.module.scss';

interface PlacedItemActionPanelProps {
  itemName: string;
  itemInstance: ItemInstance;
  placedObject: PlacedObject;
  onPickup: () => void;
  onStartPickupChain: () => void;
}

export function PlacedItemActionPanel({
  itemName,
  itemInstance,
  placedObject,
  onPickup,
  onStartPickupChain,
}: PlacedItemActionPanelProps) {
  return (
    <div className={styles.placedItemActionPanel}>
      <div className={styles.detailRow}>
        <span>Item</span>
        <strong>{itemName}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>State</span>
        <strong>{itemInstance.state}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Tile</span>
        <strong>
          {placedObject.worldPosition
            ? `${placedObject.worldPosition.x}, ${placedObject.worldPosition.y}`
            : '-'}
        </strong>
      </div>
      <div className={styles.placedItemActions}>
        <button
          className={styles.placedItemActionButton}
          type="button"
          onClick={onPickup}
        >
          撿起
        </button>
        <button
          className={styles.placedItemActionButton}
          type="button"
          onClick={onStartPickupChain}
        >
          連續撿
        </button>
      </div>
    </div>
  );
}

interface TransferHistoryPanelProps {
  itemInstance: ItemInstance;
  itemName: string;
}

export function TransferHistoryPanel({
  itemInstance,
  itemName,
}: TransferHistoryPanelProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.transferHistoryPanel}>
      <div className={styles.detailRow}>
        <span>Item</span>
        <strong>{t(itemName)}</strong>
      </div>
      {(itemInstance.transferHistory?.length ?? 0) === 0 ? (
        <div className={styles.emptyPanelText}>沒有轉移履歷</div>
      ) : (
        <div className={styles.transferHistoryList}>
          {itemInstance.transferHistory?.map((entry, index) => (
            <div className={styles.transferHistoryRow} key={`${entry.reason}-${entry.day}-${index}`}>
              <div className={styles.detailRow}>
                <span>Day</span>
                <strong>{entry.timeOfDay ? `${entry.day} ${entry.timeOfDay}` : entry.day}</strong>
              </div>
              <div className={styles.detailRow}>
                <span>Reason</span>
                <strong>{entry.reason}</strong>
              </div>
              <div className={styles.detailRow}>
                <span>From</span>
                <strong>{entry.fromActorId ?? '-'}</strong>
              </div>
              <div className={styles.detailRow}>
                <span>To</span>
                <strong>{entry.toActorId ?? '-'}</strong>
              </div>
              <div className={styles.detailRow}>
                <span>Qty</span>
                <strong>{entry.quantity}</strong>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
