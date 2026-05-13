export type TerrainType = 'grass' | 'road' | 'plaza' | 'water' | 'building' | 'garden';

export interface InteractableObjectData {
  id: string;
  type: 'well' | 'marketStall' | 'sign' | 'door' | 'tree' | 'lamp' | 'ground';
  label: string;
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

export const TOWN_MAP_WIDTH = 30;
export const TOWN_MAP_HEIGHT = 30;

export interface Destination {
  readonly name: string;
  readonly serviceTiles: readonly { readonly x: number; readonly y: number }[];
}

export const DESTINATION_MAP: Record<string, readonly Destination[]> = {
  findFood: [
    { name: '披薩店', serviceTiles: [{ x: 3, y: 3 }, { x: 4, y: 3 }, { x: 5, y: 3 }] },
    { name: '麵包店', serviceTiles: [{ x: 0, y: 20 }, { x: 1, y: 20 }, { x: 2, y: 20 }] },
    { name: '手搖店', serviceTiles: [{ x: 15, y: 26 }, { x: 16, y: 26 }, { x: 17, y: 26 }] },
  ],
};

// 30x30 town map (scaled 3x from original 10x10). Each original cell is now a 3x3 block.
// Roads and paths are 3 cells wide so characters won't block each other.
export const TOWN_MAP_GRID: TownMapCellData[][] = [
  [building(), building(), building(), building(), building(), building(), grass(), grass(), grass(), grass(), grass(), grass(), road(), road(), road(), grass(), grass(), grass(), grass(), grass(), grass(), garden(), garden(), garden(), grass(), grass(), grass(), building(), building(), building()],
  [building(), building(), building(), building(), building(), building(), grass(), grass(), grass(), grass(), grass(), grass(), road(), road(), road(), grass(), grass(), grass(), grass(), grass(), grass(), garden(), garden({ id: 'old-oak', type: 'tree', label: '老橡樹' }), garden(), grass(), grass(), grass(), building(), building({ id: 'watch-house-door', type: 'door', label: '哨所' }), building()],
  [building(), building(), building(), building({ id: 'pizza-1', type: 'door', label: '披薩店' }), building({ id: 'pizza', type: 'door', label: '披薩店' }), building({ id: 'pizza-1', type: 'door', label: '披薩店' }), grass(), grass(), grass(), grass(), grass(), grass(), road(), road(), road(), grass(), grass(), grass(), grass(), grass(), grass(), garden(), garden(), garden(), grass(), grass(), grass(), building(), building(), building()],
  [building(), building(), building(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), road(), road(), road(), grass(), grass(), grass(), garden(), garden(), garden(), garden(), garden(), garden(), grass(), grass(), grass(), building(), building(), building()],
  [building(), building(), building(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), road(), road(), road(), grass(), grass(), grass(), garden(), garden(), garden(), garden(), garden({ id: 'garden-lamp', type: 'lamp', label: '花園燈' }), garden(), grass(), grass(), grass(), building(), building(), building()],
  [building(), building(), building(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), road(), road(), road(), grass(), grass(), grass(), garden(), garden(), garden(), garden(), garden(), garden(), grass(), grass(), grass(), building(), building(), building()],
  [grass(), grass(), grass(), grass(), grass(), grass(), water(), water(), water(), grass(), grass(), grass(), road(), road(), road(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass()],
  [grass(), grass(), grass(), grass(), grass(), grass(), water(), water(), water(), grass(), grass(), grass(), road(), road(), road(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass()],
  [grass(), grass(), grass(), grass(), grass(), grass(), water(), water(), water(), grass(), grass(), grass(), road(), road(), road(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass()],
  [grass(), grass(), grass(), water(), water(), water(), water(), water(), water(), grass(), grass(), grass(), road(), road(), road(), grass(), grass(), grass(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), grass(), grass(), grass()],
  [grass(), grass(), grass(), water(), water(), water(), water(), water(), water(), grass(), grass(), grass(), road(), road(), road(), grass(), grass(), grass(), plaza(), plaza({ id: 'tennis-court-1', type: 'ground', label: '網球場' }), plaza(), plaza(), plaza({ id: 'tennis-court-2', type: 'ground', label: '網球場' }), plaza(), plaza(), plaza({ id: 'tennis-court-3', type: 'ground', label: '網球場' }), plaza(), grass(), grass(), grass()],
  [grass(), grass(), grass(), water(), water(), water(), water(), water(), water(), grass(), grass(), grass(), road(), road(), road(), grass(), grass(), grass(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), grass(), grass(), grass()],
  [grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), grass(), grass(), grass()],
  [grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), plaza(), plaza({ id: 'town-sign', type: 'sign', label: '鎮口告示牌' }), plaza(), plaza(), plaza({ id: 'central-well', type: 'well', label: '中央水井' }), plaza(), plaza(), plaza(), plaza(), plaza(), plaza({ id: 'tennis-court-4', type: 'ground', label: '網球場' }), plaza(), plaza(), plaza({ id: 'tennis-court-5', type: 'ground', label: '網球場' }), plaza(), plaza(), plaza({ id: 'tennis-court-6', type: 'ground', label: '網球場' }), plaza(), grass(), grass(), grass()],
  [grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), grass(), grass(), grass()],
  [road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), plaza(), plaza(), plaza(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road()],
  [road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), plaza(), plaza(), plaza(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road()],
  [road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), plaza(), plaza(), plaza(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road(), road()],
  [grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), grass(), grass(), grass(), road(), road(), road(), grass(), grass(), grass(), grass(), grass(), grass()],
  [grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), plaza(), plaza({ id: 'fruit-stall', type: 'marketStall', label: '水果攤' }), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), grass(), grass(), grass(), road(), road(), road(), grass(), grass(), grass(), grass(), grass(), grass()],
  [grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), plaza(), grass(), grass(), grass(), road(), road(), road(), grass(), grass(), grass(), grass(), grass(), grass()],
  [building({ id: 'bakery-1', type: 'door', label: '麵包店' }), building({ id: 'bakery-2', type: 'door', label: '麵包店' }), building({ id: 'bakery-3', type: 'door', label: '麵包店' }), building(), building(), building(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), road(), road(), road(), grass(), grass(), grass(), water(), water(), water()],
  [building(), building(), building(), building(), building(), building(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), road(), road(), road(), grass(), grass(), grass(), water(), water(), water()],
  [building(), building(), building(), building(), building(), building(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), road(), road(), road(), grass(), grass(), grass(), water(), water(), water()],
  [building(), building(), building(), grass(), grass(), grass(), grass(), grass(), grass(), garden(), garden(), garden(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), road(), road(), road(), grass(), grass(), grass(), water(), water(), water()],
  [building(), building(), building(), grass(), grass(), grass(), grass(), grass(), grass(), garden(), garden({ id: 'south-tree', type: 'tree', label: '南側樹' }), garden(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), road(), road(), road(), grass(), grass(), grass(), water(), water(), water()],
  [building(), building(), building(), grass(), grass(), grass(), grass(), grass(), grass(), garden(), garden(), garden(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), road(), road(), road(), grass(), grass(), grass(), water(), water(), water()],
  [grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), building({ id: 'drink-1', type: 'door', label: '手搖店' }), building({ id: 'drink-1', type: 'door', label: '手搖店' }), building({ id: 'drink-1', type: 'door', label: '手搖店' }), building(), building(), building(), road(), road(), road(), road(), road(), road(), road(), road(), road()],
  [grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), building(), building({ id: 'inn-door', type: 'door', label: '旅店' }), building(), building(), building(), building(), road(), road(), road(), road(), road(), road(), road(), road(), road()],
  [grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), grass(), building(), building(), building(), building(), building(), building(), road(), road(), road(), road(), road(), road(), road(), road(), road()],
];
