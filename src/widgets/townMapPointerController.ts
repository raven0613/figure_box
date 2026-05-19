import type { Canvas } from 'fabric';
import type { TownMapCamera } from './townMapCamera';
import type { TownMapCharacterTracker } from './townMapCharacterTracker';
import type { GridCoordinate, TownMapGrid, TownMapTile } from './townMapGrid';

interface TownMapPointerControllerOptions {
  canvas: Canvas;
  camera: TownMapCamera;
  characterTracker: TownMapCharacterTracker;
  grid: TownMapGrid;
  cellSize: number;
  getCharacterIdFromTarget: (target: unknown) => string | null;
  getMapObjectIdFromTarget: (target: unknown) => string | null;
  getCharacterTile: (characterId: string) => GridCoordinate | null;
  snapCharacterToGrid: (characterId: string, tile: GridCoordinate | null) => void;
  onTileClick?: (tile: TownMapTile) => void;
  onMapObjectClick?: (objectId: string) => void;
  onCharacterPickUp?: (characterId: string) => void;
  onCharacterDrop?: (characterId: string, tile: GridCoordinate | null) => void;
}

interface TownMapPointerEvent {
  target?: unknown;
  e: MouseEvent | TouchEvent | PointerEvent;
}

// mouse wheel/down/move/up 流程
export class TownMapPointerController {
  private readonly canvas: Canvas;
  private readonly camera: TownMapCamera;
  private readonly characterTracker: TownMapCharacterTracker;
  private readonly grid: TownMapGrid;
  private readonly cellSize: number;
  private readonly getCharacterIdFromTarget: (target: unknown) => string | null;
  private readonly getMapObjectIdFromTarget: (target: unknown) => string | null;
  private readonly getCharacterTile: (characterId: string) => GridCoordinate | null;
  private readonly snapCharacterToGrid: (characterId: string, tile: GridCoordinate | null) => void;
  private readonly onTileClick?: (tile: TownMapTile) => void;
  private readonly onMapObjectClick?: (objectId: string) => void;
  private readonly onCharacterPickUp?: (characterId: string) => void;
  private readonly onCharacterDrop?: (characterId: string, tile: GridCoordinate | null) => void;
  private pendingTileClick: TownMapTile | null = null;

  constructor(options: TownMapPointerControllerOptions) {
    this.canvas = options.canvas;
    this.camera = options.camera;
    this.characterTracker = options.characterTracker;
    this.grid = options.grid;
    this.cellSize = options.cellSize;
    this.getCharacterIdFromTarget = options.getCharacterIdFromTarget;
    this.getMapObjectIdFromTarget = options.getMapObjectIdFromTarget;
    this.getCharacterTile = options.getCharacterTile;
    this.snapCharacterToGrid = options.snapCharacterToGrid;
    this.onTileClick = options.onTileClick;
    this.onMapObjectClick = options.onMapObjectClick;
    this.onCharacterPickUp = options.onCharacterPickUp;
    this.onCharacterDrop = options.onCharacterDrop;
  }

  bind(): void {
    this.canvas.on('mouse:wheel', event => {
      this.camera.handleWheel(event.e);
    });

    this.canvas.on('mouse:down', event => {
      this.handleMouseDown(event);
    });

    this.canvas.on('mouse:move', event => {
      this.camera.pan(event.e);
    });

    this.canvas.on('mouse:up', event => {
      this.handleMouseUp(event);
    });
  }

  private handleMouseDown(event: TownMapPointerEvent): void {
    this.pendingTileClick = null;

    if (this.camera.isZoomControl(event.target) || this.characterTracker.isTrackingControl(event.target)) {
      return;
    }

    const characterId = this.getCharacterIdFromTarget(event.target);

    if (characterId) {
      this.characterTracker.selectCharacter(characterId);
      this.onCharacterPickUp?.(characterId);
      return;
    }

    const pointer = this.canvas.getScenePoint(event.e);
    this.pendingTileClick = this.getTileAtPointer(pointer.x, pointer.y);
    this.camera.startPan(event.e, event.target);
  }

  private handleMouseUp(event: TownMapPointerEvent): void {
    if (this.characterTracker.handlePointerTarget(event.target)) {
      this.pendingTileClick = null;
      return;
    }

    if (this.camera.handleZoomControl(event.target)) {
      this.pendingTileClick = null;
      return;
    }

    const didPan = this.camera.endPan();
    const characterId = this.getCharacterIdFromTarget(event.target ?? this.canvas.getActiveObject());
    const mapObjectId = this.getMapObjectIdFromTarget(event.target);

    if (!characterId && mapObjectId && !didPan) {
      this.onMapObjectClick?.(mapObjectId);
    } else if (!characterId && this.pendingTileClick && !didPan) {
      this.onTileClick?.(this.pendingTileClick);
    }

    this.pendingTileClick = null;

    if (!characterId) {
      return;
    }

    const pointer = this.canvas.getScenePoint(event.e);
    const tile = this.getTileAtPointer(pointer.x, pointer.y);

    this.onCharacterDrop?.(characterId, tile ? { x: tile.x, y: tile.y } : null);
    this.snapCharacterToGrid(characterId, this.getCharacterTile(characterId));
  }

  private getTileAtPointer(pointerX: number, pointerY: number): TownMapTile | null {
    return this.grid.getTile(
      Math.floor(pointerX / this.cellSize),
      Math.floor(pointerY / this.cellSize),
    );
  }
}
