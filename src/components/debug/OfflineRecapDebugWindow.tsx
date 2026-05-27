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

interface MultiplayerDiagnosticItem {
  key: string;
  status: 'selected' | 'candidate' | 'blocked';
  characterName: string;
  eventId: string;
  activityType: string;
  participantNames: readonly string[];
  reason: string;
  weightLabel: string;
}

export function OfflineRecapDebugWindow({ onClose }: OfflineRecapDebugWindowProps) {
  const [dryRun, setDryRun] = useState<OfflineSimulationDryRun | null>(null);
  const [savedRecaps, setSavedRecaps] = useState<readonly OfflineRecapSaveRecord[]>([]);
  const [savedViewMode, setSavedViewMode] = useState<SavedRecapViewMode>('latest');
  const [autoSaveMessage, setAutoSaveMessage] = useState<string | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  const refreshSavedRecaps = useCallback(() => {
    setSavedRecaps(sortSavedRecapsForTimeline(offlineRecapSaveService.getRecords()));
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
  const multiplayerDiagnostics = useMemo(
    () => createMultiplayerDiagnostics(dryRun),
    [dryRun],
  );
  const latestSimulationSeed = useMemo(
    () => getLatestSimulationSeed(savedRecaps),
    [savedRecaps],
  );
  const visibleSavedRecaps = useMemo(() => {
    const records = savedViewMode === 'latest' && latestSimulationSeed
      ? savedRecaps.filter(record => record.simulationSeed === latestSimulationSeed)
      : savedRecaps;

    return sortSavedRecapsForTimeline(records);
  }, [latestSimulationSeed, savedRecaps, savedViewMode]);

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

        <div className={styles.diagnosticBlock}>
          <div className={styles.diagnosticHeader}>
            <strong>Multiplayer Candidates</strong>
            <span>{multiplayerDiagnostics.length}</span>
          </div>
          {multiplayerDiagnostics.length > 0 ? (
            <div className={styles.diagnosticList}>
              {multiplayerDiagnostics.map(item => (
                <MultiplayerDiagnosticItemView item={item} key={item.key} />
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>目前沒有多人候選進入 preview 診斷範圍。</div>
          )}
        </div>
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

function MultiplayerDiagnosticItemView({ item }: { item: MultiplayerDiagnosticItem }) {
  const statusLabel = {
    selected: '成立',
    candidate: '候選',
    blocked: '未成立',
  }[item.status];

  return (
    <article className={styles.diagnosticItem}>
      <div className={styles.diagnosticMeta}>
        <span className={getDiagnosticStatusClass(item.status)}>{statusLabel}</span>
        <span>{item.characterName}</span>
        <span>{item.activityType}</span>
        <span>{item.weightLabel}</span>
      </div>
      <div className={styles.diagnosticTitle}>{item.eventId}</div>
      <div className={styles.diagnosticDetail}>
        <span>{item.participantNames.length > 0 ? item.participantNames.join('、') : '尚未形成參加者'}</span>
        <span>{item.reason}</span>
      </div>
    </article>
  );
}

function getDiagnosticStatusClass(status: MultiplayerDiagnosticItem['status']): string {
  switch (status) {
    case 'selected':
      return styles.diagnosticStatus_selected;
    case 'candidate':
      return styles.diagnosticStatus_candidate;
    case 'blocked':
      return styles.diagnosticStatus_blocked;
    default:
      return styles.diagnosticStatus_blocked;
  }
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
  const resolverSource = event?.resolutionPreview.kind === 'unsupported'
    ? event.resolutionPreview.reason
    : event?.resolutionPreview.resolverSource ?? '-';
  const participantLabel = recap.participantNames.length > 1
    ? recap.participantNames.join('、')
    : recap.characterName;

  return (
    <article className={styles.recapItem}>
      <div className={styles.recapMeta}>
        <span>#{index + 1}</span>
        <span>{participantLabel}</span>
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
  const participantLabel = record.participantNames.length > 1
    ? record.participantNames.join('、')
    : record.characterName;

  return (
    <article className={styles.recapItem}>
      <div className={styles.recapMeta}>
        <span>{participantLabel}</span>
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

function sortSavedRecapsForTimeline(
  records: readonly OfflineRecapSaveRecord[],
): OfflineRecapSaveRecord[] {
  return [...records].sort(compareSavedRecapTimeline);
}

function compareSavedRecapTimeline(
  left: OfflineRecapSaveRecord,
  right: OfflineRecapSaveRecord,
): number {
  return left.createdAt - right.createdAt ||
    left.displayIndex - right.displayIndex ||
    left.timestamp - right.timestamp ||
    left.id.localeCompare(right.id, undefined, { numeric: true });
}

function createMultiplayerDiagnostics(
  dryRun: OfflineSimulationDryRun | null,
): MultiplayerDiagnosticItem[] {
  if (!dryRun) {
    return [];
  }

  const selectedItems = dryRun.simulationPreview.events.flatMap((event, index) => {
    if (
      event.resolutionPreview.kind !== 'group' ||
      event.resolutionPreview.participantIds.length <= 1
    ) {
      return [];
    }

    return [{
      key: `selected:${event.eventId}:${event.characterId}:${event.timestamp}:${String(index)}`,
      status: 'selected' as const,
      characterName: event.characterName,
      eventId: event.eventId,
      activityType: event.activityType ?? event.eventType,
      participantNames: event.resolutionPreview.participants.map(participant => participant.characterName),
      reason: event.resolutionPreview.resolverSource,
      weightLabel: `weight ${event.offlineWeight}`,
    }];
  });

  const candidateItems = dryRun.characters.flatMap(character => (
    character.candidates.flatMap((candidate, index) => {
      const diagnostic = createCandidateMultiplayerDiagnostic({
        candidate,
        characterName: character.characterName,
      });

      if (!diagnostic) {
        return [];
      }

      return [{
        ...diagnostic,
        key: `candidate:${character.characterId}:${candidate.id}:${String(index)}`,
      }];
    })
  ));

  return [...selectedItems, ...candidateItems]
    .sort(compareMultiplayerDiagnostics)
    .slice(0, 24);
}

function createCandidateMultiplayerDiagnostic(input: {
  candidate: OfflineSimulationDryRun['characters'][number]['candidates'][number];
  characterName: string;
}): Omit<MultiplayerDiagnosticItem, 'key'> | null {
  const resolution = input.candidate.resolutionPreview;

  if (resolution.kind === 'group') {
    const participantNames = resolution.participants.map(participant => participant.characterName);
    const isMultiplayer = resolution.participantIds.length > 1;
    const canBecomeMultiplayer = input.candidate.activityType !== undefined;

    if (!isMultiplayer && !canBecomeMultiplayer) {
      return null;
    }

    return {
      status: isMultiplayer ? 'candidate' : 'blocked',
      characterName: input.characterName,
      eventId: input.candidate.id,
      activityType: input.candidate.activityType ?? input.candidate.eventType,
      participantNames,
      reason: isMultiplayer
        ? '多人候選成立，但沒有在本次加權抽選中成為 recap'
        : '只形成單人結果，沒有邀到第二位參加者',
      weightLabel: `offline ${input.candidate.offlineWeight} / online ${input.candidate.onlineWeight}`,
    };
  }

  if (
    resolution.kind === 'unsupported' &&
    (resolution.reason === 'missingParticipantRoll' || input.candidate.activityType === 'chat')
  ) {
    return {
      status: 'blocked',
      characterName: input.characterName,
      eventId: input.candidate.id,
      activityType: input.candidate.activityType ?? input.candidate.eventType,
      participantNames: [],
      reason: resolution.reason,
      weightLabel: `offline ${input.candidate.offlineWeight} / online ${input.candidate.onlineWeight}`,
    };
  }

  return null;
}

function compareMultiplayerDiagnostics(
  left: MultiplayerDiagnosticItem,
  right: MultiplayerDiagnosticItem,
): number {
  const statusOrder = {
    selected: 0,
    candidate: 1,
    blocked: 2,
  };

  return statusOrder[left.status] - statusOrder[right.status] ||
    left.eventId.localeCompare(right.eventId) ||
    left.characterName.localeCompare(right.characterName);
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
