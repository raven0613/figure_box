import { useState } from 'react';
import { DraggablePanel } from '~/components/common/DraggablePanel';
import styles from './settingsPanel.module.scss';

type SettingsTab = 'general' | 'romanceRules';

interface SettingsPanelProps {
  onClose: () => void;
}

const PANEL_WIDTH_PX = 420;
const PANEL_TOP_PX = 76;
const PANEL_MARGIN_PX = 18;

const SETTINGS_TABS: readonly {
  id: SettingsTab;
  label: string;
}[] = [
  { id: 'general', label: '一般設定' },
  { id: 'romanceRules', label: '戀愛規則' },
];

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [initialPosition] = useState(() => getInitialPanelPosition());

  return (
    <DraggablePanel
      title="設定"
      initialPosition={initialPosition}
      closeAriaLabel="關閉設定"
      className={styles.panel}
      contentClassName={styles.content}
      onClose={onClose}
    >
      <div className={styles.tabs} role="tablist" aria-label="設定分類">
        {SETTINGS_TABS.map(tab => (
          <button
            key={tab.id}
            className={`${styles.tabButton} ${activeTab === tab.id ? styles.activeTabButton : ''}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section className={styles.tabPanel} role="tabpanel">
        {activeTab === 'general' ? (
          <p className={styles.emptyState}>尚無一般設定。</p>
        ) : (
          <p className={styles.emptyState}>尚未設定戀愛規則。</p>
        )}
      </section>
    </DraggablePanel>
  );
}

function getInitialPanelPosition() {
  if (typeof window === 'undefined') {
    return {
      left: PANEL_MARGIN_PX,
      top: PANEL_TOP_PX,
    };
  }

  return {
    left: Math.max(PANEL_MARGIN_PX, window.innerWidth - PANEL_WIDTH_PX - PANEL_MARGIN_PX),
    top: PANEL_TOP_PX,
  };
}
