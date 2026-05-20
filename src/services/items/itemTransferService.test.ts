import { describe, expect, test } from 'vitest';
import type { ItemDefinition } from '~/typing/item';
import { ItemService } from './itemService';
import { ItemTransferService } from './itemTransferService';

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
];

describe('ItemTransferService', () => {
  test('transfers item ownership and appends transfer history', () => {
    const itemService = new ItemService({ definitions: TEST_DEFINITIONS });
    const transferService = new ItemTransferService(itemService);
    const itemInstance = itemService.createItemInstance({
      definitionId: 'test_apple',
      ownerActorId: 'player',
      quantity: 2,
      day: 1,
    });

    const result = transferService.transferItem({
      itemInstanceId: itemInstance.id,
      fromActorId: 'player',
      toActorId: 'character-a',
      reason: 'gift',
      day: 3,
    });

    expect(result.previousOwnerActorId).toBe('player');
    expect(result.itemInstance.ownerActorId).toBe('character-a');
    expect(result.itemInstance.state).toBe('stored');
    expect(result.itemInstance.transferHistory).toEqual([
      {
        toActorId: 'player',
        reason: 'system',
        day: 1,
      },
      {
        fromActorId: 'player',
        toActorId: 'character-a',
        reason: 'gift',
        day: 3,
      },
    ]);
  });

  test('throws when source actor does not own the item', () => {
    const itemService = new ItemService({ definitions: TEST_DEFINITIONS });
    const transferService = new ItemTransferService(itemService);
    const itemInstance = itemService.createItemInstance({
      definitionId: 'test_apple',
      ownerActorId: 'player',
    });

    expect(() => {
      transferService.transferItem({
        itemInstanceId: itemInstance.id,
        fromActorId: 'character-a',
        toActorId: 'character-b',
        reason: 'gift',
        day: 2,
      });
    }).toThrow('does not own');
  });
});
