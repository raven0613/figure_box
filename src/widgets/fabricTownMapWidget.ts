import { Canvas, Circle, Group, Rect, Text } from 'fabric';
import { TownMapGrid, type CharacterPlacement, type GridCoordinate, type TownMapTile } from './townMapGrid';
import type { InteractableObjectData, TerrainType, TownMapCellData } from '~/constants/townMap';

export interface TownMapCharacter extends CharacterPlacement {
  color?: string;
  label?: string;
  statusText?: string;
}

export interface FabricTownMapOptions {
  cellSize?: number;
  onTileClick?: (tile: TownMapTile) => void;
  onCharacterPickUp?: (characterId: string) => void;
  onCharacterDrop?: (characterId: string, tile: GridCoordinate | null) => void;
}

interface TerrainStyle {
  fill: string;
  stroke: string;
}

const DEFAULT_CELL_SIZE = 48;
const CHARACTER_RADIUS_RATIO = 0.28;

class TerrainStyleCatalog {
  private readonly styles: Record<TerrainType, TerrainStyle> = {
    grass: { fill: '#7fb069', stroke: '#6d985b' },
    road: { fill: '#c8a46a', stroke: '#a98552' },
    plaza: { fill: '#d7c3a2', stroke: '#b9a27d' },
    water: { fill: '#4b9bc7', stroke: '#377fa6' },
    building: { fill: '#8a6b55', stroke: '#6c5141' },
    garden: { fill: '#5fae7a', stroke: '#4a8f64' },
  };

  get(terrain: TerrainType): TerrainStyle {
    return this.styles[terrain];
  }
}

class MapObjectGlyphFactory {
  create(object: InteractableObjectData, x: number, y: number, cellSize: number): Text {
    return new Text(this.getGlyph(object.type), {
      left: x + cellSize / 2,
      top: y + cellSize / 2,
      originX: 'center',
      originY: 'center',
      fontSize: cellSize * 0.36,
      fontFamily: 'Arial, sans-serif',
      fill: '#2b2b2b',
      selectable: false,
      evented: false,
    });
  }

  private getGlyph(type: InteractableObjectData['type']): string {
    const glyphs: Record<InteractableObjectData['type'], string> = {
      well: 'W',
      marketStall: 'M',
      sign: 'S',
      door: 'D',
      tree: 'T',
      lamp: 'L',
    };

    return glyphs[type];
  }
}

class CharacterTokenFactory {
  create(character: TownMapCharacter, center: GridCoordinate, cellSize: number): Group {
    const token = new Circle({
      radius: cellSize * CHARACTER_RADIUS_RATIO,
      fill: character.color ?? '#f2d16b',
      stroke: '#2d2d2d',
      strokeWidth: 2,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });
    const label = new Text(character.label ?? character.id.slice(0, 1).toUpperCase(), {
      fontSize: cellSize * 0.28,
      fontWeight: '700',
      fontFamily: 'Arial, sans-serif',
      fill: '#1f1f1f',
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });
    const status = new Text(character.statusText ?? '', {
      top: -cellSize * 0.48,
      fontSize: 10,
      fontFamily: 'Arial, sans-serif',
      fill: '#20252b',
      backgroundColor: 'rgba(255, 255, 255, 0.82)',
      originX: 'center',
      originY: 'bottom',
      selectable: false,
      evented: false,
    });

    const group = new Group([status, token, label], {
      left: center.x,
      top: center.y,
      originX: 'center',
      originY: 'center',
      selectable: true,
      evented: true,
      hasControls: false,
      hasBorders: false,
      lockScalingX: true,
      lockScalingY: true,
      lockRotation: true,
      hoverCursor: 'grab',
      moveCursor: 'grabbing',
    });

    group.set('characterId', character.id);
    group.set('statusObject', status);
    return group;
  }
}

export class FabricTownMapWidget {
  private readonly canvas: Canvas;
  private readonly grid = new TownMapGrid();
  private readonly terrainStyles = new TerrainStyleCatalog();
  private readonly objectGlyphFactory = new MapObjectGlyphFactory();
  private readonly characterTokenFactory = new CharacterTokenFactory();
  private readonly cellSize: number;
  private readonly characterTokens = new Map<string, Group>();
  private readonly onTileClick?: (tile: TownMapTile) => void;
  private readonly onCharacterPickUp?: (characterId: string) => void;
  private readonly onCharacterDrop?: (characterId: string, tile: GridCoordinate | null) => void;

  constructor(canvasElement: HTMLCanvasElement | string, options: FabricTownMapOptions = {}) {
    this.cellSize = options.cellSize ?? DEFAULT_CELL_SIZE;
    this.onTileClick = options.onTileClick;
    this.onCharacterPickUp = options.onCharacterPickUp;
    this.onCharacterDrop = options.onCharacterDrop;
    this.canvas = new Canvas(canvasElement, {
      width: this.grid.width * this.cellSize,
      height: this.grid.height * this.cellSize,
      backgroundColor: '#f4ecd8',
      selection: false,
      allowTouchScrolling: true,
    });

    this.canvas.on('mouse:down', event => {
      const characterId = this.getCharacterIdFromTarget(event.target);

      if (characterId) {
        this.onCharacterPickUp?.(characterId);
        return;
      }

      const pointer = this.canvas.getScenePoint(event.e);
      const tile = this.grid.getTile(Math.floor(pointer.x / this.cellSize), Math.floor(pointer.y / this.cellSize));

      if (tile) {
        this.onTileClick?.(tile);
      }
    });

    this.canvas.on('mouse:up', event => {
      const characterId = this.getCharacterIdFromTarget(event.target ?? this.canvas.getActiveObject());

      if (!characterId) {
        return;
      }

      const pointer = this.canvas.getScenePoint(event.e);
      const tile = this.grid.getTile(Math.floor(pointer.x / this.cellSize), Math.floor(pointer.y / this.cellSize));
      this.onCharacterDrop?.(characterId, tile ? { x: tile.x, y: tile.y } : null);
      this.snapCharacterToGrid(characterId);
    });

    this.draw();
  }

  static mount(container: HTMLElement, options?: FabricTownMapOptions): FabricTownMapWidget {
    const canvasElement = document.createElement('canvas');
    container.appendChild(canvasElement);
    return new FabricTownMapWidget(canvasElement, options);
  }

  getNeighbors(x: number, y: number, radius: number): TownMapTile[] {
    return this.grid.getNeighbors(x, y, radius);
  }

  placeCharacter(character: TownMapCharacter): boolean {
    const placed = this.grid.placeOccupant(character);

    if (!placed) {
      return false;
    }

    this.renderCharacter(character);
    this.canvas.requestRenderAll();
    return true;
  }

  moveCharacter(characterId: string, target: GridCoordinate): boolean {
    const moved = this.grid.moveOccupant(characterId, target);

    if (!moved) {
      return false;
    }

    const token = this.characterTokens.get(characterId);

    if (token) {
      token.set(this.getCharacterPosition(target));
      token.setCoords();
      this.canvas.requestRenderAll();
    }

    return true;
  }

  updateCharacterStatus(characterId: string, statusText: string): void {
    const token = this.characterTokens.get(characterId);
    const status = token?.get('statusObject') as Text | undefined;

    if (!token || !status || status.text === statusText) {
      return;
    }

    status.set('text', statusText);
    token.setCoords();
    this.canvas.requestRenderAll();
  }

  getCharacterTile(characterId: string): GridCoordinate | null {
    const tile = this.grid.getTiles().find(item => item.cell.occupantId === characterId);

    return tile ? { x: tile.x, y: tile.y } : null;
  }

  removeCharacter(characterId: string): void {
    const token = this.characterTokens.get(characterId);
    this.grid.removeOccupant(characterId);

    if (token) {
      this.canvas.remove(token);
      this.characterTokens.delete(characterId);
      this.canvas.requestRenderAll();
    }
  }

  getCell(x: number, y: number): TownMapCellData | null {
    return this.grid.getTile(x, y)?.cell ?? null;
  }

  destroy(): Promise<boolean> {
    return this.canvas.dispose();
  }

  private draw(): void {
    this.grid.getTiles().forEach(tile => {
      this.canvas.add(this.createTileRect(tile));

      if (tile.cell.interactableObject) {
        this.canvas.add(this.objectGlyphFactory.create(
          tile.cell.interactableObject,
          tile.x * this.cellSize,
          tile.y * this.cellSize,
          this.cellSize
        ));
      }

      if (tile.cell.occupantId) {
        this.renderCharacter({
          id: tile.cell.occupantId,
          x: tile.x,
          y: tile.y,
          color: '#f0cc5f',
        });
      }
    });
  }

  private createTileRect(tile: TownMapTile): Rect {
    const style = this.terrainStyles.get(tile.cell.terrain);

    return new Rect({
      left: tile.x * this.cellSize,
      top: tile.y * this.cellSize,
      width: this.cellSize,
      height: this.cellSize,
      fill: style.fill,
      stroke: style.stroke,
      strokeWidth: 1,
      selectable: false,
      evented: false,
      objectCaching: true,
    });
  }

  private renderCharacter(character: TownMapCharacter): void {
    this.characterTokens.get(character.id)?.set(this.getCharacterPosition(character));

    if (this.characterTokens.has(character.id)) {
      return;
    }

    const token = this.characterTokenFactory.create(character, this.getCharacterPosition(character), this.cellSize);
    this.characterTokens.set(character.id, token);
    this.canvas.add(token);
  }

  private snapCharacterToGrid(characterId: string): void {
    const currentTile = this.getCharacterTile(characterId);
    const token = this.characterTokens.get(characterId);

    if (!currentTile || !token) {
      return;
    }

    token.set(this.getCharacterPosition(currentTile));
    token.setCoords();
    this.canvas.requestRenderAll();
  }

  private getCharacterPosition(coordinate: GridCoordinate): GridCoordinate {
    return {
      x: coordinate.x * this.cellSize + this.cellSize / 2,
      y: coordinate.y * this.cellSize + this.cellSize / 2,
    };
  }

  private getCharacterIdFromTarget(target: unknown): string | null {
    if (!target) {
      return null;
    }

    const maybeCharacter = target as { get?: (key: string) => unknown };
    const characterId = maybeCharacter.get?.('characterId');

    return typeof characterId === 'string' ? characterId : null;
  }
}
