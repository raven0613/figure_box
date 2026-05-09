import { TOWN_MAP_GRID, type TownMapCellData } from '~/constants/townMap';

export interface GridCoordinate {
  x: number;
  y: number;
}

export interface TownMapTile extends GridCoordinate {
  index: number;
  cell: TownMapCellData;
}

export interface CharacterPlacement extends GridCoordinate {
  id: string;
}

export class TownMapGrid {
  readonly width: number;
  readonly height: number;
  private readonly tiles: TownMapTile[];

  constructor(rows: TownMapCellData[][] = TOWN_MAP_GRID) {
    const gridRows = this.cloneRows(rows);
    this.height = gridRows.length;
    this.width = gridRows[0]?.length ?? 0;
    this.tiles = this.createFlatTiles(gridRows);
  }

  getTiles(): readonly TownMapTile[] {
    return this.tiles;
  }

  getTile(x: number, y: number): TownMapTile | null {
    if (!this.isInside(x, y)) {
      return null;
    }

    return this.tiles[this.toIndex(x, y)];
  }

  getNeighbors(x: number, y: number, radius: number): TownMapTile[] {
    const normalizedRadius = Math.max(0, Math.floor(radius));
    const minX = Math.max(0, x - normalizedRadius);
    const maxX = Math.min(this.width - 1, x + normalizedRadius);
    const minY = Math.max(0, y - normalizedRadius);
    const maxY = Math.min(this.height - 1, y + normalizedRadius);
    const neighbors: TownMapTile[] = [];

    for (let currentY = minY; currentY <= maxY; currentY++) {
      const rowStart = currentY * this.width;

      for (let currentX = minX; currentX <= maxX; currentX++) {
        if (currentX === x && currentY === y) {
          continue;
        }

        neighbors.push(this.tiles[rowStart + currentX]);
      }
    }

    return neighbors;
  }

  moveOccupant(occupantId: string, target: GridCoordinate): boolean {
    const targetTile = this.getTile(target.x, target.y);

    if (!targetTile || !targetTile.cell.walkable) {
      return false;
    }

    if (targetTile.cell.occupantId && targetTile.cell.occupantId !== occupantId) {
      return false;
    }

    const currentTile = this.tiles.find(tile => tile.cell.occupantId === occupantId);

    if (currentTile) {
      currentTile.cell.occupantId = null;
    }

    targetTile.cell.occupantId = occupantId;
    return true;
  }

  placeOccupant(placement: CharacterPlacement): boolean {
    return this.moveOccupant(placement.id, placement);
  }

  removeOccupant(occupantId: string): void {
    const currentTile = this.tiles.find(tile => tile.cell.occupantId === occupantId);

    if (currentTile) {
      currentTile.cell.occupantId = null;
    }
  }

  private createFlatTiles(rows: TownMapCellData[][]): TownMapTile[] {
    return rows.flatMap((row, y) => row.map((cell, x) => ({
      x,
      y,
      index: this.toIndex(x, y),
      cell,
    })));
  }

  private cloneRows(rows: TownMapCellData[][]): TownMapCellData[][] {
    return rows.map(row => row.map(cell => ({
      ...cell,
      interactableObject: cell.interactableObject ? { ...cell.interactableObject } : null,
    })));
  }

  private toIndex(x: number, y: number): number {
    return y * this.width + x;
  }

  private isInside(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }
}
