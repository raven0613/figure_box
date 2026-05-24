import type {
  ActorId,
  ItemInstanceId,
  ShopId,
  ShopStockItem,
} from '~/typing/item';
import { IndexedDbShopSavePort } from '~/services/save/adapters/indexedDbShopSavePort';
import type { ShopStoreSnapshot } from '~/services/save/saveTypes';
import { itemService, type ItemService } from './itemService';
import { EmptyShopSavePort, type ShopSavePort } from './shopSavePort';

export interface PurchaseShopItemInput {
  shopId: ShopId;
  stockItemId: string;
  buyerActorId: ActorId;
  day: number;
}

export interface PurchaseShopItemResult {
  stockItem: ShopStockItem;
  itemInstanceId: ItemInstanceId;
}

const DEFAULT_SHOP_ID = 'south-green-item-shop';

const DEFAULT_DAILY_STOCK: readonly Omit<ShopStockItem, 'generatedAtDay'>[] = [
  {
    id: 'south-shop-apple',
    shopId: DEFAULT_SHOP_ID,
    definitionId: 'apple',
    price: 20,
    stock: 5,
  },
  {
    id: 'south-shop-clear-gem',
    shopId: DEFAULT_SHOP_ID,
    definitionId: 'clear_gem',
    price: 80,
    stock: 2,
  },
  {
    id: 'south-shop-silver-bracelet',
    shopId: DEFAULT_SHOP_ID,
    definitionId: 'silver_bracelet',
    price: 180,
    stock: 1,
  },
];

export class ShopService {
  private readonly items: ItemService;
  private readonly savePort: ShopSavePort;
  private readonly stockById = new Map<string, ShopStockItem>();

  constructor(items: ItemService = itemService, savePort: ShopSavePort = new EmptyShopSavePort()) {
    this.items = items;
    this.savePort = savePort;
    this.loadDefaultDailyStock(1);
  }

  async load(): Promise<void> {
    const snapshot = await this.savePort.loadShopSnapshot();

    if (snapshot && snapshot.stockItems.length > 0) {
      this.loadSnapshot(snapshot);
    }
  }

  async save(): Promise<void> {
    await this.savePort.saveShopSnapshot(this.getSnapshot());
  }

  loadSnapshot(snapshot: ShopStoreSnapshot): void {
    this.stockById.clear();

    snapshot.stockItems.forEach(stockItem => {
      this.stockById.set(stockItem.id, stockItem);
    });
  }

  getSnapshot(): ShopStoreSnapshot {
    return {
      stockItems: Array.from(this.stockById.values()),
    };
  }

  getStock(shopId: ShopId): readonly ShopStockItem[] {
    return Array.from(this.stockById.values())
      .filter(stockItem => stockItem.shopId === shopId)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  purchaseItem(input: PurchaseShopItemInput): PurchaseShopItemResult {
    const stockItem = this.stockById.get(input.stockItemId);

    if (!stockItem || stockItem.shopId !== input.shopId) {
      throw new Error(`Shop stock item "${input.stockItemId}" does not exist in shop "${input.shopId}".`);
    }

    if (stockItem.stock <= 0) {
      throw new Error(`Shop stock item "${input.stockItemId}" is sold out.`);
    }

    this.items.getDefinitionOrThrow(stockItem.definitionId);
    const nextStockItem = {
      ...stockItem,
      stock: stockItem.stock - 1,
    };

    this.stockById.set(stockItem.id, nextStockItem);
    const itemInstance = this.items.createItemInstance({
      definitionId: stockItem.definitionId,
      ownerActorId: input.buyerActorId,
      quantity: 1,
      reason: 'purchase',
      day: input.day,
    });

    return {
      stockItem: nextStockItem,
      itemInstanceId: itemInstance.id,
    };
  }

  private loadDefaultDailyStock(day: number): void {
    DEFAULT_DAILY_STOCK.forEach(stockItem => {
      this.stockById.set(stockItem.id, {
        ...stockItem,
        generatedAtDay: day,
      });
    });
  }
}

export const DEFAULT_ITEM_SHOP_ID = DEFAULT_SHOP_ID;
export const shopService = new ShopService(itemService, new IndexedDbShopSavePort());
