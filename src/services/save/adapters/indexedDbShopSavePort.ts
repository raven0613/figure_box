import type { ShopSavePort } from '~/services/items/shopSavePort';
import type { ShopStoreSnapshot } from '../saveTypes';
import { saveDb } from '../saveDb';
import { normalizeShopSaveRecord } from '../saveNormalizer';

export class IndexedDbShopSavePort implements ShopSavePort {
  async loadShopSnapshot(): Promise<ShopStoreSnapshot | null> {
    const record = normalizeShopSaveRecord(await saveDb.shops.get('current'));

    return record.snapshot;
  }

  async saveShopSnapshot(snapshot: ShopStoreSnapshot): Promise<void> {
    await saveDb.shops.put({
      id: 'current',
      snapshot,
      updatedAt: Date.now(),
    });
  }
}
