import { createDefaultWorldProgress } from './saveDefaults';
import type { WorldProgressRecord } from './saveTypes';

class WorldProgressService {
  private progress: WorldProgressRecord = createDefaultWorldProgress();

  load(progress: WorldProgressRecord): void {
    this.progress = {
      ...progress,
      flags: { ...progress.flags },
    };
  }

  getSnapshot(): WorldProgressRecord {
    return {
      ...this.progress,
      flags: { ...this.progress.flags },
    };
  }

  setFlag(flagId: string, value: boolean): WorldProgressRecord {
    this.progress = {
      ...this.progress,
      flags: {
        ...this.progress.flags,
        [flagId]: value,
      },
      updatedAt: Date.now(),
    };

    return this.getSnapshot();
  }
}

export const worldProgressService = new WorldProgressService();
