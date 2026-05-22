import { describe, expect, test } from 'vitest';
import type { ItemDefinition } from '~/typing/item';
import { ItemService } from './itemService';
import { ItemPlacementService } from './itemPlacementService';

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
    placement: {
      surfaceTypes: ['floor'],
      size: {
        width: 1,
        height: 1,
      },
      anchor: 'bottomCenter',
    },
  },
  {
    id: 'test_chair',
    nameKey: 'item.testChair.name',
    type: 'placeable',
    category: 'furniture',
    tags: ['home'],
    rarity: 'common',
    stackable: false,
    visual: {
      assetId: 'item/test_chair',
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

describe('ItemPlacementService', () => {
  test('places an item through the item store snapshot', () => {
    const itemService = new ItemService({ definitions: TEST_DEFINITIONS });
    const placementService = new ItemPlacementService({ items: itemService });
    const itemInstance = itemService.createItemInstance({
      definitionId: 'test_chair',
      ownerActorId: 'player',
    });

    const placedObject = placementService.placeItemOnMap({
      itemInstanceId: itemInstance.id,
      ownerActorId: 'player',
      mapId: 'test-map',
      worldPosition: {
        x: 2,
        y: 3,
      },
    });
    const snapshot = itemService.getSnapshot();
    const restoredItemService = new ItemService({ definitions: TEST_DEFINITIONS });

    restoredItemService.loadSnapshot(snapshot);

    expect(itemService.getItemInstance(itemInstance.id)?.state).toBe('placed');
    expect(snapshot.placedObjects).toEqual([placedObject]);
    expect(restoredItemService.getPlacedObject(placedObject.id)).toEqual(placedObject);
  });

  test('picks up a placed item without writing transfer history', () => {
    const itemService = new ItemService({ definitions: TEST_DEFINITIONS });
    const placementService = new ItemPlacementService({ items: itemService });
    const itemInstance = itemService.createItemInstance({
      definitionId: 'test_chair',
      ownerActorId: 'player',
    });
    const placedObject = placementService.placeItemOnMap({
      itemInstanceId: itemInstance.id,
      ownerActorId: 'player',
      mapId: 'test-map',
      worldPosition: {
        x: 2,
        y: 3,
      },
    });

    placementService.pickupPlacedItem({
      placedObjectId: placedObject.id,
      actorId: 'player',
    });

    expect(itemService.getItemInstance(itemInstance.id)?.state).toBe('stored');
    expect(itemService.getPlacedObjects('test-map')).toHaveLength(0);
    expect(itemService.getItemInstance(itemInstance.id)?.transferHistory).toEqual([
      {
        toActorId: 'player',
        reason: 'system',
        day: 0,
        quantity: 1,
      },
    ]);
  });

  test('rejects placing two items on the same world position', () => {
    const itemService = new ItemService({ definitions: TEST_DEFINITIONS });
    const placementService = new ItemPlacementService({ items: itemService });
    const firstItemInstance = itemService.createItemInstance({
      definitionId: 'test_chair',
      ownerActorId: 'player',
    });
    const secondItemInstance = itemService.createItemInstance({
      definitionId: 'test_chair',
      ownerActorId: 'player',
    });

    placementService.placeItemOnMap({
      itemInstanceId: firstItemInstance.id,
      ownerActorId: 'player',
      mapId: 'test-map',
      worldPosition: {
        x: 2,
        y: 3,
      },
    });

    expect(() => {
      placementService.placeItemOnMap({
        itemInstanceId: secondItemInstance.id,
        ownerActorId: 'player',
        mapId: 'test-map',
        worldPosition: {
          x: 2,
          y: 3,
        },
      });
    }).toThrow('already has a placed item');
  });

  test('places one item from a stack and merges it back when picked up', () => {
    const itemService = new ItemService({ definitions: TEST_DEFINITIONS });
    const placementService = new ItemPlacementService({ items: itemService });
    const itemInstance = itemService.createItemInstance({
      definitionId: 'test_apple',
      ownerActorId: 'player',
      quantity: 3,
      day: 1,
    });

    const placedObject = placementService.placeItemOnMap({
      itemInstanceId: itemInstance.id,
      ownerActorId: 'player',
      mapId: 'test-map',
      worldPosition: {
        x: 4,
        y: 5,
      },
    });
    const remainingStack = itemService.getItemInstance(itemInstance.id);
    const placedItem = itemService.getItemInstance(placedObject.itemInstanceId);

    expect(remainingStack?.quantity).toBe(2);
    expect(remainingStack?.state).toBe('stored');
    expect(placedItem?.quantity).toBe(1);
    expect(placedItem?.state).toBe('placed');
    expect(placedItem?.transferHistory).toEqual(itemInstance.transferHistory);

    placementService.pickupPlacedItem({
      placedObjectId: placedObject.id,
      actorId: 'player',
    });

    const playerItems = itemService.getActorItems('player');

    expect(playerItems).toHaveLength(1);
    expect(playerItems[0].id).toBe(itemInstance.id);
    expect(playerItems[0].quantity).toBe(3);
    expect(playerItems[0].state).toBe('stored');
    expect(itemService.getPlacedObjects('test-map')).toHaveLength(0);
  });
});
