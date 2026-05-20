import { useMemo, type PointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { InventoryGroup } from '~/services/items/itemService';
import type {
  ItemDefinition,
  ItemInstance,
} from '~/typing/item';
import { ItemIcon } from './ItemIcon';
import styles from './inventoryPanel.module.scss';

interface InventoryPanelProps {
  groups: readonly InventoryGroup[];
  getDefinition: (definitionId: string) => ItemDefinition | null;
  ownerLabel?: string;
  giftTargetName?: string;
  onGiftItem?: (itemInstance: ItemInstance) => void;
  onOpenTransferHistory?: (itemInstance: ItemInstance) => void;
  onStartDragItem?: (itemInstance: ItemInstance, pointer: { x: number; y: number }) => void;
}

interface InventoryItemView {
  instance: ItemInstance;
  definition: ItemDefinition;
  name: string;
}

const RARITY_ORDER: Record<string, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  special: 5,
};

export function InventoryPanel({
  groups,
  getDefinition,
  ownerLabel,
  giftTargetName,
  onGiftItem,
  onOpenTransferHistory,
  onStartDragItem,
}: InventoryPanelProps) {
  const { t } = useTranslation();
  const visibleGroups = useMemo(
    () => groups
      .map(group => ({
        ...group,
        items: getSortedItemViews(group.itemInstances, getDefinition, key => String(t(key))),
      }))
      .filter(group => group.items.length > 0),
    [getDefinition, groups, t],
  );
  const itemCount = visibleGroups.reduce((total, group) => total + group.items.length, 0);

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>{t('inventory.title')}</div>
          <div className={styles.subtitle}>{ownerLabel ?? t('inventory.owner.player')}</div>
        </div>
        <strong className={styles.count}>{itemCount}</strong>
      </div>

      {visibleGroups.length === 0 ? (
        <div className={styles.empty}>{t('inventory.empty')}</div>
      ) : visibleGroups.map(group => (
        <div className={styles.group} key={group.id}>
          <div className={styles.groupTitle}>{t(group.labelKey)}</div>
          <div className={styles.itemList}>
            {group.items.map(item => (
              <div
                className={`${styles.itemRow} ${onStartDragItem ? styles.itemRowDraggable : ''}`}
                key={item.instance.id}
                onPointerDown={event => {
                  if (!onStartDragItem || isInteractivePointerTarget(event)) {
                    return;
                  }

                  onStartDragItem(item.instance, {
                    x: event.clientX,
                    y: event.clientY,
                  });
                }}
              >
                <div className={styles.itemIcon} aria-hidden="true">
                  <ItemIcon definition={item.definition} />
                </div>
                <div className={styles.itemText}>
                  <div className={styles.itemName}>{item.name}</div>
                  <div className={styles.itemMeta}>
                    {t(`item.rarity.${item.definition.rarity}`)}
                  </div>
                </div>
                <strong className={styles.quantity}>
                  {item.instance.quantity > 1 ? `x${item.instance.quantity}` : ''}
                </strong>
                <div className={styles.itemActions}>
                  {onGiftItem ? (
                    <button
                      className={styles.itemActionButton}
                      type="button"
                      onClick={() => onGiftItem(item.instance)}
                    >
                      {giftTargetName ? `送給${giftTargetName}` : '送出'}
                    </button>
                  ) : null}
                  {onOpenTransferHistory ? (
                    <button
                      className={styles.itemActionButton}
                      type="button"
                      onClick={() => onOpenTransferHistory(item.instance)}
                    >
                      履歷
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function isInteractivePointerTarget(event: PointerEvent<HTMLElement>): boolean {
  return event.target instanceof HTMLElement && Boolean(event.target.closest('button'));
}

function getSortedItemViews(
  itemInstances: readonly ItemInstance[],
  getDefinition: (definitionId: string) => ItemDefinition | null,
  translate: (key: string) => string,
): readonly InventoryItemView[] {
  return itemInstances
    .map(instance => {
      const definition = getDefinition(instance.definitionId);

      if (!definition) {
        return null;
      }

      return {
        instance,
        definition,
        name: translate(definition.nameKey),
      };
    })
    .filter((item): item is InventoryItemView => item !== null)
    .sort((a, b) => (
      getRarityOrder(a.definition.rarity) - getRarityOrder(b.definition.rarity) ||
      a.name.localeCompare(b.name) ||
      a.instance.id.localeCompare(b.instance.id)
    ));
}

function getRarityOrder(rarity: string): number {
  return RARITY_ORDER[rarity] ?? RARITY_ORDER.common;
}
