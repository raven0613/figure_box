import type { CharacterAvatarRecord } from './saveTypes';

const TEST_AVATAR_CHARACTER_ID = 'player-created-debug-001';

class CharacterAvatarSaveService {
  private readonly recordsByCharacterId = new Map<string, CharacterAvatarRecord>();
  private lastRecordsHash = '';

  load(records: readonly CharacterAvatarRecord[]): void {
    this.recordsByCharacterId.clear();
    records.forEach(record => {
      this.recordsByCharacterId.set(record.characterId, cloneCharacterAvatarRecord(record));
    });
    this.lastRecordsHash = this.createRecordsHash();
  }

  getRecords(): readonly CharacterAvatarRecord[] {
    return Array.from(this.recordsByCharacterId.values()).map(cloneCharacterAvatarRecord);
  }

  upsert(record: CharacterAvatarRecord): void {
    this.recordsByCharacterId.set(record.characterId, cloneCharacterAvatarRecord(record));
  }

  delete(characterId: string): void {
    this.recordsByCharacterId.delete(characterId);
  }

  writeDebugAvatar(): CharacterAvatarRecord {
    const timestamp = Date.now();
    const existingRecord = this.recordsByCharacterId.get(TEST_AVATAR_CHARACTER_ID);
    const revision = getDebugRevision(existingRecord) + 1;
    const record: CharacterAvatarRecord = {
      id: TEST_AVATAR_CHARACTER_ID,
      characterId: TEST_AVATAR_CHARACTER_ID,
      avatarSchemaVersion: 1,
      avatarState: {
        debugRevision: revision,
        parts: {
          face: {
            color: revision % 2 === 0 ? '#f2c7a7' : '#d9b59a',
            scale: 1,
          },
          eyes: {
            color: revision % 2 === 0 ? '#5a86b8' : '#7d5ab8',
            offsetX: 0,
            offsetY: 0,
          },
        },
      },
      updatedAt: timestamp,
    };

    this.upsert(record);
    return cloneCharacterAvatarRecord(record);
  }

  deleteDebugAvatar(): void {
    this.delete(TEST_AVATAR_CHARACTER_ID);
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
      Array.from(this.recordsByCharacterId.entries())
        .sort(([leftId], [rightId]) => leftId.localeCompare(rightId)),
    );
  }
}

function getDebugRevision(record: CharacterAvatarRecord | undefined): number {
  if (
    typeof record?.avatarState === 'object' &&
    record.avatarState !== null &&
    'debugRevision' in record.avatarState &&
    typeof record.avatarState.debugRevision === 'number'
  ) {
    return record.avatarState.debugRevision;
  }

  return 0;
}

function cloneCharacterAvatarRecord(record: CharacterAvatarRecord): CharacterAvatarRecord {
  return {
    ...record,
    ...(record.avatarState !== undefined ? { avatarState: structuredClone(record.avatarState) } : {}),
    ...(record.appearanceOverride !== undefined ? { appearanceOverride: structuredClone(record.appearanceOverride) } : {}),
  };
}

export const characterAvatarSaveService = new CharacterAvatarSaveService();
