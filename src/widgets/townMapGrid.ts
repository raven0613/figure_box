import { TOWN_MAP_GRID, TOWN_MAP_OBJECTS, type TownMapCellData, type TownMapObjectData } from '~/constants/townMap';

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
  private readonly mapObjects: TownMapObjectData[];
  private readonly occupantToTile = new Map<string, number>();
  private readonly tileToOccupant = new Map<number, string>();

  constructor(rows: TownMapCellData[][] = TOWN_MAP_GRID, mapObjects: readonly TownMapObjectData[] = TOWN_MAP_OBJECTS) {
    const gridRows = this.cloneRows(rows);
    this.height = gridRows.length;
    this.width = gridRows[0]?.length ?? 0;
    this.tiles = this.createFlatTiles(gridRows);
    this.mapObjects = this.createMapObjects(gridRows, mapObjects);
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

  getMapObjects(): readonly TownMapObjectData[] {
    return this.mapObjects;
  }

  getMapObjectsAt(x: number, y: number): TownMapObjectData[] {
    return this.mapObjects.filter(object => this.isObjectOccupyingTile(object, x, y));
  }

  getOccupantTile(occupantId: string): GridCoordinate | null {
    const index = this.occupantToTile.get(occupantId);

    if (index === undefined) {
      return null;
    }

    const tile = this.tiles[index];
    return { x: tile.x, y: tile.y };
  }

  getOccupiedNeighborIds(x: number, y: number, radius: number, excludeId?: string): string[] {
    const normalizedRadius = Math.max(0, Math.floor(radius));
    const minX = Math.max(0, x - normalizedRadius);
    const maxX = Math.min(this.width - 1, x + normalizedRadius);
    const minY = Math.max(0, y - normalizedRadius);
    const maxY = Math.min(this.height - 1, y + normalizedRadius);
    const result: string[] = [];

    for (let currentY = minY; currentY <= maxY; currentY++) {
      const rowStart = currentY * this.width;

      for (let currentX = minX; currentX <= maxX; currentX++) {
        if (currentX === x && currentY === y) {
          continue;
        }

        const occupantId = this.tileToOccupant.get(rowStart + currentX);

        if (occupantId && occupantId !== excludeId) {
          result.push(occupantId);
        }
      }
    }

    return result;
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

    if (!targetTile || !this.isTileWalkableForOccupant(targetTile.x, targetTile.y)) {
      return false;
    }

    if (targetTile.cell.occupantId && targetTile.cell.occupantId !== occupantId) {
      return false;
    }

    const currentIndex = this.occupantToTile.get(occupantId);

    if (currentIndex !== undefined) {
      this.tiles[currentIndex].cell.occupantId = null;
      this.tileToOccupant.delete(currentIndex);
    }

    targetTile.cell.occupantId = occupantId;
    this.occupantToTile.set(occupantId, targetTile.index);
    this.tileToOccupant.set(targetTile.index, occupantId);
    return true;
  }

  placeOccupant(placement: CharacterPlacement): boolean {
    return this.moveOccupant(placement.id, placement);
  }

  removeOccupant(occupantId: string): void {
    const currentIndex = this.occupantToTile.get(occupantId);

    if (currentIndex !== undefined) {
      this.tiles[currentIndex].cell.occupantId = null;
      this.occupantToTile.delete(occupantId);
      this.tileToOccupant.delete(currentIndex);
    }
  }

  findPath(from: GridCoordinate, to: GridCoordinate, occupantId: string): GridCoordinate[] | null {
    if (!this.isInside(from.x, from.y) || !this.isInside(to.x, to.y)) {
      return null;
    }

    const targetTile = this.getTile(to.x, to.y);

    if (!targetTile || !this.isTileWalkableForOccupant(targetTile.x, targetTile.y)) {
      return null;
    }

    const startKey = this.toIndex(from.x, from.y);
    const endKey = this.toIndex(to.x, to.y);

    if (startKey === endKey) {
      return [];
    }

    const visited = new Set<number>([startKey]);
    const cameFrom = new Map<number, number>();
    const queue: number[] = [startKey];

    while (queue.length > 0) {
      const currentIndex = queue.shift()!;

      if (currentIndex === endKey) {
        return this.reconstructPath(cameFrom, endKey);
      }

      const currentX = currentIndex % this.width;
      const currentY = Math.floor(currentIndex / this.width);

      for (const neighbor of this.getCardinalNeighborCoords(currentX, currentY)) {
        const neighborIndex = this.toIndex(neighbor.x, neighbor.y);

        if (visited.has(neighborIndex)) {
          continue;
        }

        const tile = this.tiles[neighborIndex];

        if (!this.isTileWalkableForOccupant(tile.x, tile.y)) {
          continue;
        }

        if (tile.cell.occupantId && tile.cell.occupantId !== occupantId) {
          continue;
        }

        visited.add(neighborIndex);
        cameFrom.set(neighborIndex, currentIndex);
        queue.push(neighborIndex);
      }
    }

    return null;
  }

  findBlockingTiles(from: GridCoordinate, to: GridCoordinate): GridCoordinate[] {
    if (!this.isInside(from.x, from.y) || !this.isInside(to.x, to.y)) {
      return [];
    }

    const startKey = this.toIndex(from.x, from.y);
    const endKey = this.toIndex(to.x, to.y);

    if (startKey === endKey) {
      return [];
    }

    const visited = new Set<number>([startKey]);
    const cameFrom = new Map<number, number>();
    const queue: number[] = [startKey];

    while (queue.length > 0) {
      const currentIndex = queue.shift()!;

      if (currentIndex === endKey) {
        const idealPath = this.reconstructPath(cameFrom, endKey);
        return idealPath.filter(coord => !this.isTileWalkableForOccupant(coord.x, coord.y));
      }

      const currentX = currentIndex % this.width;
      const currentY = Math.floor(currentIndex / this.width);

      for (const neighbor of this.getCardinalNeighborCoords(currentX, currentY)) {
        const neighborIndex = this.toIndex(neighbor.x, neighbor.y);

        if (visited.has(neighborIndex)) {
          continue;
        }

        visited.add(neighborIndex);
        cameFrom.set(neighborIndex, currentIndex);
        queue.push(neighborIndex);
      }
    }

    return [];
  }

  private reconstructPath(cameFrom: Map<number, number>, endIndex: number): GridCoordinate[] {
    const path: GridCoordinate[] = [];
    let current = endIndex;

    while (cameFrom.has(current)) {
      path.unshift({
        x: current % this.width,
        y: Math.floor(current / this.width),
      });
      current = cameFrom.get(current)!;
    }

    return path;
  }

  private getCardinalNeighborCoords(x: number, y: number): GridCoordinate[] {
    const directions: GridCoordinate[] = [
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
    ];

    return directions
      .map(dir => ({ x: x + dir.x, y: y + dir.y }))
      .filter(coord => this.isInside(coord.x, coord.y));
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

  private createMapObjects(rows: TownMapCellData[][], mapObjects: readonly TownMapObjectData[]): TownMapObjectData[] {
    const treeTemplate = mapObjects.find(object => object.id === 'test-tree');
    const lampTemplate = mapObjects.find(object => object.id === 'test-streetlight');
    const templateIds = new Set(['test-tree', 'test-streetlight']);

    return [
      ...rows.flatMap((row, y) => row.flatMap((cell, x) => {
        if (!cell.interactableObject) {
          return [];
        }

        if (cell.interactableObject.type === 'tree' && treeTemplate) {
          return [{
            ...treeTemplate,
            id: cell.interactableObject.id,
            label: cell.interactableObject.label,
            x,
            y,
          }];
        }

        if (cell.interactableObject.type === 'lamp' && lampTemplate) {
          return [{
            ...lampTemplate,
            id: cell.interactableObject.id,
            label: cell.interactableObject.label,
            x,
            y,
          }];
        }

        return [{
          id: cell.interactableObject.id,
          type: cell.interactableObject.type,
          label: cell.interactableObject.label,
          x,
          y,
          width: 1,
          height: 1,
          layer: 'decoration' as const,
          blocksMovement: !cell.walkable,
          interactable: true,
        }];
      })),
      ...mapObjects
        .filter(object => !templateIds.has(object.id))
        .map(object => ({ ...object })),
    ];
  }

  private isTileWalkableForOccupant(x: number, y: number): boolean {
    const tile = this.getTile(x, y);

    if (!tile?.cell.walkable) {
      return false;
    }

    return !this.mapObjects.some(object => object.blocksMovement && this.isObjectOccupyingTile(object, x, y));
  }

  private isObjectOccupyingTile(object: TownMapObjectData, x: number, y: number): boolean {
    return x >= object.x
      && x < object.x + object.width
      && y >= object.y
      && y < object.y + object.height;
  }

  private toIndex(x: number, y: number): number {
    return y * this.width + x;
  }

  private isInside(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }
}
