import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getBrowserStorageStatus,
  requestPersistentStorage,
} from '~/services/save/browserStorageService';
import {
  getSaveDebugDatabaseSnapshot,
  type SaveDebugDatabaseSnapshot,
} from '~/services/save/saveDebugService';
import { characterAvatarSaveService } from '~/services/save/characterAvatarSaveService';
import { characterProfileSaveService } from '~/services/save/characterProfileSaveService';
import { customObjectImageSaveService } from '~/services/save/customObjectImageSaveService';
import { customObjectSaveService } from '~/services/save/customObjectSaveService';
import { relationshipStoreService } from '~/services/save/relationshipStoreService';
import { saveService } from '~/services/save/saveService';
import type {
  CombinedContentPackPreview,
  ContentPackConflictResolution,
} from '~/services/save/saveTransferService';
import type {
  BrowserStorageStatus,
  SaveTableName,
  SaveTableSchemaSummary,
} from '~/services/save/saveTypes';
import { worldProgressService } from '~/services/save/worldProgressService';
import styles from './saveDebugPanel.module.scss';

interface SaveDebugPanelProps {
  onClose: () => void;
}

const REFRESH_ERROR_MESSAGE = '存檔資料讀取失敗。';
const EXPORT_SUCCESS_MESSAGE = '完整存檔已匯出。';
const CONTENT_EXPORT_SUCCESS_MESSAGE = '內容包已匯出。';
const IMPORT_RELOAD_MESSAGE = '匯入完成，重新載入遊戲。';

interface ContentPackPreviewState {
  packageText: string;
  preview: CombinedContentPackPreview;
}

export function SaveDebugPanel({ onClose }: SaveDebugPanelProps) {
  const [snapshot, setSnapshot] = useState<SaveDebugDatabaseSnapshot | null>(null);
  const [storageStatus, setStorageStatus] = useState<BrowserStorageStatus | null>(null);
  const [selectedTable, setSelectedTable] = useState<SaveTableName>('saveMeta');
  const [isLoading, setIsLoading] = useState(false);
  const [isDebugMutationPending, setIsDebugMutationPending] = useState(false);
  const [isTransferPending, setIsTransferPending] = useState(false);
  const [transferText, setTransferText] = useState('');
  const [exportContentPackPreview, setExportContentPackPreview] = useState<CombinedContentPackPreview | null>(null);
  const [selectedExportCharacterIds, setSelectedExportCharacterIds] = useState<readonly string[]>([]);
  const [contentPackPreview, setContentPackPreview] = useState<ContentPackPreviewState | null>(null);
  const [selectedContentCharacterIds, setSelectedContentCharacterIds] = useState<readonly string[]>([]);
  const [characterConflictResolutions, setCharacterConflictResolutions] = useState<Record<string, ContentPackConflictResolution>>({});
  const [selectedExportObjectIds, setSelectedExportObjectIds] = useState<readonly string[]>([]);
  const [selectedContentObjectIds, setSelectedContentObjectIds] = useState<readonly string[]>([]);
  const [objectConflictResolutions, setObjectConflictResolutions] = useState<Record<string, ContentPackConflictResolution>>({});
  const [message, setMessage] = useState<string | null>(null);

  const selectedTableSnapshot = useMemo(
    () => snapshot?.tables.find(table => table.table === selectedTable) ?? null,
    [selectedTable, snapshot],
  );
  const schemaByTable = useMemo(
    () => new Map(snapshot?.schemas.map(schema => [schema.name, schema]) ?? []),
    [snapshot],
  );
  const selectedSchema = schemaByTable.get(selectedTable) ?? null;
  const normalizedTransferText = transferText.trim();
  const currentContentPackPreview = contentPackPreview?.packageText === normalizedTransferText
    ? contentPackPreview.preview
    : null;
  const selectedContentCharacterIdSet = useMemo(
    () => new Set(selectedContentCharacterIds),
    [selectedContentCharacterIds],
  );
  const selectedExportCharacterIdSet = useMemo(
    () => new Set(selectedExportCharacterIds),
    [selectedExportCharacterIds],
  );
  const selectedContentObjectIdSet = useMemo(
    () => new Set(selectedContentObjectIds),
    [selectedContentObjectIds],
  );
  const selectedExportObjectIdSet = useMemo(
    () => new Set(selectedExportObjectIds),
    [selectedExportObjectIds],
  );

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const [nextSnapshot, nextStorageStatus] = await Promise.all([
        getSaveDebugDatabaseSnapshot(),
        getBrowserStorageStatus(),
      ]);

      setSnapshot(nextSnapshot);
      setStorageStatus(nextStorageStatus);
      setSelectedTable(currentTable => (
        nextSnapshot.tables.some(table => table.table === currentTable)
          ? currentTable
          : nextSnapshot.tables[0]?.table ?? 'saveMeta'
      ));
    } catch (error) {
      console.error(REFRESH_ERROR_MESSAGE, error);
      setMessage(REFRESH_ERROR_MESSAGE);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => window.clearTimeout(refreshTimer);
  }, [refresh]);

  const handleRequestPersistence = useCallback(async () => {
    const isPersisted = await requestPersistentStorage();

    setMessage(isPersisted ? '瀏覽器已允許保護本地存檔。' : '瀏覽器未允許保護本地存檔。');
    setStorageStatus(await getBrowserStorageStatus());
  }, []);

  const handleToggleWorldTestFlag = useCallback(async () => {
    setIsDebugMutationPending(true);

    try {
      const currentProgress = worldProgressService.getSnapshot();
      const nextValue = !currentProgress.flags['debug.manualTest'];

      worldProgressService.setFlag('debug.manualTest', nextValue);
      saveService.markDirty('worldProgress');
      await saveService.flushAutosave();
      await refresh();
      setMessage(`worldProgress debug.manualTest = ${String(nextValue)}`);
    } finally {
      setIsDebugMutationPending(false);
    }
  }, [refresh]);

  const handleToggleRelationshipTestPair = useCallback(async () => {
    setIsDebugMutationPending(true);

    try {
      const nextRelationshipStore = relationshipStoreService.toggleDebugRelationship();
      const relationship = nextRelationshipStore.mutualRelationships.find(item => (
        item.charIds[0] === 'friend-01' && item.charIds[1] === 'friend-02'
      ));

      saveService.markDirty('relationships');
      await saveService.flushAutosave();
      await refresh();
      setMessage(`friend-01/friend-02 relationship = ${relationship?.status ?? 'none'}`);
    } finally {
      setIsDebugMutationPending(false);
    }
  }, [refresh]);

  const handleCreateTestCharacter = useCallback(async () => {
    setIsDebugMutationPending(true);

    try {
      const record = characterProfileSaveService.upsertDebugCharacter();

      saveService.markDirty('characters');
      await saveService.flushAutosave();
      await refresh();
      setMessage(`character saved: ${record.id}`);
    } finally {
      setIsDebugMutationPending(false);
    }
  }, [refresh]);

  const handleDeleteTestCharacter = useCallback(async () => {
    setIsDebugMutationPending(true);

    try {
      characterProfileSaveService.deleteDebugCharacter();
      characterAvatarSaveService.deleteDebugAvatar();
      saveService.markDirty('characters');
      saveService.markDirty('characterAvatars');
      await saveService.flushAutosave();
      await refresh();
      setMessage('debug character and avatar deleted');
    } finally {
      setIsDebugMutationPending(false);
    }
  }, [refresh]);

  const handleWriteTestAvatar = useCallback(async () => {
    setIsDebugMutationPending(true);

    try {
      const record = characterAvatarSaveService.writeDebugAvatar();

      saveService.markDirty('characterAvatars');
      await saveService.flushAutosave();
      await refresh();
      setMessage(`avatar saved: ${record.characterId}`);
    } finally {
      setIsDebugMutationPending(false);
    }
  }, [refresh]);

  const handleCreateTestObject = useCallback(async () => {
    setIsDebugMutationPending(true);

    try {
      const record = customObjectSaveService.upsertDebugObject();

      saveService.markDirty('customObjects');
      await saveService.flushAutosave();
      await refresh();
      setMessage(`custom object saved: ${record.id}`);
    } finally {
      setIsDebugMutationPending(false);
    }
  }, [refresh]);

  const handleWriteTestObjectImage = useCallback(async () => {
    setIsDebugMutationPending(true);

    try {
      customObjectSaveService.upsertDebugObject();
      const record = customObjectImageSaveService.writeDebugImage();

      saveService.markDirty('customObjects');
      saveService.markDirty('customObjectImages');
      await saveService.flushAutosave();
      await refresh();
      setMessage(`custom object image saved: ${record.objectId}`);
    } finally {
      setIsDebugMutationPending(false);
    }
  }, [refresh]);

  const handleDeleteTestObject = useCallback(async () => {
    setIsDebugMutationPending(true);

    try {
      customObjectSaveService.deleteDebugObject();
      customObjectImageSaveService.deleteDebugImage();

      saveService.markDirty('customObjects');
      saveService.markDirty('customObjectImages');
      await saveService.flushAutosave();
      await refresh();
      setMessage('debug custom object and image deleted');
    } finally {
      setIsDebugMutationPending(false);
    }
  }, [refresh]);

  const handleExportFullSave = useCallback(async () => {
    setIsTransferPending(true);

    try {
      const packageString = await saveService.exportFullSaveString();

      setTransferText(packageString);
      await refresh();
      setMessage(`${EXPORT_SUCCESS_MESSAGE} ${formatExportStringLength(packageString)}`);
    } catch (error) {
      console.error('Full save export failed.', error);
      setMessage(getErrorMessage(error));
    } finally {
      setIsTransferPending(false);
    }
  }, [refresh]);

  const handleImportFullSave = useCallback(async () => {
    if (transferText.trim().length === 0) {
      setMessage('請先貼上完整存檔字串。');
      return;
    }

    const shouldImport = window.confirm('匯入完整存檔會覆蓋目前 IndexedDB 存檔並重新載入。確定匯入嗎？');

    if (!shouldImport) {
      return;
    }

    setIsTransferPending(true);

    try {
      const summary = await saveService.importFullSaveString(transferText);

      setMessage(`${IMPORT_RELOAD_MESSAGE} rows=${String(summary.rowCount)}`);
      window.location.reload();
    } catch (error) {
      console.error('Full save import failed.', error);
      setMessage(getErrorMessage(error));
      setIsTransferPending(false);
    }
  }, [transferText]);

  const handleExportContentPack = useCallback(async () => {
    if (!exportContentPackPreview) {
      setIsTransferPending(true);

      try {
        const preview = await saveService.previewExportableContentPack();

        setExportContentPackPreview(preview);
        setSelectedExportCharacterIds(preview.characters.map(character => character.id));
        setSelectedExportObjectIds(preview.objects.map(customObject => customObject.id));
        setMessage(createContentPackCountMessage('請確認要匯出的內容，預設已全選：', preview));
      } catch (error) {
        console.error('Content pack export preview failed.', error);
        setMessage(getErrorMessage(error));
      } finally {
        setIsTransferPending(false);
      }
      return;
    }

    if (selectedExportCharacterIds.length === 0 && selectedExportObjectIds.length === 0) {
      setMessage('請至少勾選一個要匯出的角色或物件。');
      return;
    }

    setIsTransferPending(true);

    try {
      const packageString = await saveService.exportContentPackString({
        characterIds: selectedExportCharacterIds,
        objectIds: selectedExportObjectIds,
      });
      const preview = await saveService.previewContentPackString(packageString);

      setTransferText(packageString);
      setContentPackPreview({
        packageText: packageString,
        preview,
      });
      setSelectedContentCharacterIds(preview.characters.map(character => character.id));
      setSelectedContentObjectIds(preview.objects.map(customObject => customObject.id));
      setCharacterConflictResolutions(createCharacterConflictResolutions(preview));
      setObjectConflictResolutions(createObjectConflictResolutions(preview));
      await refresh();
      setMessage(`${CONTENT_EXPORT_SUCCESS_MESSAGE} ${formatExportStringLength(packageString)}`);
    } catch (error) {
      console.error('Content pack export failed.', error);
      setMessage(getErrorMessage(error));
    } finally {
      setIsTransferPending(false);
    }
  }, [exportContentPackPreview, refresh, selectedExportCharacterIds, selectedExportObjectIds]);

  const handlePreviewExportContentPack = useCallback(async () => {
    if (exportContentPackPreview) {
      setExportContentPackPreview(null);
      setSelectedExportCharacterIds([]);
      setSelectedExportObjectIds([]);
      return;
    }

    setIsTransferPending(true);

    try {
      const preview = await saveService.previewExportableContentPack();

      setExportContentPackPreview(preview);
      setSelectedExportCharacterIds(preview.characters.map(character => character.id));
      setSelectedExportObjectIds(preview.objects.map(customObject => customObject.id));
      setMessage(createContentPackCountMessage('可匯出內容：', preview));
    } catch (error) {
      console.error('Content pack export preview failed.', error);
      setExportContentPackPreview(null);
      setSelectedExportCharacterIds([]);
      setSelectedExportObjectIds([]);
      setMessage(getErrorMessage(error));
    } finally {
      setIsTransferPending(false);
    }
  }, [exportContentPackPreview]);

  const handlePreviewContentPack = useCallback(async () => {
    if (currentContentPackPreview) {
      setContentPackPreview(null);
      setSelectedContentCharacterIds([]);
      setSelectedContentObjectIds([]);
      setCharacterConflictResolutions({});
      setObjectConflictResolutions({});
      return;
    }

    if (normalizedTransferText.length === 0) {
      setMessage('請先貼上內容包字串。');
      return;
    }

    try {
      const preview = await saveService.previewContentPackString(normalizedTransferText);

      setContentPackPreview({
        packageText: normalizedTransferText,
        preview,
      });
      setSelectedContentCharacterIds(preview.characters.map(character => character.id));
      setSelectedContentObjectIds(preview.objects.map(customObject => customObject.id));
      setCharacterConflictResolutions(createCharacterConflictResolutions(preview));
      setObjectConflictResolutions(createObjectConflictResolutions(preview));
      setMessage(createContentPackCountMessage('內容包已預覽，預設全選：', preview));
    } catch (error) {
      console.error('Content pack preview failed.', error);
      setContentPackPreview(null);
      setSelectedContentCharacterIds([]);
      setSelectedContentObjectIds([]);
      setCharacterConflictResolutions({});
      setObjectConflictResolutions({});
      setMessage(getErrorMessage(error));
    }
  }, [currentContentPackPreview, normalizedTransferText]);

  const handleImportContentPack = useCallback(async () => {
    if (normalizedTransferText.length === 0) {
      setMessage('請先貼上內容包字串。');
      return;
    }

    if (!currentContentPackPreview) {
      setMessage('請先 Preview Content，確認勾選項目後再匯入。');
      return;
    }

    if (selectedContentCharacterIds.length === 0 && selectedContentObjectIds.length === 0) {
      setMessage('請至少勾選一個角色或物件。');
      return;
    }

    setIsTransferPending(true);

    try {
      const summary = await saveService.importContentPackString(normalizedTransferText, {
        characterIds: selectedContentCharacterIds,
        objectIds: selectedContentObjectIds,
        characterConflictResolutions,
        objectConflictResolutions,
      });

      await refresh();
      setMessage(`內容包已匯入。characters=${String(summary.characterCount)}, avatars=${String(summary.avatarCount)}, objects=${String(summary.objectCount)}, images=${String(summary.imageCount)}`);
    } catch (error) {
      console.error('Content pack import failed.', error);
      setMessage(getErrorMessage(error));
    } finally {
      setIsTransferPending(false);
    }
  }, [
    characterConflictResolutions,
    currentContentPackPreview,
    normalizedTransferText,
    objectConflictResolutions,
    refresh,
    selectedContentCharacterIds,
    selectedContentObjectIds,
  ]);

  const handleTransferTextChange = useCallback((value: string) => {
    setTransferText(value);
    setContentPackPreview(null);
    setSelectedContentCharacterIds([]);
    setCharacterConflictResolutions({});
    setSelectedContentObjectIds([]);
    setObjectConflictResolutions({});
  }, []);

  const handleSelectAllContentCharacters = useCallback(() => {
    setSelectedContentCharacterIds(currentContentPackPreview?.characters.map(character => character.id) ?? []);
  }, [currentContentPackPreview]);

  const handleClearContentCharacters = useCallback(() => {
    setSelectedContentCharacterIds([]);
  }, []);

  const handleSelectAllExportCharacters = useCallback(() => {
    setSelectedExportCharacterIds(exportContentPackPreview?.characters.map(character => character.id) ?? []);
  }, [exportContentPackPreview]);

  const handleClearExportCharacters = useCallback(() => {
    setSelectedExportCharacterIds([]);
  }, []);

  const handleToggleExportCharacter = useCallback((characterId: string) => {
    setSelectedExportCharacterIds(currentCharacterIds => (
      currentCharacterIds.includes(characterId)
        ? currentCharacterIds.filter(currentCharacterId => currentCharacterId !== characterId)
        : [...currentCharacterIds, characterId]
    ));
  }, []);

  const handleToggleContentCharacter = useCallback((characterId: string) => {
    setSelectedContentCharacterIds(currentCharacterIds => (
      currentCharacterIds.includes(characterId)
        ? currentCharacterIds.filter(currentCharacterId => currentCharacterId !== characterId)
        : [...currentCharacterIds, characterId]
    ));
  }, []);

  const handleSetCharacterConflictResolution = useCallback((
    characterId: string,
    resolution: ContentPackConflictResolution,
  ) => {
    setCharacterConflictResolutions(currentResolutions => ({
      ...currentResolutions,
      [characterId]: resolution,
    }));
  }, []);

  const handleSelectAllExportObjects = useCallback(() => {
    setSelectedExportObjectIds(exportContentPackPreview?.objects.map(customObject => customObject.id) ?? []);
  }, [exportContentPackPreview]);

  const handleClearExportObjects = useCallback(() => {
    setSelectedExportObjectIds([]);
  }, []);

  const handleToggleExportObject = useCallback((objectId: string) => {
    setSelectedExportObjectIds(currentObjectIds => (
      currentObjectIds.includes(objectId)
        ? currentObjectIds.filter(currentObjectId => currentObjectId !== objectId)
        : [...currentObjectIds, objectId]
    ));
  }, []);

  const handleSelectAllContentObjects = useCallback(() => {
    setSelectedContentObjectIds(currentContentPackPreview?.objects.map(customObject => customObject.id) ?? []);
  }, [currentContentPackPreview]);

  const handleClearContentObjects = useCallback(() => {
    setSelectedContentObjectIds([]);
  }, []);

  const handleToggleContentObject = useCallback((objectId: string) => {
    setSelectedContentObjectIds(currentObjectIds => (
      currentObjectIds.includes(objectId)
        ? currentObjectIds.filter(currentObjectId => currentObjectId !== objectId)
        : [...currentObjectIds, objectId]
    ));
  }, []);

  const handleSetObjectConflictResolution = useCallback((
    objectId: string,
    resolution: ContentPackConflictResolution,
  ) => {
    setObjectConflictResolutions(currentResolutions => ({
      ...currentResolutions,
      [objectId]: resolution,
    }));
  }, []);

  const handleReset = useCallback(async () => {
    const shouldReset = window.confirm('確定要刪除 IndexedDB 存檔並重新載入嗎？');

    if (!shouldReset) {
      return;
    }

    await saveService.resetGameSave();
    window.location.reload();
  }, []);

  return (
    <aside className={styles.panel} aria-label="Save debug panel">
      <header className={styles.header}>
        <div>
          <div className={styles.kicker}>IndexedDB</div>
          <h2 className={styles.title}>Save Debug</h2>
        </div>
        <button className={styles.iconButton} type="button" onClick={onClose} aria-label="關閉存檔除錯面板">
          x
        </button>
      </header>

      <p className={styles.warning}>
        本遊戲資料儲存在此瀏覽器本機。清除網站資料、隱私模式、裝置空間不足或瀏覽器策略都可能導致存檔遺失，請定期備份。
      </p>

      <section className={styles.storageSection} aria-label="Browser storage status">
        <StatusRow label="Usage" value={formatStorageUsage(storageStatus)} />
        <StatusRow label="Persistent" value={formatPersistence(storageStatus)} />
        <div className={styles.actionRow}>
          <button className={styles.secondaryButton} type="button" onClick={refresh} disabled={isLoading}>
            {isLoading ? 'Refreshing' : 'Refresh'}
          </button>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={handleRequestPersistence}
            disabled={!storageStatus?.isPersistenceSupported}
          >
            保護本地存檔
          </button>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={handleToggleWorldTestFlag}
            disabled={isDebugMutationPending}
          >
            Toggle World Flag
          </button>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={handleToggleRelationshipTestPair}
            disabled={isDebugMutationPending}
          >
            Toggle Relationship
          </button>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={handleCreateTestCharacter}
            disabled={isDebugMutationPending}
          >
            Create Test Character
          </button>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={handleWriteTestAvatar}
            disabled={isDebugMutationPending}
          >
            Write Test Avatar
          </button>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={handleDeleteTestCharacter}
            disabled={isDebugMutationPending}
          >
            Delete Test Character
          </button>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={handleCreateTestObject}
            disabled={isDebugMutationPending}
          >
            Create Test Object
          </button>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={handleWriteTestObjectImage}
            disabled={isDebugMutationPending}
          >
            Write Test Object Image
          </button>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={handleDeleteTestObject}
            disabled={isDebugMutationPending}
          >
            Delete Test Object
          </button>
          <button className={styles.dangerButton} type="button" onClick={handleReset}>
            Reset DB
          </button>
        </div>
        <div className={styles.transferBlock}>
          <div className={styles.actionRow}>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={handleExportFullSave}
              disabled={isTransferPending}
            >
              Export Full Save
            </button>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={handleImportFullSave}
              disabled={isTransferPending || transferText.trim().length === 0}
            >
              Import Full Save
            </button>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={handlePreviewExportContentPack}
              disabled={isTransferPending}
            >
              {exportContentPackPreview ? 'Close Export Content' : 'Choose Export Content'}
            </button>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={handlePreviewContentPack}
              disabled={isTransferPending || normalizedTransferText.length === 0}
            >
              {currentContentPackPreview ? 'Close Preview Content' : 'Preview Content'}
            </button>
          </div>
          {exportContentPackPreview ? (
            <div className={styles.contentPackPreview}>
              <div className={styles.previewHeader}>
                <strong>Export Content</strong>
                <span>
                  {selectedExportCharacterIds.length} / {exportContentPackPreview.characters.length} characters · {selectedExportObjectIds.length} / {exportContentPackPreview.objects.length} objects
                </span>
              </div>
              <div className={styles.actionRow}>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={handleExportContentPack}
                  disabled={isTransferPending || (selectedExportCharacterIds.length === 0 && selectedExportObjectIds.length === 0)}
                >
                  Export Content
                </button>
              </div>
              {exportContentPackPreview.characters.length > 0 ? (
                <>
                  <div className={styles.previewHeader}>
                    <strong>Characters</strong>
                    <span>{selectedExportCharacterIds.length} / {exportContentPackPreview.characters.length}</span>
                  </div>
                  <div className={styles.actionRow}>
                    <button
                      className={styles.secondaryButton}
                      type="button"
                      onClick={handleSelectAllExportCharacters}
                      disabled={selectedExportCharacterIds.length === exportContentPackPreview.characters.length}
                    >
                      Select All Characters
                    </button>
                    <button
                      className={styles.secondaryButton}
                      type="button"
                      onClick={handleClearExportCharacters}
                      disabled={selectedExportCharacterIds.length === 0}
                    >
                      Clear Characters
                    </button>
                  </div>
                  <div className={styles.characterImportList}>
                    {exportContentPackPreview.characters.map(character => (
                      <label className={styles.characterImportRow} key={character.id}>
                        <input
                          type="checkbox"
                          checked={selectedExportCharacterIdSet.has(character.id)}
                          onChange={() => handleToggleExportCharacter(character.id)}
                        />
                        <span>
                          <strong>{character.name}</strong>
                          <small>{character.id} · {character.source} · avatar={character.hasAvatar ? 'yes' : 'no'}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                </>
              ) : null}
              {exportContentPackPreview.objects.length > 0 ? (
                <>
                  <div className={styles.previewHeader}>
                    <strong>Objects</strong>
                    <span>{selectedExportObjectIds.length} / {exportContentPackPreview.objects.length}</span>
                  </div>
                  <div className={styles.actionRow}>
                    <button
                      className={styles.secondaryButton}
                      type="button"
                      onClick={handleSelectAllExportObjects}
                      disabled={selectedExportObjectIds.length === exportContentPackPreview.objects.length}
                    >
                      Select All Objects
                    </button>
                    <button
                      className={styles.secondaryButton}
                      type="button"
                      onClick={handleClearExportObjects}
                      disabled={selectedExportObjectIds.length === 0}
                    >
                      Clear Objects
                    </button>
                  </div>
                  <div className={styles.characterImportList}>
                    {exportContentPackPreview.objects.map(customObject => (
                      <label className={styles.characterImportRow} key={customObject.id}>
                        <input
                          type="checkbox"
                          checked={selectedExportObjectIdSet.has(customObject.id)}
                          onChange={() => handleToggleExportObject(customObject.id)}
                        />
                        <span>
                          <strong>{customObject.name}</strong>
                          <small>{customObject.id} · {customObject.source} · origin={customObject.originKind} · image={customObject.hasImage ? 'yes' : 'no'}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
          <textarea
            className={styles.transferTextarea}
            value={transferText}
            onChange={event => handleTransferTextChange(event.target.value)}
            spellCheck={false}
            placeholder="Full save or content pack string"
          />
          {currentContentPackPreview ? (
            <div className={styles.contentPackPreview}>
              <div className={styles.previewHeader}>
                <strong>Preview Content</strong>
                <span>
                  {selectedContentCharacterIds.length} / {currentContentPackPreview.characters.length} characters · {selectedContentObjectIds.length} / {currentContentPackPreview.objects.length} objects
                </span>
              </div>
              <div className={styles.actionRow}>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={handleImportContentPack}
                  disabled={isTransferPending || (selectedContentCharacterIds.length === 0 && selectedContentObjectIds.length === 0)}
                >
                  Import Content
                </button>
              </div>
              {currentContentPackPreview.characters.length > 0 ? (
                <>
                  <div className={styles.previewHeader}>
                    <strong>Characters</strong>
                    <span>{selectedContentCharacterIds.length} / {currentContentPackPreview.characters.length}</span>
                  </div>
                  <div className={styles.actionRow}>
                    <button
                      className={styles.secondaryButton}
                      type="button"
                      onClick={handleSelectAllContentCharacters}
                      disabled={selectedContentCharacterIds.length === currentContentPackPreview.characters.length}
                    >
                      Select All Characters
                    </button>
                    <button
                      className={styles.secondaryButton}
                      type="button"
                      onClick={handleClearContentCharacters}
                      disabled={selectedContentCharacterIds.length === 0}
                    >
                      Clear Characters
                    </button>
                  </div>
                  <div className={styles.characterImportList}>
                    {currentContentPackPreview.characters.map(character => (
                      <label className={styles.characterImportRow} key={character.id}>
                        <input
                          type="checkbox"
                          checked={selectedContentCharacterIdSet.has(character.id)}
                          onChange={() => handleToggleContentCharacter(character.id)}
                        />
                        <span>
                          <strong>{character.name}</strong>
                          <small>{character.id} · {character.source} · avatar={character.hasAvatar ? 'yes' : 'no'} · conflict={character.hasConflict ? 'yes' : 'no'}</small>
                          {character.hasConflict ? (
                            <select
                              className={styles.conflictSelect}
                              value={characterConflictResolutions[character.id] ?? 'newId'}
                              onChange={event => handleSetCharacterConflictResolution(
                                character.id,
                                event.target.value as ContentPackConflictResolution,
                              )}
                            >
                              <option value="newId">Save as new id</option>
                              <option value="overwrite">Overwrite</option>
                            </select>
                          ) : null}
                        </span>
                      </label>
                    ))}
                  </div>
                </>
              ) : null}
              {currentContentPackPreview.objects.length > 0 ? (
                <>
                  <div className={styles.previewHeader}>
                    <strong>Objects</strong>
                    <span>{selectedContentObjectIds.length} / {currentContentPackPreview.objects.length}</span>
                  </div>
                  <div className={styles.actionRow}>
                    <button
                      className={styles.secondaryButton}
                      type="button"
                      onClick={handleSelectAllContentObjects}
                      disabled={selectedContentObjectIds.length === currentContentPackPreview.objects.length}
                    >
                      Select All Objects
                    </button>
                    <button
                      className={styles.secondaryButton}
                      type="button"
                      onClick={handleClearContentObjects}
                      disabled={selectedContentObjectIds.length === 0}
                    >
                      Clear Objects
                    </button>
                  </div>
                  <div className={styles.characterImportList}>
                    {currentContentPackPreview.objects.map(customObject => (
                      <label className={styles.characterImportRow} key={customObject.id}>
                        <input
                          type="checkbox"
                          checked={selectedContentObjectIdSet.has(customObject.id)}
                          onChange={() => handleToggleContentObject(customObject.id)}
                        />
                        <span>
                          <strong>{customObject.name}</strong>
                          <small>{customObject.id} · {customObject.source} · origin={customObject.originKind} · image={customObject.hasImage ? 'yes' : 'no'} · conflict={customObject.hasConflict ? 'yes' : 'no'}</small>
                          {customObject.hasConflict ? (
                            <select
                              className={styles.conflictSelect}
                              value={objectConflictResolutions[customObject.id] ?? 'newId'}
                              onChange={event => handleSetObjectConflictResolution(
                                customObject.id,
                                event.target.value as ContentPackConflictResolution,
                              )}
                            >
                              <option value="newId">Save as new id</option>
                              <option value="overwrite">Overwrite</option>
                            </select>
                          ) : null}
                        </span>
                      </label>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
        {message ? <div className={styles.message}>{message}</div> : null}
      </section>

      <div className={styles.contentGrid}>
        <nav className={styles.tableList} aria-label="Save tables">
          {snapshot?.tables.map(table => (
            <button
              key={table.table}
              className={table.table === selectedTable ? styles.activeTableButton : styles.tableButton}
              type="button"
              onClick={() => setSelectedTable(table.table)}
            >
              <span>{table.table}</span>
              <strong>{table.count}</strong>
            </button>
          ))}
        </nav>

        <section className={styles.tableDetail} aria-label={`${selectedTable} debug data`}>
          <TableSchema schema={selectedSchema} />
          {selectedTableSnapshot ? (
            <>
              <div className={styles.detectedFields}>
                <strong>Fields</strong>
                <span>{selectedTableSnapshot.detectedFields.join(', ') || '-'}</span>
              </div>
              <pre className={styles.jsonPreview}>
                {JSON.stringify(selectedTableSnapshot.rows, null, 2)}
              </pre>
            </>
          ) : (
            <div className={styles.emptyState}>No table selected.</div>
          )}
        </section>
      </div>
    </aside>
  );
}

function TableSchema({ schema }: { schema: SaveTableSchemaSummary | null }) {
  if (!schema) {
    return null;
  }

  return (
    <div className={styles.schemaBlock}>
      <StatusRow label="Primary key" value={schema.primaryKey} />
      <StatusRow label="Indexes" value={schema.indexes.join(', ') || '-'} />
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.statusRow}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatStorageUsage(status: BrowserStorageStatus | null): string {
  if (!status || status.usage === null || status.quota === null) {
    return 'unknown';
  }

  return `${formatBytes(status.usage)} / ${formatBytes(status.quota)}`;
}

function formatPersistence(status: BrowserStorageStatus | null): string {
  if (!status || status.isPersisted === null) {
    return 'unknown';
  }

  return status.isPersisted ? 'yes' : 'no';
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatExportStringLength(value: string): string {
  return `${value.length.toLocaleString()} chars`;
}

function createContentPackCountMessage(
  prefix: string,
  preview: CombinedContentPackPreview,
): string {
  return `${prefix}${String(preview.characters.length)} 個角色、${String(preview.objects.length)} 個物件。`;
}

function createCharacterConflictResolutions(
  preview: CombinedContentPackPreview,
): Record<string, ContentPackConflictResolution> {
  return Object.fromEntries(
    preview.characters
      .filter(character => character.hasConflict)
      .map(character => [character.id, 'newId' as const]),
  );
}

function createObjectConflictResolutions(
  preview: CombinedContentPackPreview,
): Record<string, ContentPackConflictResolution> {
  return Object.fromEntries(
    preview.objects
      .filter(customObject => customObject.hasConflict)
      .map(customObject => [customObject.id, 'newId' as const]),
  );
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '存檔操作失敗。';
}
