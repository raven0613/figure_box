import { saveDb } from '~/services/save/saveDb';
import { normalizeSaveMetaRecord } from '~/services/save/saveNormalizer';

export interface OfflineSessionSnapshot {
  lastActiveAt: number | null;
  lastOfflineSimulationAt: number | null;
  lastObservedAwayMs: number | null;
  startedAt: number | null;
}

class OfflineSessionService {
  private snapshot: OfflineSessionSnapshot = {
    lastActiveAt: null,
    lastOfflineSimulationAt: null,
    lastObservedAwayMs: null,
    startedAt: null,
  };
  private isListening = false;
  private readonly handleVisibilityChange = (): void => {
    void this.recordVisibilityChange();
  };
  private readonly handlePageHide = (): void => {
    void this.recordActiveTimestamp(Date.now());
  };

  async start(): Promise<OfflineSessionSnapshot> {
    const timestamp = Date.now();
    const saveMeta = normalizeSaveMetaRecord(await saveDb.saveMeta.get('current'));
    const lastObservedAwayMs = saveMeta.lastActiveAt === null
      ? null
      : Math.max(0, timestamp - saveMeta.lastActiveAt);

    this.snapshot = {
      lastActiveAt: saveMeta.lastActiveAt,
      lastOfflineSimulationAt: saveMeta.lastOfflineSimulationAt,
      lastObservedAwayMs,
      startedAt: timestamp,
    };
    await this.recordActiveTimestamp(timestamp);
    this.listen();

    return this.getSnapshot();
  }

  getSnapshot(): OfflineSessionSnapshot {
    return { ...this.snapshot };
  }

  private listen(): void {
    if (this.isListening) {
      return;
    }

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('pagehide', this.handlePageHide);
    this.isListening = true;
  }

  private async recordVisibilityChange(): Promise<void> {
    const timestamp = Date.now();

    if (document.hidden) {
      await this.recordActiveTimestamp(timestamp);
      return;
    }

    const saveMeta = normalizeSaveMetaRecord(await saveDb.saveMeta.get('current'));
    const lastObservedAwayMs = saveMeta.lastActiveAt === null
      ? null
      : Math.max(0, timestamp - saveMeta.lastActiveAt);

    this.snapshot = {
      lastActiveAt: saveMeta.lastActiveAt,
      lastOfflineSimulationAt: saveMeta.lastOfflineSimulationAt,
      lastObservedAwayMs,
      startedAt: this.snapshot.startedAt,
    };
    await this.recordActiveTimestamp(timestamp);
  }

  private async recordActiveTimestamp(timestamp: number): Promise<void> {
    const saveMeta = normalizeSaveMetaRecord(await saveDb.saveMeta.get('current'));

    await saveDb.saveMeta.put({
      ...saveMeta,
      lastActiveAt: timestamp,
      updatedAt: timestamp,
    });
    this.snapshot = {
      ...this.snapshot,
      lastActiveAt: timestamp,
      lastOfflineSimulationAt: saveMeta.lastOfflineSimulationAt,
    };
  }
}

export const offlineSessionService = new OfflineSessionService();
