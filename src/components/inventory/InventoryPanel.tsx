import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { InventoryGroup } from '~/services/items/itemService';
import type {
  ItemDefinition,
  ItemInstance,
} from '~/typing/item';
import styles from './inventoryPanel.module.scss';

interface InventoryPanelProps {
  groups: readonly InventoryGroup[];
  getDefinition: (definitionId: string) => ItemDefinition | null;
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
          <div className={styles.subtitle}>{t('inventory.owner.player')}</div>
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
              <div className={styles.itemRow} key={item.instance.id}>
                <div className={styles.itemIcon} aria-hidden="true">
                  {getIconLabel(item.definition)}
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
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
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

function getIconLabel(definition: ItemDefinition): string {
  return definition.category.slice(0, 2).toUpperCase();
}
