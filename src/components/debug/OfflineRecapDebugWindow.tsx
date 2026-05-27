import { useCallback, useEffect, useMemo, useState } from 'react';

import { DraggablePanel } from '~/components/common/DraggablePanel';
import { applyOfflineSimulationDryRun } from '~/services/offlineSimulation/offlineSimulationApplyService';
import { createOfflineSimulationDryRun } from '~/services/offlineSimulation/offlineCandidateDryRunService';
import { offlineRuntimeSyncService } from '~/services/offlineSimulation/offlineRuntimeSyncService';
import type {
  OfflineRecapListItemPreview,
  OfflineSimulationDryRun,
} from '~/services/offlineSimulation/types';
import { offlineRecapSaveService } from '~/services/save/offlineRecapSaveService';
import { saveService } from '~/services/save/saveService';
import type { OfflineRecapSaveRecord } from '~/services/save/saveTypes';
import styles from './offlineRecapDebugWindow.module.scss';

interface OfflineRecapDebugWindowProps {
  onClose: () => void;
}

type SavedRecapViewMode = 'latest' | 'all';

export function OfflineRecapDebugWindow({ onClose }: OfflineRecapDebugWindowProps) {
  const [dryRun, setDryRun] = useState<OfflineSimulationDryRun | null>(null);
  const [savedRecaps, setSavedRecaps] = useState<readonly OfflineRecapSaveRecord[]>([]);
  const [savedViewMode, setSavedViewMode] = useState<SavedRecapViewMode>('latest');
  const [autoSaveMessage, setAutoSaveMessage] = useState<string | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  const refreshSavedRecaps = useCallback(() => {
    setSavedRecaps(offlineRecapSaveService.getRecords().slice().reverse());
  }, []);
  const regeneratePreview = useCallback(async () => {
    const nextDryRun = createOfflineSimulationDryRun();

    setDryRun(nextDryRun);

    if (nextDryRun.aggregatePreview.recapListPreview.length === 0) {
      setAutoSaveMessage('preview 沒有可保存的回顧文字。');
      return;
    }

    setIsAutoSaving(true);

    try {
      const result = await applyOfflineSimulationDryRun(nextDryRun);

      if (!result.success) {
        refreshSavedRecaps();
        setAutoSaveMessage(`auto save skipped: ${result.reason}`);
        return;
      }

      await saveService.saveOfflineSimulationNow(result.appliedAt);
      const syncedCharacterCount = offlineRuntimeSyncService.applyRuntimeSnapshots(
        result.appliedRuntimeSnapshots,
      );

      refreshSavedRecaps();
      setAutoSaveMessage(`auto saved: characters=${String(result.appliedCharacterCount)}, synced=${String(syncedCharacterCount)}, recaps=${String(result.recapCount)}`);
    } catch (error) {
      console.error('Offline recap auto save failed.', error);
      setAutoSaveMessage(getErrorMessage(error));
    } finally {
      setIsAutoSaving(false);
    }
  }, [refreshSavedRecaps]);

  useEffect(() => {
    void regeneratePreview();
    refreshSavedRecaps();
  }, [regeneratePreview, refreshSavedRecaps]);

  const previewEventsByKey = useMemo(() => {
    const events = dryRun?.simulationPreview.events ?? [];

    return new Map(events.map(event => [
      createPreviewKey(event.eventId, event.characterId, event.timestamp),
      event,
    ]));
  }, [dryRun]);
  const suppressedCountByReason = useMemo(() => {
    const counts = new Map<string, number>();

    dryRun?.simulationPreview.suppressed.forEach(event => {
      counts.set(event.reason, (counts.get(event.reason) ?? 0) + 1);
    });

    return Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1]);
  }, [dryRun]);
  const latestSimulationSeed = useMemo(
    () => getLatestSimulationSeed(savedRecaps),
    [savedRecaps],
  );
  const visibleSavedRecaps = useMemo(() => (
    savedViewMode === 'latest' && latestSimulationSeed
      ? savedRecaps.filter(record => record.simulationSeed === latestSimulationSeed)
      : savedRecaps
  ), [latestSimulationSeed, savedRecaps, savedViewMode]);

  return (
    <DraggablePanel
      title="Offline Recap"
      initialPosition={{ left: 18, top: 68 }}
      closeAriaLabel="關閉離線回顧視窗"
      className={styles.window}
      contentClassName={styles.content}
      onClose={onClose}
    >
      <div className={styles.toolbar}>
        <button
          className={styles.button}
          type="button"
          onClick={() => void regeneratePreview()}
          disabled={isAutoSaving}
        >
          {isAutoSaving ? 'Saving Preview' : 'Run Preview'}
        </button>
        <button className={styles.button} type="button" onClick={refreshSavedRecaps}>
          Refresh Saved
        </button>
      </div>
      {autoSaveMessage ? <div className={styles.message}>{autoSaveMessage}</div> : null}

      <section className={styles.section} aria-label="Offline recap preview">
        <div className={styles.sectionHeader}>
          <div>
            <h3>Preview</h3>
            <p>
              policy v{dryRun?.policyVersion ?? '-'} · elapsed={formatDuration(dryRun?.elapsedMs ?? null)}
            </p>
          </div>
          <strong>{dryRun?.aggregatePreview.recapListPreview.length ?? 0}</strong>
        </div>

        {dryRun && dryRun.aggregatePreview.recapListPreview.length > 0 ? (
          <div className={styles.recapList}>
            {dryRun.aggregatePreview.recapListPreview.map((recap, index) => (
              <PreviewRecapItem
                event={previewEventsByKey.get(createPreviewKey(
                  recap.eventId,
                  recap.characterId,
                  recap.timestamp,
                ))}
                index={index}
                key={`${recap.eventId}-${recap.characterId}-${recap.timestamp}-${String(index)}`}
                recap={recap}
              />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>目前 preview 沒有離線回顧文字。</div>
        )}

        {suppressedCountByReason.length > 0 ? (
          <div className={styles.suppressedBlock}>
            <strong>Suppressed</strong>
            <div className={styles.reasonList}>
              {suppressedCountByReason.map(([reason, count]) => (
                <span key={reason}>{reason}: {count}</span>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className={styles.section} aria-label="Saved offline recaps">
        <div className={styles.sectionHeader}>
          <div>
            <h3>Saved</h3>
            <p>
              {savedViewMode === 'latest' && latestSimulationSeed
                ? `Latest seed: ${latestSimulationSeed}`
                : '全部已 Apply 後寫入 offlineRecaps 的紀錄'}
            </p>
          </div>
          <strong>{visibleSavedRecaps.length} / {savedRecaps.length}</strong>
        </div>

        <div className={styles.segmentedControl} aria-label="Saved recap filter">
          <button
            className={savedViewMode === 'latest' ? styles.segmentedButtonActive : styles.segmentedButton}
            type="button"
            onClick={() => setSavedViewMode('latest')}
            disabled={!latestSimulationSeed}
          >
            Latest Seed
          </button>
          <button
            className={savedViewMode === 'all' ? styles.segmentedButtonActive : styles.segmentedButton}
            type="button"
            onClick={() => setSavedViewMode('all')}
          >
            All
          </button>
        </div>

        {visibleSavedRecaps.length > 0 ? (
          <div className={styles.recapList}>
            {visibleSavedRecaps.map(record => (
              <SavedRecapItem key={record.id} record={record} />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>目前沒有已保存的離線回顧。</div>
        )}
      </section>
    </DraggablePanel>
  );
}

function PreviewRecapItem({
  event,
  index,
  recap,
}: {
  event: OfflineSimulationDryRun['simulationPreview']['events'][number] | undefined;
  index: number;
  recap: OfflineRecapListItemPreview;
}) {
  const resolverSource = event?.resolutionPreview.kind === 'solo'
    ? event.resolutionPreview.resolverSource
    : event?.resolutionPreview.reason ?? '-';

  return (
    <article className={styles.recapItem}>
      <div className={styles.recapMeta}>
        <span>#{index + 1}</span>
        <span>{recap.characterName}</span>
        <span>{formatClock(recap.timestamp)}</span>
      </div>
      <p className={styles.summary}>{recap.summary}</p>
      {recap.detail ? <p className={styles.detail}>{recap.detail}</p> : null}
      {recap.quote ? <blockquote className={styles.quote}>{recap.quote}</blockquote> : null}
      <div className={styles.debugMeta}>
        <span>{recap.eventId}</span>
        <span>{event?.activityType ?? event?.eventType ?? '-'}</span>
        <span>{resolverSource}</span>
      </div>
    </article>
  );
}

function SavedRecapItem({ record }: { record: OfflineRecapSaveRecord }) {
  return (
    <article className={styles.recapItem}>
      <div className={styles.recapMeta}>
        <span>{record.characterName}</span>
        <span>{formatClock(record.timestamp)}</span>
        <span>{record.isRead ? 'read' : 'unread'}</span>
      </div>
      <p className={styles.summary}>{record.summary}</p>
      {record.detail ? <p className={styles.detail}>{record.detail}</p> : null}
      {record.quote ? <blockquote className={styles.quote}>{record.quote}</blockquote> : null}
      <div className={styles.debugMeta}>
        <span>{record.eventId}</span>
        <span>{record.simulationSeed}</span>
      </div>
    </article>
  );
}

function createPreviewKey(eventId: string, characterId: string, timestamp: number): string {
  return `${eventId}:${characterId}:${String(timestamp)}`;
}

function getLatestSimulationSeed(
  records: readonly OfflineRecapSaveRecord[],
): string | null {
  const latestRecord = records.reduce<OfflineRecapSaveRecord | null>((latest, record) => {
    if (!latest) {
      return record;
    }

    return getSaveRecordSortTimestamp(record) > getSaveRecordSortTimestamp(latest)
      ? record
      : latest;
  }, null);

  return latestRecord?.simulationSeed ?? null;
}

function getSaveRecordSortTimestamp(record: OfflineRecapSaveRecord): number {
  return Math.max(record.createdAt, record.updatedAt);
}

function formatDuration(value: number | null): string {
  if (value === null) {
    return 'unknown';
  }

  if (value < 1000) {
    return `${Math.round(value)} ms`;
  }

  if (value < 60 * 1000) {
    return `${Math.round(value / 1000)} sec`;
  }

  if (value < 60 * 60 * 1000) {
    return `${Math.round(value / 60000)} min`;
  }

  return `${(value / 60 / 60 / 1000).toFixed(1)} hr`;
}

function formatClock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '離線回顧保存失敗。';
}
