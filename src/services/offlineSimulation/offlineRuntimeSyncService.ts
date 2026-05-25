import type { CharacterRuntimeSnapshot } from '~/services/save/saveTypes';

type OfflineRuntimeSnapshotApplier = (
  snapshots: readonly CharacterRuntimeSnapshot[],
) => number;

class OfflineRuntimeSyncService {
  private applier: OfflineRuntimeSnapshotApplier | null = null;

  registerApplier(applier: OfflineRuntimeSnapshotApplier): () => void {
    this.applier = applier;

    return () => {
      if (this.applier === applier) {
        this.applier = null;
      }
    };
  }

  applyRuntimeSnapshots(snapshots: readonly CharacterRuntimeSnapshot[]): number {
    if (!this.applier || snapshots.length === 0) {
      return 0;
    }

    return this.applier(snapshots);
  }
}

export const offlineRuntimeSyncService = new OfflineRuntimeSyncService();
