import { itemService } from '~/services/items/itemService';
import { shopService } from '~/services/items/shopService';
import { saveDb, deleteSaveDatabase } from './saveDb';
import {
  createDefaultItemSaveRecord,
  createDefaultRelationshipSaveRecord,
  createDefaultSaveMeta,
  createDefaultSettingsRecord,
  createDefaultShopSaveRecord,
  createDefaultWorldProgress,
} from './saveDefaults';
import {
  normalizeCharacterAvatarRecords,
  normalizeCharacterProfileRecords,
  normalizeCharacterRuntimeSaveRecords,
  normalizeCustomObjectImageRecords,
  normalizeCustomObjectRecords,
  normalizeItemSaveRecord,
  normalizeOfflineRecapSaveRecords,
  normalizeRelationshipSaveRecord,
  normalizeSaveMetaRecord,
  normalizeSettingsRecord,
  normalizeShopSaveRecord,
  normalizeWorldProgressRecord,
} from './saveNormalizer';
import { settingsService } from './settingsService';
import { characterAvatarSaveService } from './characterAvatarSaveService';
import { characterRuntimeSaveService } from './characterRuntimeSaveService';
import { characterProfileSaveService } from './characterProfileSaveService';
import { customObjectImageSaveService } from './customObjectImageSaveService';
import { customObjectSaveService } from './customObjectSaveService';
import { relationshipStoreService } from './relationshipStoreService';
import { offlineRecapSaveService } from './offlineRecapSaveService';
import type {
  CharacterRuntimeSaveRecord,
  RelationshipSaveRecord,
  SaveDomain,
} from './saveTypes';
import {
  exportContentPackString,
  exportCharacterContentPackString,
  exportFullSavePackageString,
  exportObjectContentPackString,
  importContentPackString,
  importCharacterContentPackString,
  importFullSavePackageString,
  importObjectContentPackString,
  previewContentPackString,
  previewCharacterContentPackString,
  previewExportableContentPack,
  previewExportableCharacterContentPack,
  previewExportableObjectContentPack,
  previewObjectContentPackString,
  type CharacterContentPackPreview,
  type CombinedContentPackPackageSummary,
  type CombinedContentPackPreview,
  type ContentPackPackageSummary,
  type CustomObjectContentPackPreview,
  type ExportContentPackOptions,
  type ExportCharacterContentPackOptions,
  type ExportObjectContentPackOptions,
  type FullSavePackageSummary,
  type ImportContentPackOptions,
  type ImportCharacterContentPackOptions,
  type ImportObjectContentPackOptions,
  type ObjectContentPackPackageSummary,
} from './saveTransferService';
import { worldProgressService } from './worldProgressService';
import { offlineSessionService } from '~/services/offlineSimulation/offlineSessionService';
import { clearMiniSpriteBakeCache } from '~/widgets/miniAvatar/miniSpriteBakeCache';

const AUTOSAVE_DELAY_MS = 600;
const CHARACTER_SAVE_MIN_INTERVAL_MS = 5000;

class SaveService {
  private initializationPromise: Promise<void> | null = null;
  private autosaveTimer: number | null = null;
  private lastCharacterSaveAt = 0;
  private readonly dirtyDomains = new Set<SaveDomain>();

  initializeGame(): Promise<void> {
    this.initializationPromise ??= this.initializeGameInternal();

    return this.initializationPromise;
  }

  async saveItemsNow(): Promise<void> {
    await itemService.save();
    await this.touchSaveMeta();
  }

  async exportFullSaveString(): Promise<string> {
    await this.flushAutosave();
    await this.touchBackupMeta();

    return exportFullSavePackageString();
  }

  async importFullSaveString(packageString: string): Promise<FullSavePackageSummary> {
    if (this.autosaveTimer !== null) {
      window.clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }

    this.dirtyDomains.clear();
    const summary = await importFullSavePackageString(packageString);
    this.initializationPromise = null;
    await this.initializeGameInternal();

    return summary;
  }

  async exportCharacterContentPackString(
    options: ExportCharacterContentPackOptions = {},
  ): Promise<string> {
    await this.flushAutosave();

    return exportCharacterContentPackString(options);
  }

  async previewExportableCharacterContentPack(): Promise<CharacterContentPackPreview> {
    await this.flushAutosave();

    return previewExportableCharacterContentPack();
  }

  async exportObjectContentPackString(
    options: ExportObjectContentPackOptions = {},
  ): Promise<string> {
    await this.flushAutosave();

    return exportObjectContentPackString(options);
  }

  async previewExportableObjectContentPack(): Promise<CustomObjectContentPackPreview> {
    await this.flushAutosave();

    return previewExportableObjectContentPack();
  }

  async exportContentPackString(
    options: ExportContentPackOptions = {},
  ): Promise<string> {
    await this.flushAutosave();

    return exportContentPackString(options);
  }

  async previewExportableContentPack(): Promise<CombinedContentPackPreview> {
    await this.flushAutosave();

    return previewExportableContentPack();
  }

  previewContentPackString(packageString: string): Promise<CombinedContentPackPreview> {
    return previewContentPackString(packageString);
  }

  previewCharacterContentPackString(packageString: string): Promise<CharacterContentPackPreview> {
    return previewCharacterContentPackString(packageString);
  }

  previewObjectContentPackString(packageString: string): Promise<CustomObjectContentPackPreview> {
    return previewObjectContentPackString(packageString);
  }

  async importCharacterContentPackString(
    packageString: string,
    options: ImportCharacterContentPackOptions = {},
  ): Promise<ContentPackPackageSummary> {
    const summary = await importCharacterContentPackString(packageString, options);

    this.initializationPromise = null;
    await this.initializeGameInternal();
    await this.touchSaveMeta();

    return summary;
  }

  async importContentPackString(
    packageString: string,
    options: ImportContentPackOptions = {},
  ): Promise<CombinedContentPackPackageSummary> {
    const summary = await importContentPackString(packageString, options);

    this.initializationPromise = null;
    await this.initializeGameInternal();
    await this.touchSaveMeta();

    return summary;
  }

  async importObjectContentPackString(
    packageString: string,
    options: ImportObjectContentPackOptions = {},
  ): Promise<ObjectContentPackPackageSummary> {
    const summary = await importObjectContentPackString(packageString, options);

    this.initializationPromise = null;
    await this.initializeGameInternal();
    await this.touchSaveMeta();

    return summary;
  }

  scheduleSaveItems(): void {
    this.markDirty('items');
  }

  markDirty(domain: SaveDomain): void {
    this.dirtyDomains.add(domain);

    if (this.autosaveTimer !== null) {
      window.clearTimeout(this.autosaveTimer);
    }

    this.autosaveTimer = window.setTimeout(() => {
      this.autosaveTimer = null;
      void this.saveDirtyDomains();
    }, AUTOSAVE_DELAY_MS);
  }

  async flushAutosave(): Promise<void> {
    if (this.autosaveTimer !== null) {
      window.clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }

    await this.saveDirtyDomains();
  }

  async saveOfflineSimulationNow(lastOfflineSimulationAt: number = Date.now()): Promise<void> {
    const [didSaveCharacterRuntime, didSaveOfflineRecaps] = await Promise.all([
      this.saveCharacterRuntime({ ignoreMinInterval: true }),
      this.saveOfflineRecaps(),
    ]);

    await offlineSessionService.recordOfflineSimulation(lastOfflineSimulationAt);

    if (didSaveCharacterRuntime || didSaveOfflineRecaps) {
      await this.touchSaveMeta();
    }
  }

  async resetGameSave(): Promise<void> {
    if (this.autosaveTimer !== null) {
      window.clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }

    this.dirtyDomains.clear();
    clearMiniSpriteBakeCache();
    await deleteSaveDatabase();
    this.initializationPromise = null;
  }

  private async initializeGameInternal(): Promise<void> {
    await this.ensureCoreRecords();
    await offlineSessionService.start();
    await itemService.load();
    await shopService.load();
  }

  private async ensureCoreRecords(): Promise<void> {
    const timestamp = Date.now();
    const [
      rawSaveMeta,
      rawWorldProgress,
      rawItems,
      rawShops,
      rawSettings,
      rawRelationships,
      rawCharacters,
      rawCharacterRuntime,
      rawCharacterAvatars,
      rawCustomObjects,
      rawCustomObjectImages,
      rawOfflineRecaps,
    ] = await Promise.all([
      saveDb.saveMeta.get('current'),
      saveDb.worldProgress.get('current'),
      saveDb.items.get('current'),
      saveDb.shops.get('current'),
      saveDb.settings.get('current'),
      saveDb.relationships.get('current'),
      saveDb.characters.toArray(),
      saveDb.characterRuntime.toArray(),
      saveDb.characterAvatars.toArray(),
      saveDb.customObjects.toArray(),
      saveDb.customObjectImages.toArray(),
      saveDb.offlineRecaps.toArray(),
    ]);
    const saveMeta = rawSaveMeta
      ? normalizeSaveMetaRecord(rawSaveMeta)
      : createDefaultSaveMeta(timestamp);
    const worldProgress = rawWorldProgress
      ? normalizeWorldProgressRecord(rawWorldProgress)
      : createDefaultWorldProgress(timestamp);
    const itemSaveRecord = rawItems
      ? normalizeItemSaveRecord(rawItems)
      : createDefaultItemSaveRecord(timestamp);
    const normalizedShopRecord = rawShops
      ? normalizeShopSaveRecord(rawShops)
      : createDefaultShopSaveRecord(timestamp);
    const shopSaveRecord = normalizedShopRecord.snapshot.stockItems.length > 0
      ? normalizedShopRecord
      : {
        id: 'current' as const,
        snapshot: shopService.getSnapshot(),
        updatedAt: timestamp,
      };
    const settings = rawSettings
      ? normalizeSettingsRecord(rawSettings)
      : createDefaultSettingsRecord(timestamp);
    const relationshipStore = rawRelationships
      ? normalizeRelationshipSaveRecord(rawRelationships)
      : createDefaultRelationshipSaveRecord(timestamp);
    const characterProfileRecords = normalizeCharacterProfileRecords(rawCharacters);
    const legacyCharacterRuntimeRecords = normalizeCharacterRuntimeSaveRecords(rawCharacters, {
      requireRuntimeShape: true,
    });
    const characterRuntimeRecords = mergeCharacterRuntimeRecords([
      ...legacyCharacterRuntimeRecords,
      ...normalizeCharacterRuntimeSaveRecords(rawCharacterRuntime),
    ]);
    const characterAvatarRecords = normalizeCharacterAvatarRecords(rawCharacterAvatars);
    const customObjectRecords = normalizeCustomObjectRecords(rawCustomObjects);
    const customObjectIds = new Set(customObjectRecords.map(record => record.id));
    const customObjectImageRecords = normalizeCustomObjectImageRecords(rawCustomObjectImages)
      .filter(record => customObjectIds.has(record.objectId));
    const offlineRecapRecords = normalizeOfflineRecapSaveRecords(rawOfflineRecaps);

    worldProgressService.load(worldProgress);
    settingsService.load(settings);
    relationshipStoreService.load(relationshipStore.snapshot);
    characterProfileSaveService.load(characterProfileRecords);
    characterRuntimeSaveService.load(characterRuntimeRecords);
    characterAvatarSaveService.load(characterAvatarRecords);
    customObjectSaveService.load(customObjectRecords);
    customObjectImageSaveService.load(customObjectImageRecords);
    offlineRecapSaveService.load(offlineRecapRecords);

    await saveDb.transaction('rw', [
      saveDb.saveMeta,
      saveDb.worldProgress,
      saveDb.items,
      saveDb.shops,
      saveDb.settings,
      saveDb.relationships,
      saveDb.characters,
      saveDb.characterRuntime,
      saveDb.characterAvatars,
      saveDb.customObjects,
      saveDb.customObjectImages,
      saveDb.offlineRecaps,
    ], async () => {
      await saveDb.saveMeta.put(saveMeta);
      await saveDb.worldProgress.put(worldProgress);
      await saveDb.items.put(itemSaveRecord);
      await saveDb.shops.put(shopSaveRecord);
      await saveDb.settings.put(settings);
      await saveDb.relationships.put(relationshipStore);
      await saveDb.characters.clear();
      if (characterProfileRecords.length > 0) {
        await saveDb.characters.bulkPut(characterProfileRecords);
      }
      if (characterRuntimeRecords.length > 0) {
        await saveDb.characterRuntime.bulkPut(characterRuntimeRecords);
      }
      if (characterAvatarRecords.length > 0) {
        await saveDb.characterAvatars.bulkPut(characterAvatarRecords);
      }
      await saveDb.customObjects.clear();
      if (customObjectRecords.length > 0) {
        await saveDb.customObjects.bulkPut(customObjectRecords);
      }
      await saveDb.customObjectImages.clear();
      if (customObjectImageRecords.length > 0) {
        await saveDb.customObjectImages.bulkPut(customObjectImageRecords);
      }
      if (offlineRecapRecords.length > 0) {
        await saveDb.offlineRecaps.bulkPut(offlineRecapRecords);
      }
    });
  }

  private async saveDirtyDomains(): Promise<void> {
    const domains = Array.from(this.dirtyDomains);
    this.dirtyDomains.clear();

    if (domains.length === 0) {
      return;
    }

    const writeResults = await Promise.all(domains.map(domain => this.saveDomain(domain)));

    if (writeResults.some(Boolean)) {
      await this.touchSaveMeta();
    }
  }

  private async saveDomain(domain: SaveDomain): Promise<boolean> {
    switch (domain) {
      case 'items':
        await itemService.save();
        return true;
      case 'shops':
        await shopService.save();
        return true;
      case 'settings':
        await saveDb.settings.put(settingsService.getSnapshot());
        return true;
      case 'worldProgress':
        await saveDb.worldProgress.put(worldProgressService.getSnapshot());
        return true;
      case 'relationships':
        return this.saveRelationships();
      case 'characters':
        return this.saveCharacterProfiles();
      case 'characterRuntime':
        return this.saveCharacterRuntime();
      case 'characterAvatars':
        return this.saveCharacterAvatars();
      case 'customObjects':
        return this.saveCustomObjects();
      case 'customObjectImages':
        return this.saveCustomObjectImages();
      case 'offlineRecaps':
        return this.saveOfflineRecaps();
    }
  }

  private async saveRelationships(): Promise<boolean> {
    const nextRecord: RelationshipSaveRecord = {
      id: 'current',
      snapshot: relationshipStoreService.getSnapshot(),
      updatedAt: Date.now(),
    };
    const currentRecord = await saveDb.relationships.get('current');

    if (
      currentRecord &&
      JSON.stringify(currentRecord.snapshot) === JSON.stringify(nextRecord.snapshot)
    ) {
      return false;
    }

    await saveDb.relationships.put(nextRecord);
    return true;
  }

  private async saveCharacterRuntime(
    options: { ignoreMinInterval?: boolean } = {},
  ): Promise<boolean> {
    const timestamp = Date.now();

    if (
      !options.ignoreMinInterval &&
      this.lastCharacterSaveAt > 0 &&
      timestamp - this.lastCharacterSaveAt < CHARACTER_SAVE_MIN_INTERVAL_MS
    ) {
      return false;
    }

    if (!characterRuntimeSaveService.didSaveRecordsChange()) {
      return false;
    }

    const records = characterRuntimeSaveService.getSaveRecords();

    if (records.length === 0) {
      return false;
    }

    await saveDb.characterRuntime.bulkPut(records);
    this.lastCharacterSaveAt = timestamp;
    return true;
  }

  private async saveCharacterProfiles(): Promise<boolean> {
    if (!characterProfileSaveService.didRecordsChange()) {
      return false;
    }

    const records = characterProfileSaveService.getRecords();

    await saveDb.characters.clear();
    if (records.length > 0) {
      await saveDb.characters.bulkPut(records);
    }
    return true;
  }

  private async saveCharacterAvatars(): Promise<boolean> {
    if (!characterAvatarSaveService.didRecordsChange()) {
      return false;
    }

    const records = characterAvatarSaveService.getRecords();

    await saveDb.characterAvatars.clear();
    if (records.length > 0) {
      await saveDb.characterAvatars.bulkPut(records);
    }
    return true;
  }

  private async saveCustomObjects(): Promise<boolean> {
    if (!customObjectSaveService.didRecordsChange()) {
      return false;
    }

    const records = customObjectSaveService.getRecords();

    await saveDb.customObjects.clear();
    if (records.length > 0) {
      await saveDb.customObjects.bulkPut(records);
    }
    return true;
  }

  private async saveCustomObjectImages(): Promise<boolean> {
    if (!customObjectImageSaveService.didRecordsChange()) {
      return false;
    }

    const records = customObjectImageSaveService.getRecords();

    await saveDb.customObjectImages.clear();
    if (records.length > 0) {
      await saveDb.customObjectImages.bulkPut(records);
    }
    return true;
  }

  private async saveOfflineRecaps(): Promise<boolean> {
    if (!offlineRecapSaveService.didRecordsChange()) {
      return false;
    }

    const records = offlineRecapSaveService.getRecords();

    await saveDb.offlineRecaps.clear();
    if (records.length > 0) {
      await saveDb.offlineRecaps.bulkPut(records);
    }
    return true;
  }

  private async touchSaveMeta(): Promise<void> {
    const currentRecord = normalizeSaveMetaRecord(await saveDb.saveMeta.get('current'));

    await saveDb.saveMeta.put({
      ...currentRecord,
      updatedAt: Date.now(),
    });
  }

  private async touchBackupMeta(): Promise<void> {
    const timestamp = Date.now();
    const currentRecord = normalizeSaveMetaRecord(await saveDb.saveMeta.get('current'));

    await saveDb.saveMeta.put({
      ...currentRecord,
      lastBackupAt: timestamp,
      updatedAt: timestamp,
    });
  }
}

export const saveService = new SaveService();

function mergeCharacterRuntimeRecords(
  records: readonly CharacterRuntimeSaveRecord[],
): readonly CharacterRuntimeSaveRecord[] {
  return Array.from(new Map(records.map(record => [record.id, record])).values());
}
