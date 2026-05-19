export type TerrainType = 'grass' | 'road' | 'plaza' | 'water' | 'building' | 'garden';

export interface InteractableObjectData {
  id: string;
  type: 'well' | 'marketStall' | 'sign' | 'door' | 'tree' | 'lamp' | 'ground';
  label: string;
}

export type TownMapObjectType =
  | InteractableObjectData['type']
  | 'chair'
  | 'table'
  | 'bookcase'
  | 'statue'
  | 'noticeBoard'
  | 'gate'
  | 'apartment';

export type TownMapObjectLayer = 'floorObject' | 'wallObject' | 'decoration';

export interface TownMapObjectData {
  id: string;
  type: TownMapObjectType;
  label: string;
  x: number;
  y: number;
  width: number;
  length: number;
  height: number;
  layer: TownMapObjectLayer;
  blocksMovement: boolean;
  interactable: boolean;
}

export interface TownMapCellData {
  walkable: boolean;
  terrain: TerrainType;
  occupantId: string | null;
  interactableObject: InteractableObjectData | null;
}

const grass = (): TownMapCellData => ({
  walkable: true,
  terrain: 'grass',
  occupantId: null,
  interactableObject: null,
});

const road = (occupantId: string | null = null): TownMapCellData => ({
  walkable: true,
  terrain: 'road',
  occupantId,
  interactableObject: null,
});

const plaza = (interactableObject: InteractableObjectData | null = null): TownMapCellData => ({
  walkable: true,
  terrain: 'plaza',
  occupantId: null,
  interactableObject,
});

const water = (): TownMapCellData => ({
  walkable: false,
  terrain: 'water',
  occupantId: null,
  interactableObject: null,
});

const building = (interactableObject: InteractableObjectData | null = null): TownMapCellData => ({
  walkable: false,
  terrain: 'building',
  occupantId: null,
  interactableObject,
});

const garden = (interactableObject: InteractableObjectData | null = null): TownMapCellData => ({
  walkable: true,
  terrain: 'garden',
  occupantId: null,
  interactableObject,
});

export const TOWN_MAP_WIDTH = 70;
export const TOWN_MAP_HEIGHT = 70;

export interface Destination {
  readonly name: string;
  readonly serviceTiles: readonly { readonly x: number; readonly y: number }[];
}

export interface TownMapFloorDecorationData {
  id: string;
  type: 'tilePattern';
  label: string;
  x: number;
  y: number;
  width: number;
  length: number;
}

export const TOWN_MAP_FLOOR_DECORATIONS: readonly TownMapFloorDecorationData[] = [
  {
    id: 'central-plaza-tile-pattern',
    type: 'tilePattern',
    label: '中央廣場地磚',
    x: 37,
    y: 18,
    width: 16,
    length: 12,
  },
];

export const DESTINATION_MAP: Record<string, readonly Destination[]> = {
  findFood: [
    { name: '披薩店', serviceTiles: [{ x: 39, y: 4 }, { x: 40, y: 4 }, { x: 41, y: 4 }] },
    { name: '麵包店', serviceTiles: [{ x: 2, y: 41 }, { x: 3, y: 41 }, { x: 4, y: 41 }] },
    { name: '手搖店', serviceTiles: [{ x: 2, y: 43 }, { x: 3, y: 43 }, { x: 4, y: 43 }] },
    { name: '燒烤店', serviceTiles: [{ x: 28, y: 63 }, { x: 29, y: 63 }, { x: 30, y: 63 }] },
    { name: '壽司店', serviceTiles: [{ x: 65, y: 48 }, { x: 66, y: 48 }, { x: 67, y: 48 }] },
    { name: '牛排館', serviceTiles: [{ x: 8, y: 41 }, { x: 9, y: 41 }, { x: 10, y: 41 }] },
    { name: '火鍋店', serviceTiles: [{ x: 3, y: 66 }, { x: 4, y: 66 }, { x: 5, y: 66 }] },
  ],
  play: [
    { name: '中央廣場', serviceTiles: [{ x: 45, y: 22 }, { x: 46, y: 22 }, { x: 45, y: 23 }] },
    { name: '公園', serviceTiles: [{ x: 18, y: 8 }, { x: 19, y: 8 }, { x: 20, y: 8 }] },
    { name: '露天桌', serviceTiles: [{ x: 5, y: 48 }, { x: 8, y: 48 }, { x: 7, y: 50 }] },
  ],
};

export const TOWN_APARTMENT_ENTRANCE_TILES: readonly { readonly x: number; readonly y: number }[] = [
  { x: 62, y: 10 },
  { x: 63, y: 10 },
  { x: 64, y: 10 },
];

export const TOWN_WORLD_SPACE_ID = 'world.main';
export const TOWN_APARTMENT_SPACE_ID = 'apartment.201';
export const TOWN_APARTMENT_OBJECT_ID = 'town-residence-apartment';

export const TOWN_MAP_OBJECTS: readonly TownMapObjectData[] = [
  {
    id: TOWN_APARTMENT_OBJECT_ID,
    type: 'apartment',
    label: '大家的公寓',
    x: 58,
    y: 0,
    width: 12,
    length: 12,
    height: 12,
    layer: 'wallObject',
    blocksMovement: false,
    // blocksMovement: true,
    interactable: true,
  },
  {
    id: 'test-tall-bookcase',
    type: 'bookcase',
    label: '高書櫃',
    x: 21,
    y: 20,
    width: 2,
    length: 4,
    height: 4,
    layer: 'wallObject',
    blocksMovement: true,
    interactable: true,
  },
  {
    id: 'test-town-statue',
    type: 'statue',
    label: '廣場雕像',
    x: 43,
    y: 21,
    width: 2,
    length: 3,
    height: 3,
    layer: 'decoration',
    blocksMovement: true,
    interactable: true,
  },
  {
    id: 'test-market-gate',
    type: 'gate',
    label: '市集門架',
    x: 43,
    y: 5,
    width: 5,
    length: 3,
    height: 3,
    layer: 'decoration',
    blocksMovement: false,
    interactable: false,
  },
  {
    id: 'test-cafe-table',
    type: 'table',
    label: '露天桌',
    x: 6,
    y: 48,
    width: 2,
    length: 2,
    height: 2,
    layer: 'floorObject',
    blocksMovement: true,
    interactable: true,
  },
  {
    id: 'test-cafe-chair-a',
    type: 'chair',
    label: '露天椅 A',
    x: 5,
    y: 49,
    width: 1,
    length: 2,
    height: 2,
    layer: 'floorObject',
    blocksMovement: true,
    interactable: true,
  },
  {
    id: 'test-cafe-chair-b',
    type: 'chair',
    label: '露天椅 B',
    x: 8,
    y: 49,
    width: 1,
    length: 2,
    height: 2,
    layer: 'floorObject',
    blocksMovement: true,
    interactable: true,
  },
  {
    id: 'test-school-board',
    type: 'noticeBoard',
    label: '校園公告板',
    x: 63,
    y: 40,
    width: 2,
    length: 3,
    height: 3,
    layer: 'wallObject',
    blocksMovement: true,
    interactable: true,
  },
  {
    id: 'test-tree',
    type: 'tree',
    label: '樹',
    x: 0,
    y: 0,
    width: 3,
    length: 3,
    height: 3,
    layer: 'decoration',
    blocksMovement: true,
    interactable: true,
  },
  {
    id: 'test-streetlight',
    type: 'lamp',
    label: '燈',
    x: 0,
    y: 0,
    width: 1,
    length: 1,
    height: 3,
    layer: 'decoration',
    blocksMovement: true,
    interactable: true,
  },
];

// 70x70 town map. Roads are 4 cells wide. Blocks separated by road grid.
export const TOWN_MAP_GRID: TownMapCellData[][] = [
  [building(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building(), road(), road(), road(), road(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), road(), road(), road(), road(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), road(), road(), road(), road(), building(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building()],
  [building(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building(), road(), road(), road(), road(), garden(), garden({ id: 'park-tree-1', type: 'tree', label: '公園樹' }), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden({ id: 'park-tree-2', type: 'tree', label: '公園樹' }), garden(), road(), road(), road(), road(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), road(), road(), road(), road(), building(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building()],
  [building(), building(), building({ id: 'nw-house-1-door', type: 'door', label: '民宅A' }), building(), building(), building(), grass(), building(), building(), building({ id: 'nw-house-2-door', type: 'door', label: '民宅B' }), building(), building(), building(), road(), road(), road(), road(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), road(), road(), road(), road(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), road(), road(), road(), road(), building(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building()],
  [grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), road(), road(), road(), road(), garden(), garden(), garden(), garden(), garden(), water(), water(), water(), water(), water(), water(), garden(), garden(), garden(), garden(), garden(), road(), road(), road(), road(), building(), building(), building({ id: 'pizza-door', type: 'door', label: '披薩店' }), building({ id: 'pizza-door-2', type: 'door', label: '披薩店' }), building({ id: 'pizza-door-3', type: 'door', label: '披薩店' }), grass(), building(), building(), building({ id: 'clothing-door', type: 'door', label: '服飾店' }), building(), building(), grass(), building(), building({ id: 'bookstore-door', type: 'door', label: '書店' }), building(), building(), road(), road(), road(), road(), building(), building(), building(), building({ id: 'ne-house-1-door', type: 'door', label: '民宅C' }), building(), building(), grass(), building(), building(), building({ id: 'ne-house-2-door', type: 'door', label: '民宅D' }), building(), building(), building()],
  [building(), building(), building(), building(), building(), grass(), grass(), grass(), building(), building(), building(), building(), building(), road(), road(), road(), road(), garden(), garden(), garden(), garden(), garden(), water(), water(), water(), water(), water(), water(), garden(), garden(), garden(), garden(), garden(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass()],
  [building(), building(), building(), building(), building(), grass(), grass(), grass(), building(), building(), building(), building(), building(), road(), road(), road(), road(), garden(), garden(), garden(), garden(), garden(), water(), water(), water(), water(), water(), water(), garden(), garden(), garden(), garden(), garden(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza({ id: 'fruit-stall', type: 'marketStall', label: '水果攤' }), plaza(), plaza(), plaza(), plaza(), plaza(), plaza({ id: 'flower-stall', type: 'marketStall', label: '花攤' }), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building(), building()],
  [building(), building(), building(), building(), building(), grass(), grass(), grass(), building(), building(), building(), building(), building(), road(), road(), road(), road(), garden(), garden(), garden(), garden({ id: 'park-lamp-1', type: 'lamp', label: '公園燈' }), garden(), water(), water(), water(), water(), water(), water(), garden(), garden({ id: 'park-lamp-2', type: 'lamp', label: '公園燈' }), garden(), garden(), garden(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building(), building()],
  [grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), road(), road(), road(), road(), garden(), garden(), garden(), garden(), garden(), water(), water(), water(), water(), water(), water(), garden(), garden(), garden(), garden(), garden(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building(), building()],
  [building(), building(), building(), building(), grass(), grass(), grass(), grass(), grass(), building(), building(), building(), building(), road(), road(), road(), road(), garden(), garden(), garden(), garden(), garden(), water(), water(), water(), water(), water(), water(), garden(), garden(), garden(), garden(), garden(), road(), road(), road(), road(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), road(), road(), road(), road(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building(), building()],
  [building(), building(), building(), building(), grass(), grass(), grass(), grass(), grass(), building(), building(), building(), building(), road(), road(), road(), road(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), road(), road(), road(), road(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), road(), road(), road(), road(), grass(), grass(), grass(), grass(), building(), road(), road(), road(), road(), building(), grass(), grass(), grass()],
  [building(), building(), building(), building(), grass(), grass(), grass(), grass(), grass(), building(), building(), building(), building(), road(), road(), road(), road(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), road(), road(), road(), road(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), road(), road(), road(), road(), building(), building(), building(), building(), building(), road(), road(), road(), road(), building(), building(), building(), building()],
  [grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), road(), road(), road(), road(), garden(), garden({ id: 'park-tree-3', type: 'tree', label: '公園樹' }), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden({ id: 'park-tree-4', type: 'tree', label: '公園樹' }), garden(), road(), road(), road(), road(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), road(), road(), road(), road(), building(), building(), building(), building(), building(), road(), road(), road(), road(), building(), building(), building(), building()],
  [grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), road(), road(), road(), road(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), road(), road(), road(), road(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), road(), road(), road(), road(), building(), building(), building(), building(), building(), road(), road(), road(), road(), building(), building(), building(), building()],
  [road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road()],
  [road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road()],
  [road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road()],
  [road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road()],
  [grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), road(), road(), road(), road(), plaza({ id: 'town-sign', type: 'sign', label: '鎮口告示牌' }), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden()],
  [grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden()],
  [grass(), grass(), water(), water(), water(), water(), water(), water(), water(), water(), water(), grass(), grass(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden()],
  [grass(), grass(), water(), water(), water(), water(), water(), water(), water(), water(), water(), grass(), grass(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza({ id: 'plaza-lamp-1', type: 'lamp', label: '廣場燈' }), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza({ id: 'plaza-lamp-2', type: 'lamp', label: '廣場燈' }), plaza(), plaza(), plaza(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza({ id: 'tennis-court-1', type: 'ground', label: '網球場A' }), plaza(), plaza(), plaza(), plaza({ id: 'tennis-court-2', type: 'ground', label: '網球場A' }), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), garden(), garden(), garden(), garden({ id: 'garden-tree-1', type: 'tree', label: '花園老樹' }), garden(), garden(), garden(), garden(), garden(), garden({ id: 'garden-tree-2', type: 'tree', label: '花園楓樹' }), garden(), garden(), garden()],
  [grass(), grass(), water(), water(), water(), water(), water(), water(), water(), water(), water(), grass(), grass(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden()],
  [grass(), grass(), water(), water(), water(), water(), water(), water(), water(), water(), water(), grass(), grass(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden()],
  [grass(), grass(), water(), water(), water(), water(), water(), water(), water(), water(), water(), grass(), grass(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden()],
  [grass(), grass(), water(), water(), water(), water(), water(), water(), water(), water(), water(), grass(), grass(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza({ id: 'central-well', type: 'well', label: '中央水井' }), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza({ id: 'basketball-court', type: 'ground', label: '籃球場' }), plaza(), plaza(), plaza(), road(), road(), road(), road(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden()],
  [grass(), grass(), water(), water(), water(), water(), water(), water(), water(), water(), water(), grass(), grass(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), garden(), garden(), garden(), garden(), garden(), garden(), garden({ id: 'garden-lamp', type: 'lamp', label: '花園燈' }), garden(), garden(), garden(), garden(), garden(), garden()],
  [grass(), grass(), water(), water(), water(), water(), water(), water(), water(), water(), water(), grass(), grass(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden()],
  [grass(), grass(), water(), water(), water(), water(), water(), water(), water(), water(), water(), grass(), grass(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden()],
  [grass(), grass(), water(), water(), water(), water(), water(), water(), water(), water(), water(), grass(), grass(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza({ id: 'tennis-court-3', type: 'ground', label: '網球場B' }), plaza(), plaza(), plaza(), plaza({ id: 'tennis-court-4', type: 'ground', label: '網球場B' }), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden()],
  [grass(), grass(), water(), water(), water(), water(), water(), water(), water(), water(), water(), grass(), grass(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza({ id: 'plaza-lamp-3', type: 'lamp', label: '廣場燈' }), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza({ id: 'plaza-lamp-4', type: 'lamp', label: '廣場燈' }), plaza(), plaza(), plaza(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden()],
  [grass(), grass(), water(), water(), water(), water(), water(), water(), water(), water(), water(), grass(), grass(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), garden(), garden(), garden(), garden({ id: 'garden-tree-3', type: 'tree', label: '花園松樹' }), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden()],
  [grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden()],
  [grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden()],
  [road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road()],
  [road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road()],
  [road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road()],
  [road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road()],
  [building(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), building(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building(), grass(), grass(), grass(), road(), road(), road(), road(), building(), building(), building(), building(), building(), building(), building(), building(), building(), building(), building(), building(), building()],
  [building(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), building(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building(), grass(), grass(), grass(), road(), road(), road(), road(), building(), building(), building(), building(), building(), building(), building(), building(), building(), building(), building(), building(), building()],
  [building(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), building(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building(), grass(), grass(), grass(), road(), road(), road(), road(), building(), building(), building(), building(), building(), building(), building(), building(), building(), building(), building(), building(), building()],
  [building(), building(), building({ id: 'bakery-door-1', type: 'door', label: '麵包店' }), building({ id: 'bakery-door-2', type: 'door', label: '麵包店' }), building({ id: 'bakery-door-3', type: 'door', label: '麵包店' }), building(), grass(), building(), building({ id: 'steak-door-1', type: 'door', label: '牛排館' }), building({ id: 'steak-door-2', type: 'door', label: '牛排館' }), building({ id: 'steak-door-3', type: 'door', label: '牛排館' }), building(), building(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza({ id: 'veggie-stall', type: 'marketStall', label: '蔬菜攤' }), plaza(), plaza(), plaza(), plaza(), plaza({ id: 'meat-stall', type: 'marketStall', label: '肉攤' }), plaza(), plaza(), plaza(), plaza(), plaza({ id: 'fish-stall', type: 'marketStall', label: '魚攤' }), plaza(), plaza(), road(), road(), road(), road(), building(), building(), building(), building({ id: 's-house-1-door', type: 'door', label: '民宅E' }), building(), building(), grass(), building(), building(), building({ id: 's-house-2-door', type: 'door', label: '民宅F' }), building(), building(), building(), grass(), grass(), grass(), road(), road(), road(), road(), building(), building(), building(), building(), building(), building(), building(), building(), building(), building(), building(), building(), building()],
  [grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), road(), road(), road(), road(), building(), building(), building(), building(), building(), building(), building(), building(), building(), building(), building(), building(), building()],
  [grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), building(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building(), grass(), grass(), grass(), road(), road(), road(), road(), building(), building(), building(), building(), building(), building(), building({ id: 'school-door', type: 'door', label: '學校' }), building(), building(), building(), building(), building(), building()],
  [grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), building(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building(), grass(), grass(), grass(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza()],
  [building(), building(), building({ id: 'drink-door-1', type: 'door', label: '手搖店' }), building({ id: 'drink-door-2', type: 'door', label: '手搖店' }), building({ id: 'drink-door-3', type: 'door', label: '手搖店' }), building(), grass(), building(), building(), building({ id: 'cafe-door', type: 'door', label: '咖啡廳' }), building(), building(), building(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), building(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building(), grass(), grass(), grass(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza()],
  [building(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), building(), building(), building(), building({ id: 's-house-3-door', type: 'door', label: '民宅G' }), building(), building(), grass(), building(), building(), building({ id: 's-house-4-door', type: 'door', label: '民宅H' }), building(), building(), building(), grass(), grass(), grass(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza()],
  [building(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza()],
  [building(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza({ id: 'school-flagpole', type: 'sign', label: '校旗桿' }), plaza(), plaza(), plaza(), plaza(), plaza(), plaza()],
  [grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza({ id: 'snack-stall', type: 'marketStall', label: '小吃攤' }), plaza(), plaza(), plaza(), plaza(), plaza({ id: 'drink-stall', type: 'marketStall', label: '飲料攤' }), plaza(), plaza(), plaza(), plaza(), plaza({ id: 'dessert-stall', type: 'marketStall', label: '甜點攤' }), plaza(), plaza(), road(), road(), road(), road(), building(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building(), grass(), grass(), grass(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza()],
  [plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), building(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building(), grass(), grass(), grass(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), building(), building({ id: 'sushi-door-1', type: 'door', label: '壽司店' }), building({ id: 'sushi-door-2', type: 'door', label: '壽司店' }), building({ id: 'sushi-door-3', type: 'door', label: '壽司店' }), building(), building()],
  [plaza(), plaza(), plaza(), plaza(), plaza({ id: 'dining-table-1', type: 'ground', label: '露天座位' }), plaza(), plaza(), plaza(), plaza(), plaza({ id: 'dining-table-2', type: 'ground', label: '露天座位' }), plaza(), plaza(), plaza(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), building(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building(), grass(), grass(), grass(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), building(), building(), building(), building(), building(), building()],
  [plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), building(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building(), grass(), grass(), grass(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), building(), building(), building(), building(), building(), building()],
  [plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), building(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building(), grass(), grass(), grass(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), building(), building(), building(), building(), building(), building()],
  [road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road()],
  [road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road()],
  [road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road()],
  [road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road()],
  [building(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building(), road(), road(), road(), road(), building(), building(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building(), building(), building(), road(), road(), road(), road(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), road(), road(), road(), road(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass()],
  [building(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building(), road(), road(), road(), road(), building(), building(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building(), building(), building(), road(), road(), road(), road(), garden(), garden({ id: 'nature-tree-1', type: 'tree', label: '自然保留區樹' }), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden({ id: 'nature-tree-2', type: 'tree', label: '自然保留區樹' }), garden(), garden(), garden(), road(), road(), road(), road(), garden({ id: 'waterfront-lamp', type: 'lamp', label: '水岸燈' }), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass()],
  [building(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building(), road(), road(), road(), road(), building(), building(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building(), building(), building(), road(), road(), road(), road(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), road(), road(), road(), road(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass()],
  [building(), building(), building({ id: 'sw-house-1-door', type: 'door', label: '民宅I' }), building(), building(), building(), grass(), building(), building(), building({ id: 'sw-house-2-door', type: 'door', label: '民宅J' }), building(), building(), building(), road(), road(), road(), road(), building(), building(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building(), building(), building(), road(), road(), road(), road(), garden(), garden(), garden(), water(), water(), water(), water(), water(), water(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), road(), road(), road(), road(), grass(), grass(), grass(), grass(), grass(), water(), water(), water(), water(), water(), water(), water(), water()],
  [grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), road(), road(), road(), road(), building(), building(), building(), building({ id: 'theater-door', type: 'door', label: '劇場' }), building(), building(), building(), grass(), building(), building(), building(), building({ id: 'inn-door', type: 'door', label: '旅店' }), building(), building(), building(), building(), road(), road(), road(), road(), garden(), garden(), garden(), water(), water(), water(), water(), water(), water(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), road(), road(), road(), road(), grass(), grass(), grass(), grass(), grass(), water(), water(), water(), water(), water(), water(), water(), water()],
  [building(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building(), road(), road(), road(), road(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), road(), road(), road(), road(), garden(), garden(), garden(), water(), water(), water(), water(), water(), water(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), road(), road(), road(), road(), grass(), grass(), grass(), grass(), grass(), water(), water(), water(), water(), water(), water(), water(), water()],
  [building(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), garden(), garden(), garden(), water(), water(), water(), water(), water(), water(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), road(), road(), road(), road(), grass(), grass(), grass(), grass(), grass(), water(), water(), water(), water(), water(), water(), water(), water()],
  [building(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), building(), building(), building({ id: 'bbq-door-1', type: 'door', label: '燒烤店' }), building({ id: 'bbq-door-2', type: 'door', label: '燒烤店' }), building({ id: 'bbq-door-3', type: 'door', label: '燒烤店' }), building(), plaza(), road(), road(), road(), road(), garden(), garden(), garden(), water(), water(), water(), water(), water(), water(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), road(), road(), road(), road(), grass(), grass(), grass(), grass(), grass(), water(), water(), water(), water(), water(), water(), water(), water()],
  [building(), building(), building(), building(), building(), building(), grass(), building(), building(), building(), building(), building(), building(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), building(), building(), building(), building(), building(), building(), plaza(), road(), road(), road(), road(), garden(), garden(), garden(), water(), water(), water(), water(), water(), water(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), road(), road(), road(), road(), grass(), grass(), grass(), grass(), grass(), water(), water(), water(), water(), water(), water(), water(), water()],
  [grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza({ id: 'stage', type: 'ground', label: '露天舞台' }), plaza(), building(), building(), building(), building(), building(), building(), plaza(), road(), road(), road(), road(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), road(), road(), road(), road(), grass(), grass(), grass(), grass(), grass(), water(), water(), water(), water(), water(), water(), water(), water()],
  [garden(), garden(), building(), building({ id: 'hotpot-door-1', type: 'door', label: '火鍋店' }), building({ id: 'hotpot-door-2', type: 'door', label: '火鍋店' }), building({ id: 'hotpot-door-3', type: 'door', label: '火鍋店' }), building(), building(), garden(), garden(), garden(), garden(), garden(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), road(), road(), road(), road(), grass(), grass(), grass(), grass(), grass(), water(), water(), water(), water(), water(), water(), water(), water()],
  [garden(), garden(), building(), building(), building(), building(), building(), building(), garden(), garden(), garden(), garden(), garden(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), garden(), garden({ id: 'nature-tree-3', type: 'tree', label: '自然保留區樹' }), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden({ id: 'nature-tree-4', type: 'tree', label: '自然保留區樹' }), garden(), garden(), garden(), road(), road(), road(), road(), grass(), grass(), grass(), grass(), grass(), water(), water(), water(), water(), water(), water(), water(), water()],
  [garden(), garden(), building(), building(), building(), building(), building(), building(), garden(), garden(), garden(), garden(), garden(), road(), road(), road(), road(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), road(), road(), road(), road(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), garden(), road(), road(), road(), road(), grass(), grass(), grass(), grass(), grass(), water(), water(), water(), water(), water(), water(), water(), water()],
];
