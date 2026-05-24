import { debugCustomObjectIds } from './customObjectSaveService';
import type { CustomObjectImageRecord } from './saveTypes';

class CustomObjectImageSaveService {
  private readonly recordsByObjectId = new Map<string, CustomObjectImageRecord>();
  private lastRecordsHash = '';

  load(records: readonly CustomObjectImageRecord[]): void {
    this.recordsByObjectId.clear();
    records.forEach(record => {
      this.recordsByObjectId.set(record.objectId, cloneCustomObjectImageRecord(record));
    });
    this.lastRecordsHash = this.createRecordsHash();
  }

  getRecords(): readonly CustomObjectImageRecord[] {
    return Array.from(this.recordsByObjectId.values()).map(cloneCustomObjectImageRecord);
  }

  upsert(record: CustomObjectImageRecord): void {
    this.recordsByObjectId.set(record.objectId, cloneCustomObjectImageRecord(record));
  }

  delete(objectId: string): void {
    this.recordsByObjectId.delete(objectId);
  }

  writeDebugImage(): CustomObjectImageRecord {
    const timestamp = Date.now();
    const existingRecord = this.recordsByObjectId.get(debugCustomObjectIds.objectId);
    const revision = getDebugRevision(existingRecord) + 1;
    const record: CustomObjectImageRecord = {
      id: debugCustomObjectIds.imageId,
      objectId: debugCustomObjectIds.objectId,
      mimeType: 'image/svg+xml',
      dataUrl: createDebugObjectDataUrl(revision),
      updatedAt: timestamp,
    };

    this.upsert(record);
    return cloneCustomObjectImageRecord(record);
  }

  deleteDebugImage(): void {
    this.delete(debugCustomObjectIds.objectId);
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
      Array.from(this.recordsByObjectId.entries())
        .sort(([leftId], [rightId]) => leftId.localeCompare(rightId)),
    );
  }
}

function getDebugRevision(record: CustomObjectImageRecord | undefined): number {
  const match = /debugRevision=(\d+)/.exec(record?.dataUrl ?? '');

  return match ? Number(match[1]) : 0;
}

function createDebugObjectDataUrl(revision: number): string {
  const deskColor = revision % 2 === 0 ? '#8b6b4f' : '#7b5f49';
  const graffitiColor = revision % 2 === 0 ? '#36a3a7' : '#d74f6a';
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="96" viewBox="0 0 128 96">',
    `<metadata>debugRevision=${String(revision)}</metadata>`,
    `<rect x="12" y="22" width="104" height="44" rx="4" fill="${deskColor}"/>`,
    '<rect x="20" y="66" width="10" height="24" fill="#4b3728"/>',
    '<rect x="98" y="66" width="10" height="24" fill="#4b3728"/>',
    `<path d="M34 42 C48 24, 58 58, 76 38 S96 48, 104 32" fill="none" stroke="${graffitiColor}" stroke-width="6" stroke-linecap="round"/>`,
    '</svg>',
  ].join('');

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function cloneCustomObjectImageRecord(record: CustomObjectImageRecord): CustomObjectImageRecord {
  return { ...record };
}

export const customObjectImageSaveService = new CustomObjectImageSaveService();
