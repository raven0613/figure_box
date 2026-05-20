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
  test('transfers one stackable item and appends quantity history on both stacks', () => {
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
    const playerItems = itemService.getActorItems('player');
    const characterItems = itemService.getActorItems('character-a');

    expect(result.previousOwnerActorId).toBe('player');
    expect(playerItems).toHaveLength(1);
    expect(playerItems[0].quantity).toBe(1);
    expect(result.itemInstance.ownerActorId).toBe('character-a');
    expect(result.itemInstance.quantity).toBe(1);
    expect(result.itemInstance.state).toBe('stored');
    expect(characterItems).toHaveLength(1);
    expect(playerItems[0].transferHistory).toEqual([
      {
        toActorId: 'player',
        reason: 'system',
        day: 1,
        quantity: 2,
      },
      {
        fromActorId: 'player',
        toActorId: 'character-a',
        reason: 'gift',
        day: 3,
        quantity: 1,
      },
    ]);
    expect(result.itemInstance.transferHistory).toEqual([
      {
        fromActorId: 'player',
        toActorId: 'character-a',
        reason: 'gift',
        day: 3,
        quantity: 1,
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

  test('merges consecutive matching gift history rows', () => {
    const itemService = new ItemService({ definitions: TEST_DEFINITIONS });
    const transferService = new ItemTransferService(itemService);
    const itemInstance = itemService.createItemInstance({
      definitionId: 'test_apple',
      ownerActorId: 'player',
      quantity: 3,
      day: 1,
    });

    transferService.transferItem({
      itemInstanceId: itemInstance.id,
      fromActorId: 'player',
      toActorId: 'character-a',
      reason: 'gift',
      day: 2,
    });
    transferService.transferItem({
      itemInstanceId: itemInstance.id,
      fromActorId: 'player',
      toActorId: 'character-a',
      reason: 'gift',
      day: 2,
    });

    const playerItem = itemService.getItemInstance(itemInstance.id);
    const characterItem = itemService.getActorItems('character-a')[0];

    expect(playerItem?.transferHistory).toEqual([
      {
        toActorId: 'player',
        reason: 'system',
        day: 1,
        quantity: 3,
      },
      {
        fromActorId: 'player',
        toActorId: 'character-a',
        reason: 'gift',
        day: 2,
        quantity: 2,
      },
    ]);
    expect(characterItem.transferHistory).toEqual([
      {
        fromActorId: 'player',
        toActorId: 'character-a',
        reason: 'gift',
        day: 2,
        quantity: 2,
      },
    ]);
  });
});
