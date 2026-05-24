import type { ItemSavePort } from '~/services/items/itemSavePort';
import type { ItemStoreSnapshot } from '~/services/items/itemStore';
import { saveDb } from '../saveDb';
import { normalizeItemSaveRecord } from '../saveNormalizer';

export class IndexedDbItemSavePort implements ItemSavePort {
  async loadItemSnapshot(): Promise<ItemStoreSnapshot | null> {
    const record = normalizeItemSaveRecord(await saveDb.items.get('current'));

    return record.snapshot;
  }

  async saveItemSnapshot(snapshot: ItemStoreSnapshot): Promise<void> {
    await saveDb.items.put({
      id: 'current',
      snapshot,
      updatedAt: Date.now(),
    });
  }
}
