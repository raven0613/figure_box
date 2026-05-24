import type { BrowserStorageStatus } from './saveTypes';

export async function getBrowserStorageStatus(): Promise<BrowserStorageStatus> {
  const storageManager = navigator.storage;

  if (!storageManager) {
    return {
      usage: null,
      quota: null,
      isPersisted: null,
      isPersistenceSupported: false,
    };
  }

  const [estimate, isPersisted] = await Promise.all([
    storageManager.estimate?.() ?? Promise.resolve({ usage: undefined, quota: undefined }),
    storageManager.persisted?.() ?? Promise.resolve(null),
  ]);

  return {
    usage: typeof estimate.usage === 'number' ? estimate.usage : null,
    quota: typeof estimate.quota === 'number' ? estimate.quota : null,
    isPersisted,
    isPersistenceSupported: typeof storageManager.persist === 'function',
  };
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) {
    return false;
  }

  return navigator.storage.persist();
}
