import type { OfflineRecapSaveRecord } from './saveTypes';

class OfflineRecapSaveService {
  private readonly recordsById = new Map<string, OfflineRecapSaveRecord>();
  private lastRecordsHash = '';

  load(records: readonly OfflineRecapSaveRecord[]): void {
    this.recordsById.clear();
    records.forEach(record => {
      this.recordsById.set(record.id, cloneOfflineRecapRecord(record));
    });
    this.lastRecordsHash = this.createRecordsHash();
  }

  getRecords(): readonly OfflineRecapSaveRecord[] {
    return Array.from(this.recordsById.values())
      .sort((left, right) => left.timestamp - right.timestamp)
      .map(cloneOfflineRecapRecord);
  }

  addRecords(records: readonly OfflineRecapSaveRecord[]): readonly OfflineRecapSaveRecord[] {
    const addedRecords = records.filter(record => !this.recordsById.has(record.id));

    addedRecords.forEach(record => {
      this.recordsById.set(record.id, cloneOfflineRecapRecord(record));
    });

    return addedRecords.map(cloneOfflineRecapRecord);
  }

  hasSimulationSeed(simulationSeed: string): boolean {
    return this.getRecords().some(record => record.simulationSeed === simulationSeed);
  }

  didRecordsChange(): boolean {
    const nextHash = this.createRecordsHash();

    if (nextHash === this.lastRecordsHash) {
      return false;
    }

    this.lastRecordsHash = nextHash;
    return true;
  }

  private createRecordsHash(): string {
    return JSON.stringify(
      Array.from(this.recordsById.entries())
        .sort(([leftId], [rightId]) => leftId.localeCompare(rightId)),
    );
  }
}

function cloneOfflineRecapRecord(record: OfflineRecapSaveRecord): OfflineRecapSaveRecord {
  return { ...record };
}

export const offlineRecapSaveService = new OfflineRecapSaveService();
