import type { ShopStoreSnapshot } from '~/services/save/saveTypes';

export interface ShopSavePort {
  loadShopSnapshot(): Promise<ShopStoreSnapshot | null>;
  saveShopSnapshot(snapshot: ShopStoreSnapshot): Promise<void>;
}

export class EmptyShopSavePort implements ShopSavePort {
  async loadShopSnapshot(): Promise<ShopStoreSnapshot | null> {
    return null;
  }

  async saveShopSnapshot(): Promise<void> {
    return;
  }
}
