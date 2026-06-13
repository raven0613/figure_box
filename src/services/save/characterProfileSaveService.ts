import type {
  CharacterProfileRecord,
} from './saveTypes';

const TEST_CHARACTER_ID = 'player-created-debug-001';

class CharacterProfileSaveService {
  private readonly recordsById = new Map<string, CharacterProfileRecord>();
  private lastRecordsHash = '';

  load(records: readonly CharacterProfileRecord[]): void {
    this.recordsById.clear();
    records.forEach(record => {
      this.recordsById.set(record.id, cloneCharacterProfileRecord(record));
    });
    this.lastRecordsHash = this.createRecordsHash();
  }

  getRecords(): readonly CharacterProfileRecord[] {
    return Array.from(this.recordsById.values()).map(cloneCharacterProfileRecord);
  }

  upsert(record: CharacterProfileRecord): void {
    this.recordsById.set(record.id, cloneCharacterProfileRecord(record));
  }

  delete(characterId: string): void {
    this.recordsById.delete(characterId);
  }

  upsertDebugCharacter(): CharacterProfileRecord {
    const timestamp = Date.now();
    const existingRecord = this.recordsById.get(TEST_CHARACTER_ID);
    const record: CharacterProfileRecord = {
      id: TEST_CHARACTER_ID,
      source: 'debug',
      templateId: 'debug-template',
      name: 'Debug Character',
      createdAt: existingRecord?.createdAt ?? timestamp,
      updatedAt: timestamp,
      profile: {
        ...(existingRecord?.profile ?? {}),
        debugRevision: typeof existingRecord?.profile.debugRevision === 'number'
          ? existingRecord.profile.debugRevision + 1
          : 1,
      },
    };

    this.upsert(record);
    return cloneCharacterProfileRecord(record);
  }

  deleteDebugCharacter(): void {
    this.delete(TEST_CHARACTER_ID);
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

function cloneCharacterProfileRecord(record: CharacterProfileRecord): CharacterProfileRecord {
  return {
    ...record,
    profile: structuredClone(record.profile),
  };
}

export const characterProfileSaveService = new CharacterProfileSaveService();
