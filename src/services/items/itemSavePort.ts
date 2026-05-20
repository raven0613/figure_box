import type { ItemStoreSnapshot } from './itemStore';

export interface ItemSavePort {
  loadItemSnapshot(): Promise<ItemStoreSnapshot | null>;
  saveItemSnapshot(snapshot: ItemStoreSnapshot): Promise<void>;
}

export class EmptyItemSavePort implements ItemSavePort {
  async loadItemSnapshot(): Promise<ItemStoreSnapshot | null> {
    return null;
  }

  async saveItemSnapshot(): Promise<void> {
    return;
  }
}
