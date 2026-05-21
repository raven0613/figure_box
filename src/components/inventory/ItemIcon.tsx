import type { ItemDefinition } from '~/typing/item';
import styles from './inventoryPanel.module.scss';

interface ItemIconProps {
  definition: ItemDefinition;
}

export function ItemIcon({ definition }: ItemIconProps) {
  if (definition.visual.assetId === 'item/toy_ball') {
    return (
      <svg className={styles.itemIconSvg} viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="10" fill="#f2d16b" stroke="#6d5a24" strokeWidth="1.6" />
        <ellipse cx="16" cy="16" rx="3" ry="10" fill="#ef7b45" transform="rotate(28 16 16)" />
        <circle cx="12" cy="12" r="2.1" fill="rgba(255,255,255,0.55)" />
      </svg>
    );
  }

  if (definition.visual.assetId === 'item/cards') {
    return (
      <svg className={styles.itemIconSvg} viewBox="0 0 32 32" aria-hidden="true">
        <rect x="14" y="7" width="11" height="17" rx="2" fill="#9cc7ef" stroke="#2f5f8a" strokeWidth="1.4" transform="rotate(10 19.5 15.5)" />
        <rect x="7" y="8" width="11" height="17" rx="2" fill="#fffaf0" stroke="#7f5f3e" strokeWidth="1.4" transform="rotate(-9 12.5 16.5)" />
        <text x="12" y="19" fill="#b64646" fontSize="8" fontWeight="700" textAnchor="middle">A</text>
      </svg>
    );
  }

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
