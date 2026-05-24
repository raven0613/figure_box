import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getBrowserStorageStatus,
  requestPersistentStorage,
} from '~/services/save/browserStorageService';
import {
  getSaveDebugDatabaseSnapshot,
  type SaveDebugDatabaseSnapshot,
} from '~/services/save/saveDebugService';
import { relationshipStoreService } from '~/services/save/relationshipStoreService';
import { saveService } from '~/services/save/saveService';
import type {
  BrowserStorageStatus,
  SaveTableName,
  SaveTableSchemaSummary,
} from '~/services/save/saveTypes';
import { worldProgressService } from '~/services/save/worldProgressService';
import styles from './saveDebugPanel.module.scss';

interface SaveDebugPanelProps {
  onClose: () => void;
}

const REFRESH_ERROR_MESSAGE = '存檔資料讀取失敗。';

export function SaveDebugPanel({ onClose }: SaveDebugPanelProps) {
  const [snapshot, setSnapshot] = useState<SaveDebugDatabaseSnapshot | null>(null);
  const [storageStatus, setStorageStatus] = useState<BrowserStorageStatus | null>(null);
  const [selectedTable, setSelectedTable] = useState<SaveTableName>('saveMeta');
  const [isLoading, setIsLoading] = useState(false);
  const [isDebugMutationPending, setIsDebugMutationPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selectedTableSnapshot = useMemo(
    () => snapshot?.tables.find(table => table.table === selectedTable) ?? null,
    [selectedTable, snapshot],
  );
  const schemaByTable = useMemo(
    () => new Map(snapshot?.schemas.map(schema => [schema.name, schema]) ?? []),
    [snapshot],
  );
  const selectedSchema = schemaByTable.get(selectedTable) ?? null;

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const [nextSnapshot, nextStorageStatus] = await Promise.all([
        getSaveDebugDatabaseSnapshot(),
        getBrowserStorageStatus(),
      ]);

      setSnapshot(nextSnapshot);
      setStorageStatus(nextStorageStatus);
      setSelectedTable(currentTable => (
        nextSnapshot.tables.some(table => table.table === currentTable)
          ? currentTable
          : nextSnapshot.tables[0]?.table ?? 'saveMeta'
      ));
    } catch (error) {
      console.error(REFRESH_ERROR_MESSAGE, error);
      setMessage(REFRESH_ERROR_MESSAGE);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => window.clearTimeout(refreshTimer);
  }, [refresh]);

  const handleRequestPersistence = useCallback(async () => {
    const isPersisted = await requestPersistentStorage();

    setMessage(isPersisted ? '瀏覽器已允許保護本地存檔。' : '瀏覽器未允許保護本地存檔。');
    setStorageStatus(await getBrowserStorageStatus());
  }, []);

  const handleToggleWorldTestFlag = useCallback(async () => {
    setIsDebugMutationPending(true);

    try {
      const currentProgress = worldProgressService.getSnapshot();
      const nextValue = !currentProgress.flags['debug.manualTest'];

      worldProgressService.setFlag('debug.manualTest', nextValue);
      saveService.markDirty('worldProgress');
      await saveService.flushAutosave();
      await refresh();
      setMessage(`worldProgress debug.manualTest = ${String(nextValue)}`);
    } finally {
      setIsDebugMutationPending(false);
    }
  }, [refresh]);

  const handleToggleRelationshipTestPair = useCallback(async () => {
    setIsDebugMutationPending(true);

    try {
      const nextRelationshipStore = relationshipStoreService.toggleDebugRelationship();
      const relationship = nextRelationshipStore.mutualRelationships.find(item => (
        item.charIds[0] === 'friend-01' && item.charIds[1] === 'friend-02'
      ));

      saveService.markDirty('relationships');
      await saveService.flushAutosave();
      await refresh();
      setMessage(`friend-01/friend-02 relationship = ${relationship?.status ?? 'none'}`);
    } finally {
      setIsDebugMutationPending(false);
    }
  }, [refresh]);

  const handleReset = useCallback(async () => {
    const shouldReset = window.confirm('確定要刪除 IndexedDB 存檔並重新載入嗎？');

    if (!shouldReset) {
      return;
    }

    await saveService.resetGameSave();
    window.location.reload();
  }, []);

  return (
    <aside className={styles.panel} aria-label="Save debug panel">
      <header className={styles.header}>
        <div>
          <div className={styles.kicker}>IndexedDB</div>
          <h2 className={styles.title}>Save Debug</h2>
        </div>
        <button className={styles.iconButton} type="button" onClick={onClose} aria-label="關閉存檔除錯面板">
          x
        </button>
      </header>

      <p className={styles.warning}>
        本遊戲資料儲存在此瀏覽器本機。清除網站資料、隱私模式、裝置空間不足或瀏覽器策略都可能導致存檔遺失，請定期備份。
      </p>

      <section className={styles.storageSection} aria-label="Browser storage status">
        <StatusRow label="Usage" value={formatStorageUsage(storageStatus)} />
        <StatusRow label="Persistent" value={formatPersistence(storageStatus)} />
        <div className={styles.actionRow}>
          <button className={styles.secondaryButton} type="button" onClick={refresh} disabled={isLoading}>
            {isLoading ? 'Refreshing' : 'Refresh'}
          </button>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={handleRequestPersistence}
            disabled={!storageStatus?.isPersistenceSupported}
          >
            保護本地存檔
          </button>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={handleToggleWorldTestFlag}
            disabled={isDebugMutationPending}
          >
            Toggle World Flag
          </button>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={handleToggleRelationshipTestPair}
            disabled={isDebugMutationPending}
          >
            Toggle Relationship
          </button>
          <button className={styles.dangerButton} type="button" onClick={handleReset}>
            Reset DB
          </button>
        </div>
        {message ? <div className={styles.message}>{message}</div> : null}
      </section>

      <div className={styles.contentGrid}>
        <nav className={styles.tableList} aria-label="Save tables">
          {snapshot?.tables.map(table => (
            <button
              key={table.table}
              className={table.table === selectedTable ? styles.activeTableButton : styles.tableButton}
              type="button"
              onClick={() => setSelectedTable(table.table)}
            >
              <span>{table.table}</span>
              <strong>{table.count}</strong>
            </button>
          ))}
        </nav>

        <section className={styles.tableDetail} aria-label={`${selectedTable} debug data`}>
          <TableSchema schema={selectedSchema} />
          {selectedTableSnapshot ? (
            <>
              <div className={styles.detectedFields}>
                <strong>Fields</strong>
                <span>{selectedTableSnapshot.detectedFields.join(', ') || '-'}</span>
              </div>
              <pre className={styles.jsonPreview}>
                {JSON.stringify(selectedTableSnapshot.rows, null, 2)}
              </pre>
            </>
          ) : (
            <div className={styles.emptyState}>No table selected.</div>
          )}
        </section>
      </div>
    </aside>
  );
}

function TableSchema({ schema }: { schema: SaveTableSchemaSummary | null }) {
  if (!schema) {
    return null;
  }

  return (
    <div className={styles.schemaBlock}>
      <StatusRow label="Primary key" value={schema.primaryKey} />
      <StatusRow label="Indexes" value={schema.indexes.join(', ') || '-'} />
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.statusRow}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatStorageUsage(status: BrowserStorageStatus | null): string {
  if (!status || status.usage === null || status.quota === null) {
    return 'unknown';
  }

  return `${formatBytes(status.usage)} / ${formatBytes(status.quota)}`;
}

function formatPersistence(status: BrowserStorageStatus | null): string {
  if (!status || status.isPersisted === null) {
    return 'unknown';
  }

  return status.isPersisted ? 'yes' : 'no';
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
