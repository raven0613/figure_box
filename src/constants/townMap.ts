export type TerrainType = 'grass' | 'road' | 'plaza' | 'water' | 'building' | 'garden';

export interface InteractableObjectData {
  id: string;
  type: 'well' | 'marketStall' | 'sign' | 'door' | 'tree' | 'lamp';
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

export const TOWN_MAP_WIDTH = 10;
export const TOWN_MAP_HEIGHT = 10;

// 10x10 town map. The road forks from the central plaza: north at x=4,
// east-west through y=5, and south at x=7.
export const TOWN_MAP_GRID: TownMapCellData[][] = [
  [
    building({ id: 'home-northwest-door', type: 'door', label: '北西民宅' }),
    building(),
    grass(),
    grass(),
    road(),
    grass(),
    grass(),
    garden({ id: 'old-oak', type: 'tree', label: '老橡樹' }),
    grass(),
    building({ id: 'watch-house-door', type: 'door', label: '哨所' }),
  ],
  [
    building(),
    grass(),
    grass(),
    grass(),
    road(),
    grass(),
    garden(),
    garden({ id: 'garden-lamp', type: 'lamp', label: '花園燈' }),
    grass(),
    building(),
  ],
  [
    grass(),
    grass(),
    water(),
    grass(),
    road(),
    grass(),
    grass(),
    grass(),
    grass(),
    grass(),
  ],
  [
    grass(),
    water(),
    water(),
    grass(),
    road(),
    grass(),
    building({ id: 'smithy-door', type: 'door', label: '鐵匠鋪' }),
    building(),
    grass(),
    grass(),
  ],
  [
    grass(),
    grass(),
    grass(),
    plaza({ id: 'town-sign', type: 'sign', label: '鎮口告示牌' }),
    plaza({ id: 'central-well', type: 'well', label: '中央水井' }),
    plaza(),
    building(),
    grass(),
    grass(),
    grass(),
  ],
  [
    road(),
    road(),
    road(),
    road(),
    plaza(),
    road(),
    road(),
    road(),
    road(),
    road(),
  ],
  [
    grass(),
    grass(),
    grass(),
    plaza({ id: 'fruit-stall', type: 'marketStall', label: '水果攤' }),
    plaza(),
    plaza(),
    grass(),
    road(),
    grass(),
    grass(),
  ],
  [
    building({ id: 'bakery-door', type: 'door', label: '麵包店' }),
    building(),
    grass(),
    grass(),
    grass(),
    grass(),
    grass(),
    road(),
    grass(),
    water(),
  ],
  [
    building(),
    grass(),
    grass(),
    garden({ id: 'south-tree', type: 'tree', label: '南側樹' }),
    grass(),
    grass(),
    grass(),
    road(),
    grass(),
    water(),
  ],
  [
    grass(),
    grass(),
    grass(),
    grass(),
    grass(),
    building({ id: 'inn-door', type: 'door', label: '旅店' }),
    building(),
    road(),
    road(),
    road(),
  ],
];
