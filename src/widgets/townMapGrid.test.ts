import { describe, expect, test } from 'vitest';
import { TownMapGrid, type GridCoordinate } from './townMapGrid';
import type { TownMapCellData } from '~/constants/townMap';

const walkableCell = (): TownMapCellData => ({
  walkable: true,
  terrain: 'road',
  occupantId: null,
  interactableObject: null,
});

const blockedCell = (): TownMapCellData => ({
  walkable: false,
  terrain: 'building',
  occupantId: null,
  interactableObject: null,
});

const createGrid = (rows: TownMapCellData[][]): TownMapGrid => new TownMapGrid(rows, []);

describe('TownMapGrid character occupancy', () => {
  test('allows multiple characters to occupy the same walkable tile', () => {
    const grid = createGrid([[walkableCell()]]);

    expect(grid.placeOccupant({ id: 'alice', x: 0, y: 0 })).toBe(true);
    expect(grid.placeOccupant({ id: 'bob', x: 0, y: 0 })).toBe(true);

    expect(grid.getOccupantIdsAt(0, 0)).toEqual(['alice', 'bob']);
    expect(grid.getOccupantTile('alice')).toEqual({ x: 0, y: 0 });
    expect(grid.getOccupantTile('bob')).toEqual({ x: 0, y: 0 });
  });

  test('finds a path through and into character-occupied tiles', () => {
    const grid = createGrid([
      [walkableCell(), walkableCell(), walkableCell()],
    ]);

    grid.placeOccupant({ id: 'alice', x: 0, y: 0 });
    grid.placeOccupant({ id: 'bob', x: 1, y: 0 });
    grid.placeOccupant({ id: 'cara', x: 2, y: 0 });
    const expectedPath: GridCoordinate[] = [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ];

    expect(grid.findPath({ x: 0, y: 0 }, { x: 2, y: 0 })).toEqual(expectedPath);
  });

  test('still rejects blocked terrain as a destination', () => {
    const grid = createGrid([
      [walkableCell(), blockedCell()],
    ]);

    grid.placeOccupant({ id: 'alice', x: 0, y: 0 });

    expect(grid.findPath({ x: 0, y: 0 }, { x: 1, y: 0 })).toBeNull();
    expect(grid.moveOccupant('alice', { x: 1, y: 0 })).toBe(false);
  });
});
