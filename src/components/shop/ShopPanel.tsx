import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ItemDefinition, ShopStockItem } from '~/typing/item';
import styles from './shopPanel.module.scss';

interface ShopPanelProps {
  stockItems: readonly ShopStockItem[];
  getDefinition: (definitionId: string) => ItemDefinition | null;
  onPurchase: (stockItem: ShopStockItem) => void;
}

interface ShopItemView {
  stockItem: ShopStockItem;
  definition: ItemDefinition;
  name: string;
}

export function ShopPanel({
  stockItems,
  getDefinition,
  onPurchase,
}: ShopPanelProps) {
  const { t } = useTranslation();
  const itemViews = useMemo(
    () => stockItems
      .map(stockItem => {
        const definition = getDefinition(stockItem.definitionId);

        if (!definition) {
          return null;
        }

        return {
          stockItem,
          definition,
          name: String(t(definition.nameKey)),
        };
      })
      .filter((item): item is ShopItemView => item !== null)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [getDefinition, stockItems, t],
  );

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>今日商品</div>
          <div className={styles.subtitle}>金錢系統尚未接入</div>
        </div>
        <strong className={styles.count}>{itemViews.length}</strong>
      </div>

      <div className={styles.itemList}>
        {itemViews.map(item => (
          <div className={styles.itemRow} key={item.stockItem.id}>
            <div className={styles.itemIcon} aria-hidden="true">
              {item.definition.category.slice(0, 2).toUpperCase()}
            </div>
            <div className={styles.itemText}>
              <div className={styles.itemName}>{item.name}</div>
              <div className={styles.itemMeta}>
                {t(`item.rarity.${item.definition.rarity}`)} / {item.stockItem.price ?? item.definition.basePrice ?? 0}
              </div>
            </div>
            <strong className={styles.stock}>x{item.stockItem.stock}</strong>
            <button
              className={styles.buyButton}
              type="button"
              disabled={item.stockItem.stock <= 0}
              onClick={() => onPurchase(item.stockItem)}
            >
              購買
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
