export type ItemDefinitionId = string;
export type ItemInstanceId = string;
export type ActorId = string;
export type MapId = string;
export type MapObjectId = string;
export type ShopId = string;

export type ItemType =
  | 'generic'
  | 'consumable'
  | 'tool'
  | 'wearable'
  | 'placeable'
  | 'material'
  | 'keyItem'
  | (string & {});

export type ItemCategory =
  | 'food'
  | 'drink'
  | 'clothing'
  | 'accessory'
  | 'furniture'
  | 'decoration'
  | 'tool'
  | 'material'
  | 'gem'
  | 'collectible'
  | 'story'
  | 'misc'
  | (string & {});

export type ItemRarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary'
  | 'special'
  | (string & {});

export type ItemTag = string;

export type ItemState =
  | 'stored'
  | 'held'
  | 'equipped'
  | 'placed'
  | 'shopStock'
  | 'transferring'
  | 'consumed';

export type InventoryGroupId = string;
export type EquipmentSlotId = string;
export type ActorAttachPointId = string;

export type PlacementSurfaceType =
  | 'floor'
  | 'wall'
  | 'tabletop'
  | 'objectSurface'
  | (string & {});

export type PlacementAnchor = 'center' | 'bottomCenter';

export type ItemTransferReason =
  | 'gift'
  | 'purchase'
  | 'reward'
  | 'found'
  | 'crafted'
  | 'system'
  | (string & {});

export interface ItemDefinition {
  id: ItemDefinitionId;
  nameKey: string;
  descriptionKey?: string;
  type: ItemType;
  category: ItemCategory;
  tags: readonly ItemTag[];
  rarity: ItemRarity;
  stackable: boolean;
  maxStack?: number;
  basePrice?: number;
  visual: ItemVisualDefinition;
  placement?: ItemPlacementDefinition;
  equipment?: ItemEquipmentDefinition;
}

export interface ItemVisualDefinition {
  assetId: string;
  visibleOnCharacter?: boolean;
  scale?: ItemVisualScale;
  heldOffset?: ItemPosition;
}

export interface ItemVisualScale {
  icon?: number;
  held?: number;
  placed?: number;
  equipped?: number;
}

export interface ItemPlacementDefinition {
  surfaceTypes: readonly PlacementSurfaceType[];
  size: ItemPlacementSize;
  anchor: PlacementAnchor;
}

export interface ItemPlacementSize {
  width: number;
  height: number;
}

export interface ItemEquipmentDefinition {
  slot: EquipmentSlotId;
  attachPointId?: ActorAttachPointId;
  localOffset?: ItemPosition;
}

export interface ItemInstance {
  id: ItemInstanceId;
  definitionId: ItemDefinitionId;
  ownerActorId?: ActorId;
  state: ItemState;
  quantity: number;
  transferHistory?: readonly ItemTransferHistoryEntry[];
  customName?: string;
  metadata?: Record<string, unknown>;
}

export interface ActorInventory {
  actorId: ActorId;
  itemInstanceIds: readonly ItemInstanceId[];
}

export interface ItemTransferHistoryEntry {
  fromActorId?: ActorId;
  toActorId?: ActorId;
  reason: ItemTransferReason;
  day: number;
  quantity: number;
  timeOfDay?: string;
}

export interface EquippedItem {
  actorId: ActorId;
  slot: EquipmentSlotId;
  itemInstanceId: ItemInstanceId;
  attachPointId?: ActorAttachPointId;
  localOffset?: ItemPosition;
}

export interface PlacedObject {
  id: MapObjectId;
  itemInstanceId: ItemInstanceId;
  mapId: MapId;
  parentObjectId?: MapObjectId;
  surfaceType: PlacementSurfaceType;
  worldPosition?: ItemPosition;
  localPosition?: ItemPosition;
  layer?: string;
}

export interface HeldItem {
  actorId: ActorId;
  itemInstanceId: ItemInstanceId;
  attachPointId?: ActorAttachPointId;
  localOffset?: ItemPosition;
}

export interface ShopStockItem {
  id: string;
  shopId: ShopId;
  definitionId: ItemDefinitionId;
  price?: number;
  stock: number;
  generatedAtDay: number;
}

export interface ItemPosition {
  x: number;
  y: number;
}

export interface ItemMatch {
  itemIds?: readonly ItemDefinitionId[];
  types?: readonly ItemType[];
  categories?: readonly ItemCategory[];
  tagsAnyOf?: readonly ItemTag[];
  tagsAllOf?: readonly ItemTag[];
  tagsNoneOf?: readonly ItemTag[];
  rarities?: readonly ItemRarity[];
  minRarity?: ItemRarity;
  actorPreference?: boolean;
}

export interface InventoryGroupRule {
  id: InventoryGroupId;
  labelKey: string;
  match: ItemMatch;
}
