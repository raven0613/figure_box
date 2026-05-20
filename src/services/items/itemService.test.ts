import { describe, expect, test } from 'vitest';
import type { ItemDefinition } from '~/typing/item';
import { ItemService } from './itemService';

const TEST_DEFINITIONS: readonly ItemDefinition[] = [
  {
    id: 'test_apple',
    nameKey: 'item.testApple.name',
    type: 'consumable',
    category: 'food',
    tags: ['fruit'],
    rarity: 'common',
    stackable: true,
    maxStack: 99,
    visual: {
      assetId: 'item/test_apple',
    },
  },
  {
    id: 'test_bracelet',
    nameKey: 'item.testBracelet.name',
    type: 'wearable',
    category: 'accessory',
    tags: ['shiny'],
    rarity: 'rare',
    stackable: false,
    visual: {
      assetId: 'item/test_bracelet',
    },
  },
];

describe('ItemService', () => {
  test('stacks new owned item instances when definition is stackable', () => {
    const itemService = new ItemService({ definitions: TEST_DEFINITIONS });

    const firstItemInstance = itemService.createItemInstance({
      definitionId: 'test_apple',
      ownerActorId: 'player',
      quantity: 2,
    });
    const secondItemInstance = itemService.createItemInstance({
      definitionId: 'test_apple',
      ownerActorId: 'player',
      quantity: 3,
    });

    const playerItems = itemService.getActorItems('player');

    expect(secondItemInstance.id).toBe(firstItemInstance.id);
    expect(playerItems).toHaveLength(1);
    expect(playerItems[0].quantity).toBe(5);
    expect(playerItems[0].transferHistory).toEqual([
      {
        toActorId: 'player',
        reason: 'system',
        day: 0,
        quantity: 5,
      },
    ]);
  });

  test('starts a new stack history row after a different transfer property appears', () => {
    const itemService = new ItemService({ definitions: TEST_DEFINITIONS });

    itemService.createItemInstance({
      definitionId: 'test_apple',
      ownerActorId: 'player',
      quantity: 2,
      reason: 'purchase',
      day: 1,
    });
    itemService.createItemInstance({
      definitionId: 'test_apple',
      fromActorId: 'character-a',
      ownerActorId: 'player',
      quantity: 1,
      reason: 'gift',
      day: 1,
    });
    itemService.createItemInstance({
      definitionId: 'test_apple',
      ownerActorId: 'player',
      quantity: 1,
      reason: 'purchase',
      day: 1,
    });

    expect(itemService.getActorItems('player')[0].transferHistory).toEqual([
      {
        toActorId: 'player',
        reason: 'purchase',
        day: 1,
        quantity: 2,
      },
      {
        fromActorId: 'character-a',
        toActorId: 'player',
        reason: 'gift',
        day: 1,
        quantity: 1,
      },
      {
        toActorId: 'player',
        reason: 'purchase',
        day: 1,
        quantity: 1,
      },
    ]);
  });

  test('keeps non-stackable item instances separate', () => {
    const itemService = new ItemService({ definitions: TEST_DEFINITIONS });

    itemService.createItemInstance({
      definitionId: 'test_bracelet',
      ownerActorId: 'player',
    });
    itemService.createItemInstance({
      definitionId: 'test_bracelet',
      ownerActorId: 'player',
    });

    expect(itemService.getActorItems('player')).toHaveLength(2);
  });
});
