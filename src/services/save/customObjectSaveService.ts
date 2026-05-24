import type { CustomObjectRecord } from './saveTypes';

const TEST_CUSTOM_OBJECT_ID = 'custom-object-debug-001';
const TEST_CUSTOM_OBJECT_IMAGE_ID = 'custom-object-debug-image-001';

class CustomObjectSaveService {
  private readonly recordsById = new Map<string, CustomObjectRecord>();
  private lastRecordsHash = '';

  load(records: readonly CustomObjectRecord[]): void {
    this.recordsById.clear();
    records.forEach(record => {
      this.recordsById.set(record.id, cloneCustomObjectRecord(record));
    });
    this.lastRecordsHash = this.createRecordsHash();
  }

  getRecords(): readonly CustomObjectRecord[] {
    return Array.from(this.recordsById.values()).map(cloneCustomObjectRecord);
  }

  upsert(record: CustomObjectRecord): void {
    this.recordsById.set(record.id, cloneCustomObjectRecord(record));
  }

  delete(objectId: string): void {
    this.recordsById.delete(objectId);
  }

  upsertDebugObject(): CustomObjectRecord {
    const timestamp = Date.now();
    const existingRecord = this.recordsById.get(TEST_CUSTOM_OBJECT_ID);
    const debugRevision = getDebugRevision(existingRecord) + 1;
    const record: CustomObjectRecord = {
      id: TEST_CUSTOM_OBJECT_ID,
      source: 'debug',
      name: `Debug Graffiti Desk ${String(debugRevision)}`,
      origin: {
        kind: 'staticObject',
        objectId: 'desk',
      },
      imageId: TEST_CUSTOM_OBJECT_IMAGE_ID,
      width: 128,
      height: 96,
      objectSchemaVersion: 1,
      createdAt: existingRecord?.createdAt ?? timestamp,
      updatedAt: timestamp,
      metadata: {
        ...(existingRecord?.metadata ?? {}),
        debugRevision,
      },
    };

    this.upsert(record);
    return cloneCustomObjectRecord(record);
  }

  deleteDebugObject(): void {
    this.delete(TEST_CUSTOM_OBJECT_ID);
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

export const debugCustomObjectIds = {
  objectId: TEST_CUSTOM_OBJECT_ID,
  imageId: TEST_CUSTOM_OBJECT_IMAGE_ID,
} as const;

function getDebugRevision(record: CustomObjectRecord | undefined): number {
  return typeof record?.metadata.debugRevision === 'number' ? record.metadata.debugRevision : 0;
}

function cloneCustomObjectRecord(record: CustomObjectRecord): CustomObjectRecord {
  return {
    ...record,
    origin: { ...record.origin },
    metadata: { ...record.metadata },
  };
}

export const customObjectSaveService = new CustomObjectSaveService();
