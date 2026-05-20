import type { ItemDefinition } from '~/typing/item';
import styles from './inventoryPanel.module.scss';

interface ItemIconProps {
  definition: ItemDefinition;
}

export function ItemIcon({ definition }: ItemIconProps) {
  if (definition.visual.assetId === 'item/apple') {
    return (
      <svg className={styles.itemIconSvg} viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="18" r="9" fill="#d84c43" stroke="#7c2727" strokeWidth="1.6" />
        <ellipse cx="13" cy="15" rx="2.1" ry="3.4" fill="rgba(255,255,255,0.42)" transform="rotate(28 13 15)" />
        <ellipse cx="20" cy="8" rx="4" ry="2" fill="#4d9b55" stroke="#286133" strokeWidth="1.1" transform="rotate(-28 20 8)" />
      </svg>
    );
  }

  if (definition.visual.assetId === 'item/clear_gem') {
    return (
      <svg className={styles.itemIconSvg} viewBox="0 0 32 32" aria-hidden="true">
        <polygon points="16,4 27,13 22,28 10,28 5,13" fill="#7ed9ff" stroke="#287ca0" strokeWidth="1.6" />
        <polygon points="14,8 18,13 14,19 10,13" fill="rgba(255,255,255,0.55)" />
      </svg>
    );
  }

  if (definition.visual.assetId === 'item/silver_bracelet') {
    return (
      <svg className={styles.itemIconSvg} viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="9" fill="none" stroke="#c8d0d7" strokeWidth="5" />
        <circle cx="21" cy="10" r="2.3" fill="#ffffff" stroke="#9aa6b2" strokeWidth="1" />
      </svg>
    );
  }

  return (
    <span className={styles.itemIconFallback} aria-hidden="true">
      {definition.category.slice(0, 2).toUpperCase()}
    </span>
  );
}
