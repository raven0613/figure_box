import type {
  InventoryGroupRule,
  ItemDefinition,
} from '~/typing/item';

export const ITEM_DEFINITIONS: readonly ItemDefinition[] = [
  {
    id: 'toy-ball',
    nameKey: 'item.toyBall.name',
    descriptionKey: 'item.toyBall.description',
    type: 'tool',
    category: 'toy',
    tags: ['play', 'ball'],
    rarity: 'common',
    stackable: false,
    basePrice: 40,
    visual: {
      assetId: 'item/toy_ball',
      scale: {
        icon: 1,
        held: 0.46,
      },
    },
  },
  {
    id: 'cards',
    nameKey: 'item.cards.name',
    descriptionKey: 'item.cards.description',
    type: 'tool',
    category: 'toy',
    tags: ['play', 'cards'],
    rarity: 'common',
    stackable: false,
    basePrice: 35,
    visual: {
      assetId: 'item/cards',
      scale: {
        icon: 1,
        held: 0.5,
      },
      heldOffset: {
        x: -1,
        y: 1,
      },
    },
  },
  {
    id: 'apple',
    nameKey: 'item.apple.name',
    descriptionKey: 'item.apple.description',
    type: 'consumable',
    category: 'food',
    tags: ['fruit', 'red', 'sweet'],
    rarity: 'common',
    stackable: true,
    maxStack: 99,
    basePrice: 20,
    visual: {
      assetId: 'item/apple',
      scale: {
        icon: 1,
        held: 0.45,
        placed: 0.75,
      },
    },
    placement: {
      surfaceTypes: ['tabletop', 'objectSurface'],
      size: {
        width: 1,
        height: 1,
      },
      anchor: 'bottomCenter',
    },
  },
  {
    id: 'clear_gem',
    nameKey: 'item.clearGem.name',
    descriptionKey: 'item.clearGem.description',
    type: 'generic',
    category: 'gem',
    tags: ['shiny', 'craftMaterial', 'decorative'],
    rarity: 'uncommon',
    stackable: true,
    maxStack: 99,
    basePrice: 80,
    visual: {
      assetId: 'item/clear_gem',
      scale: {
        icon: 1,
        held: 0.4,
        placed: 0.65,
      },
      heldOffset: {
        x: -6,
        y: 6,
      },
    },
    placement: {
      surfaceTypes: ['tabletop', 'objectSurface'],
      size: {
        width: 1,
        height: 1,
      },
      anchor: 'bottomCenter',
    },
  },
  {
    id: 'silver_bracelet',
    nameKey: 'item.silverBracelet.name',
    descriptionKey: 'item.silverBracelet.description',
    type: 'wearable',
    category: 'accessory',
    tags: ['shiny', 'decorative', 'fragile'],
    rarity: 'rare',
    stackable: false,
    basePrice: 180,
    visual: {
      assetId: 'item/silver_bracelet',
      visibleOnCharacter: false,
      scale: {
        icon: 1,
        held: 0.55,
        equipped: 0.5,
      },
    },
    equipment: {
      slot: 'wrist',
      attachPointId: 'leftWrist',
      localOffset: {
        x: 0,
        y: 0,
      },
    },
  },
  {
    id: 'wooden_chair',
    nameKey: 'item.woodenChair.name',
    descriptionKey: 'item.woodenChair.description',
    type: 'placeable',
    category: 'furniture',
    tags: ['wooden', 'home'],
    rarity: 'common',
    stackable: false,
    basePrice: 120,
    visual: {
      assetId: 'item/wooden_chair',
      scale: {
        icon: 1,
        held: 0.35,
        placed: 1,
      },
    },
    placement: {
      surfaceTypes: ['floor'],
      size: {
        width: 1,
        height: 1,
      },
      anchor: 'bottomCenter',
    },
  },
];

export const INVENTORY_GROUP_RULES: readonly InventoryGroupRule[] = [
  {
    id: 'food',
    labelKey: 'inventory.group.food',
    match: {
      categories: ['food', 'drink'],
    },
  },
  {
    id: 'clothing',
    labelKey: 'inventory.group.clothing',
    match: {
      categories: ['clothing', 'accessory'],
    },
  },
  {
    id: 'furniture',
    labelKey: 'inventory.group.furniture',
    match: {
      categories: ['furniture', 'decoration'],
    },
  },
  {
    id: 'materials',
    labelKey: 'inventory.group.materials',
    match: {
      categories: ['material', 'gem'],
    },
  },
  {
    id: 'other',
    labelKey: 'inventory.group.other',
    match: {},
  },
];
