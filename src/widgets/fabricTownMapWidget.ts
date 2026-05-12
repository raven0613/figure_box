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
      ground: 'G'
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
  private readonly characterBubbles = new Map<string, Text>();
  private readonly bubbleTimers = new Map<string, number>();
  private readonly activeWalks = new Map<string, AbortController>();
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
      const pos = this.getCharacterPosition(target);
      token.set({ left: pos.x, top: pos.y });
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

  showCharacterBubble(characterId: string, text: string, durationMs = 2600): void {
    const token = this.characterTokens.get(characterId);

    if (!token) {
      return;
    }

    const existingTimer = this.bubbleTimers.get(characterId);

    if (existingTimer) {
      window.clearTimeout(existingTimer);
      this.bubbleTimers.delete(characterId);
    }

    let bubble = this.characterBubbles.get(characterId);

    if (!bubble) {
      bubble = new Text(text, {
        fontSize: 13,
        fontFamily: 'Arial, sans-serif',
        fill: '#18252c',
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        originX: 'center',
        originY: 'bottom',
        selectable: false,
        evented: false,
      });
      this.characterBubbles.set(characterId, bubble);
      this.canvas.add(bubble);
    }

    bubble.set({
      text,
      left: token.left ?? 0,
      top: (token.top ?? 0) - this.cellSize * 0.46,
    });
    this.canvas.remove(bubble);
    this.canvas.add(bubble);
    this.canvas.requestRenderAll();

    const timer = window.setTimeout(() => {
      const currentBubble = this.characterBubbles.get(characterId);

      if (currentBubble) {
        this.canvas.remove(currentBubble);
        this.characterBubbles.delete(characterId);
        this.canvas.requestRenderAll();
      }

      this.bubbleTimers.delete(characterId);
    }, durationMs);

    this.bubbleTimers.set(characterId, timer);
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

    const bubble = this.characterBubbles.get(characterId);
    if (bubble) {
      this.canvas.remove(bubble);
      this.characterBubbles.delete(characterId);
    }

    const timer = this.bubbleTimers.get(characterId);
    if (timer) {
      window.clearTimeout(timer);
      this.bubbleTimers.delete(characterId);
    }
  }

  findPath(from: GridCoordinate, to: GridCoordinate, occupantId: string): GridCoordinate[] | null {
    return this.grid.findPath(from, to, occupantId);
  }

  findBlockingTiles(from: GridCoordinate, to: GridCoordinate): GridCoordinate[] {
    return this.grid.findBlockingTiles(from, to);
  }

  walkCharacterAlongPath(
    characterId: string,
    path: GridCoordinate[],
    onArrive: (position: GridCoordinate) => void,
    onBlocked: (position: GridCoordinate) => void,
  ): void {
    this.cancelWalk(characterId);

    const token = this.characterTokens.get(characterId);

    if (!token || path.length === 0) {
      onArrive(path[path.length - 1] ?? { x: 0, y: 0 });
      return;
    }

    const controller = new AbortController();
    this.activeWalks.set(characterId, controller);

    const speed = this.cellSize / 300;
    const waypoints = path.map(p => this.getCharacterPosition(p));

    let currentSegment = 0;
    let segmentProgress = 0;
    let lastTimestamp: number | null = null;

    const moved = this.grid.moveOccupant(characterId, path[0]);

    if (!moved) {
      this.activeWalks.delete(characterId);
      const currentTile = this.getCharacterTile(characterId);
      onBlocked(currentTile ?? path[0]);
      return;
    }

    const startPos = { x: token.left ?? 0, y: token.top ?? 0 };
    const allPoints = [startPos, ...waypoints];

    const segmentLengths: number[] = [];
    for (let i = 0; i < allPoints.length - 1; i++) {
      const dx = allPoints[i + 1].x - allPoints[i].x;
      const dy = allPoints[i + 1].y - allPoints[i].y;
      segmentLengths.push(Math.sqrt(dx * dx + dy * dy));
    }

    const animate = (timestamp: number) => {
      if (controller.signal.aborted) {
        return;
      }

      if (lastTimestamp === null) {
        lastTimestamp = timestamp;
      }

      const delta = timestamp - lastTimestamp;
      lastTimestamp = timestamp;

      const distanceThisFrame = speed * delta;
      segmentProgress += distanceThisFrame;

      while (currentSegment < segmentLengths.length && segmentProgress >= segmentLengths[currentSegment]) {
        segmentProgress -= segmentLengths[currentSegment];
        currentSegment++;

        if (currentSegment < path.length) {
          const nextMoved = this.grid.moveOccupant(characterId, path[currentSegment]);

          if (!nextMoved) {
            token.set({ left: allPoints[currentSegment].x, top: allPoints[currentSegment].y });
            token.setCoords();
            this.canvas.requestRenderAll();
            this.activeWalks.delete(characterId);
            const currentTile = this.getCharacterTile(characterId);
            onBlocked(currentTile ?? path[currentSegment]);
            return;
          }
        }
      }

      if (currentSegment >= segmentLengths.length) {
        const final = allPoints[allPoints.length - 1];
        token.set({ left: final.x, top: final.y });
        token.setCoords();
        this.canvas.requestRenderAll();
        this.activeWalks.delete(characterId);
        onArrive(path[path.length - 1]);
        return;
      }

      const t = segmentProgress / segmentLengths[currentSegment];
      const from = allPoints[currentSegment];
      const to = allPoints[currentSegment + 1];
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t;

      token.set({ left: x, top: y });
      token.setCoords();
      this.canvas.requestRenderAll();

      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }

  cancelWalk(characterId: string): void {
    const controller = this.activeWalks.get(characterId);

    if (controller) {
      controller.abort();
      this.activeWalks.delete(characterId);
    }
  }

  getCell(x: number, y: number): TownMapCellData | null {
    return this.grid.getTile(x, y)?.cell ?? null;
  }

  destroy(): Promise<boolean> {
    this.bubbleTimers.forEach(timer => window.clearTimeout(timer));
    this.bubbleTimers.clear();
    this.characterBubbles.clear();
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
      originX: 'left',
      originY: 'top',
      fill: style.fill,
      stroke: style.stroke,
      strokeWidth: 1,
      selectable: false,
      evented: false,
      objectCaching: true,
    });
  }

  private renderCharacter(character: TownMapCharacter): void {
    const existing = this.characterTokens.get(character.id);
    if (existing) {
      const pos = this.getCharacterPosition(character);
      existing.set({ left: pos.x, top: pos.y });
    }

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

    const pos = this.getCharacterPosition(currentTile);
    token.set({ left: pos.x, top: pos.y });
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
