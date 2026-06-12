import { Canvas, type Group } from 'fabric';
import { TownMapGrid, type GridCoordinate, type TownMapTile } from './townMapGrid';
import { TownMapCamera } from './townMapCamera';
import { TownMapCharacterTracker } from './townMapCharacterTracker';
import { TownMapCharacterLayer } from './townMapCharacterLayer';
import { TownMapFloatingTextLayer } from './townMapFloatingTextLayer';
import { TownMapWalkAnimator } from './townMapWalkAnimator';
import { TownMapPointerController } from './townMapPointerController';
import { TownMapItemGlyphFactory } from './townMapItemGlyphFactory';
import {
  MapObjectGlyphFactory,
  TerrainStyleCatalog,
} from './townMapObjectGlyphFactory';
import { sortEntityLayer, updateEntitySortMetadata } from './townMapLayerSorter';
import { DEFAULT_CELL_SIZE } from '../constants/townMapWidgetConstants';
import type { Expression } from '~/constants/character';
import type { CharacterPerformanceAnimationId } from '~/constants/presentationAnimations';
import type { ItemDefinition, PlacedObject } from '~/typing/item';
import type { MapActivityView, MapBubbleSequence, MapBubbleSequenceLine } from '~/typing/eventDialoguePresentation';
import type { MapDialogueBubbleAnimation } from '~/constants/event';
import {
  TOWN_MAP_GRID,
  TOWN_MAP_FLOOR_DECORATIONS,
  TOWN_MAP_OBJECTS,
  type TownMapCellData,
  type TownMapFloorDecorationData,
  type TownMapObjectData,
} from '~/constants/townMap';
import type { CharacterRequestLevel } from '~/services/characterRequests/types';
import type {
  FabricTownMapOptions,
  TownMapCharacter,
} from './townMapWidgetTypes';
import type {
  TownMapCharacterSpriteDirection,
  TownMapCharacterSpriteSet,
} from './townMapCharacterSpriteRenderer';

export type {
  FabricTownMapOptions,
  TownMapCharacter,
} from './townMapWidgetTypes';

interface MoveCharacterToTileResult {
  moved: boolean;
  position: GridCoordinate | null;
}

const OVERLAP_OFFSET_MIN_CELL_RATIO = 0.5;
const OVERLAP_OFFSET_MAX_CELL_RATIO = 0.75;
const OVERLAP_OFFSET_PUSH_DURATION_MS = 180;
const ZERO_OFFSET: GridCoordinate = { x: 0, y: 0 };

export class FabricTownMapWidget {
  private readonly baseCanvasElement: HTMLCanvasElement;
  private readonly baseContext: CanvasRenderingContext2D;
  private readonly canvas: Canvas;
  private readonly camera: TownMapCamera;
  private readonly characterTracker: TownMapCharacterTracker;
  private readonly characterLayer: TownMapCharacterLayer;
  private readonly floatingTextLayer: TownMapFloatingTextLayer;
  private readonly walkAnimator: TownMapWalkAnimator;
  private readonly grid: TownMapGrid;
  private readonly terrainStyles = new TerrainStyleCatalog();
  private readonly objectGlyphFactory = new MapObjectGlyphFactory();
  private readonly itemGlyphFactory = new TownMapItemGlyphFactory();
  private readonly cellSize: number;
  private readonly mapObjectShapes = new Map<string, Group>();
  private readonly placedItemShapes = new Map<string, Group>();
  private readonly characterTileOffsets = new Map<string, GridCoordinate>();
  private readonly characterOffsetAnimationFrameIds = new Map<string, number>();
  private animationFrameId: number | null = null;

  constructor(canvasElement: HTMLCanvasElement | string, options: FabricTownMapOptions = {}) {
    this.cellSize = options.cellSize ?? DEFAULT_CELL_SIZE;
    this.grid = new TownMapGrid(TOWN_MAP_GRID, TOWN_MAP_OBJECTS, {
      allowDiagonalMovement: options.allowDiagonalMovement,
    });

    const entityCanvasElement = typeof canvasElement === 'string'
      ? document.getElementById(canvasElement) as HTMLCanvasElement | null
      : canvasElement;

    if (!entityCanvasElement) {
      throw new Error('FabricTownMapWidget requires a canvas element.');
    }

    this.baseCanvasElement = options.baseCanvasElement ?? document.createElement('canvas');
    const baseContext = this.baseCanvasElement.getContext('2d');

    if (!baseContext) {
      throw new Error('FabricTownMapWidget requires a 2D canvas context.');
    }

    this.baseContext = baseContext;
    this.prepareBaseCanvas();
    this.attachBaseCanvas(entityCanvasElement);
    this.canvas = new Canvas(entityCanvasElement, {
      width: this.mapWidth,
      height: this.mapHeight,
      backgroundColor: 'transparent',
      selection: false,
      allowTouchScrolling: false,
    });
    this.prepareEntityCanvas();
    this.camera = new TownMapCamera({
      canvas: this.canvas,
      baseCanvasElement: this.baseCanvasElement,
      mapWidth: this.mapWidth,
      mapHeight: this.mapHeight,
      viewportWidth: this.mapWidth,
      viewportHeight: this.mapHeight,
      onZoomChange: zoom => {
        this.handleZoomChange(zoom, options.onZoomChange);
      },
    });
    this.characterTracker = new TownMapCharacterTracker({
      canvas: this.canvas,
      camera: this.camera,
      getCharacterCenter: characterId => this.getCharacterCenter(characterId),
    });
    this.characterLayer = new TownMapCharacterLayer({
      canvas: this.canvas,
      cellSize: this.cellSize,
      characterTracker: this.characterTracker,
    });
    this.floatingTextLayer = new TownMapFloatingTextLayer({
      canvas: this.canvas,
      cellSize: this.cellSize,
      getCharacterCenter: characterId => this.getCharacterCenter(characterId),
      getZoom: () => this.getZoom(),
      updateCharacterExpression: (characterId, expression) => {
        this.updateCharacterExpression(characterId, expression);
      },
      startAnimationLoop: () => this.startAnimationLoop(),
      onMapActivityObserve: options.onMapActivityObserve,
    });
    this.walkAnimator = new TownMapWalkAnimator({
      cellSize: this.cellSize,
      getCharacterToken: characterId => this.characterLayer.getToken(characterId),
      getCharacterTile: characterId => this.getCharacterTile(characterId),
      getCharacterPosition: (characterId, coordinate) => this.getCharacterPosition(characterId, coordinate),
      moveCharacterToTile: (characterId, target) => this.moveCharacterToTile(characterId, target).position,
      positionToken: (token, position) => {
        this.characterLayer.positionToken(token, position);
      },
      startAnimationLoop: () => this.startAnimationLoop(),
      stopAnimationLoopIfIdle: () => this.stopAnimationLoopIfIdle(),
      setCharacterDirection: (characterId, direction) => {
        this.characterLayer.setCharacterSpriteDirection(characterId, direction);
      },
    });
    const pointerController = new TownMapPointerController({
      canvas: this.canvas,
      camera: this.camera,
      characterTracker: this.characterTracker,
      grid: this.grid,
      cellSize: this.cellSize,
      getCharacterIdFromTarget: target => this.characterLayer.getCharacterIdFromTarget(target),
      getMapObjectIdFromTarget: target => this.getMapObjectIdFromTarget(target),
      isMapActivityInteractionTarget: target => (
        this.floatingTextLayer.isMapActivityInteractionTarget(target)
      ),
      getCharacterTile: characterId => this.getCharacterTile(characterId),
      snapCharacterToGrid: (characterId, tile) => {
        this.snapCharacterToGrid(characterId, tile);
      },
      onTileClick: options.onTileClick,
      onMapObjectClick: options.onMapObjectClick,
      onCharacterPickUp: options.onCharacterPickUp,
      onCharacterDrop: options.onCharacterDrop,
    });

    pointerController.bind();
    this.draw();
  }

  static mount(container: HTMLElement, options?: FabricTownMapOptions): FabricTownMapWidget {
    const baseCanvasElement = document.createElement('canvas');
    const canvasElement = document.createElement('canvas');

    container.appendChild(baseCanvasElement);
    container.appendChild(canvasElement);
    return new FabricTownMapWidget(canvasElement, { ...options, baseCanvasElement });
  }

  getNeighbors(x: number, y: number, radius: number): TownMapTile[] {
    return this.grid.getNeighbors(x, y, radius);
  }

  getOccupiedNeighborIds(x: number, y: number, radius: number, excludeId?: string): string[] {
    return this.grid.getOccupiedNeighborIds(x, y, radius, excludeId);
  }

  getOccupantIdsAt(x: number, y: number): string[] {
    return this.grid.getOccupantIdsAt(x, y);
  }

  getMapObjectsAt(x: number, y: number): TownMapObjectData[] {
    return this.grid.getMapObjectsAt(x, y);
  }

  getMapObjectsInRadius(x: number, y: number, radius: number): TownMapObjectData[] {
    return this.grid.getMapObjectsInRadius(x, y, radius);
  }

  getDistanceToCharacter(x: number, y: number, characterId: string): number | null {
    return this.grid.getDistanceToOccupant(x, y, characterId);
  }

  getTileAtViewportPoint(x: number, y: number): GridCoordinate | null {
    const viewport = this.canvas.viewportTransform ?? [1, 0, 0, 1, 0, 0];
    const zoom = viewport[0] || 1;
    const sceneX = (x - viewport[4]) / zoom;
    const sceneY = (y - viewport[5]) / zoom;
    const tileX = Math.floor(sceneX / this.cellSize);
    const tileY = Math.floor(sceneY / this.cellSize);

    if (!this.grid.getTile(tileX, tileY)) {
      return null;
    }

    return {
      x: tileX,
      y: tileY,
    };
  }

  getCharacterIdsNearViewportPoint(x: number, y: number, radius: number): string[] {
    const tile = this.getTileAtViewportPoint(x, y);

    if (!tile) {
      return [];
    }

    return [...new Set(this.getOccupiedNeighborIds(tile.x, tile.y, radius))];
  }

  placeCharacter(character: TownMapCharacter): boolean {
    const placed = this.grid.placeOccupant(character);

    if (!placed) {
      return false;
    }

    this.characterLayer.renderCharacter(character);
    this.syncTileOverlapOffsets({ x: character.x, y: character.y });
    this.canvas.requestRenderAll();
    return true;
  }

  moveCharacter(characterId: string, target: GridCoordinate): boolean {
    const { moved, position } = this.moveCharacterToTile(characterId, target);

    if (!moved || !position) {
      return false;
    }

    this.characterLayer.positionCharacterToken(characterId, position);
    return true;
  }

  updateCharacterStatus(characterId: string, statusText: string): void {
    this.characterLayer.updateCharacterStatus(characterId, statusText);
  }

  updateCharacterExpression(characterId: string, expressionText: Expression): void {
    this.characterLayer.updateCharacterExpression(characterId, expressionText);
  }

  setCharacterSpriteSheets(characterId: string, spriteSet: TownMapCharacterSpriteSet): Promise<void> {
    return this.characterLayer.setCharacterSpriteSheets(characterId, spriteSet);
  }

  setCharacterSpriteDirection(characterId: string, direction: TownMapCharacterSpriteDirection): void {
    this.characterLayer.setCharacterSpriteDirection(characterId, direction);
  }

  updateCharacterRequestMarker(
    characterId: string,
    marker: { label: string; level: CharacterRequestLevel } | null,
  ): void {
    this.characterLayer.updateCharacterRequestMarker(characterId, marker);
  }

  holdItem(characterId: string, itemDefinition: ItemDefinition): void {
    this.characterLayer.holdItem(characterId, itemDefinition);
  }

  releaseHeldItem(characterId: string): void {
    this.characterLayer.releaseHeldItem(characterId);
  }

  setCharacterDraggingEnabled(isEnabled: boolean): void {
    this.characterLayer.setCharacterDraggingEnabled(isEnabled);
  }

  playCharacterAnimation(
    characterId: string,
    animationId: CharacterPerformanceAnimationId,
    durationMs?: number,
  ): void {
    this.characterLayer.playCharacterAnimation(characterId, animationId, durationMs);
  }

  showCharacterBubble(
    characterId: string,
    text: string,
    durationMs = 2600,
    animation: MapDialogueBubbleAnimation = 'fade',
  ): void {
    this.floatingTextLayer.showCharacterBubble(characterId, text, durationMs, animation);
  }

  showCharacterEmote(characterId: string, text: string, durationMs = 1200): void {
    this.floatingTextLayer.showCharacterEmote(characterId, text, durationMs);
  }

  removeCharacterBubble(characterId: string): void {
    this.floatingTextLayer.removeCharacterBubbleById(characterId);
  }

  playMapBubbleSequence(
    sequence: MapBubbleSequence,
    onLine?: (line: MapBubbleSequenceLine) => void,
  ): () => void {
    return this.floatingTextLayer.playMapBubbleSequence(sequence, onLine);
  }

  showMapActivity(activity: MapActivityView, durationMs: number | null = 4800): void {
    this.floatingTextLayer.showMapActivity(activity, durationMs);
  }

  removeMapActivity(activityId: string): void {
    this.floatingTextLayer.removeMapActivity(activityId);
  }

  getZoom(): number {
    return this.camera.getZoom();
  }

  getCharacterTile(characterId: string): GridCoordinate | null {
    return this.grid.getOccupantTile(characterId);
  }

  removeCharacter(characterId: string): void {
    const previousTile = this.grid.getOccupantTile(characterId);

    this.cancelCharacterOffsetAnimation(characterId);
    this.grid.removeOccupant(characterId);
    this.characterTileOffsets.delete(characterId);
    this.syncTileOverlapOffsets(previousTile);
    this.characterTracker.removeCharacter(characterId);
    this.characterLayer.removeCharacterToken(characterId);
    this.floatingTextLayer.removeCharacterUi(characterId);
  }

  findPath(from: GridCoordinate, to: GridCoordinate): GridCoordinate[] | null {
    return this.grid.findPath(from, to);
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
    this.walkAnimator.walkCharacterAlongPath(characterId, path, onArrive, onBlocked);
  }

  cancelWalk(characterId: string): void {
    this.walkAnimator.cancelWalk(characterId);
  }

  pauseWalk(characterId: string, durationMs: number): boolean {
    return this.walkAnimator.pauseWalk(characterId, durationMs);
  }

  isWalking(characterId: string): boolean {
    return this.walkAnimator.isWalking(characterId);
  }

  getCell(x: number, y: number): TownMapCellData | null {
    return this.grid.getTile(x, y)?.cell ?? null;
  }

  syncPlacedItems(items: readonly { placedObject: PlacedObject; definition: ItemDefinition }[]): void {
    const nextPlacedObjectIds = new Set(items.map(item => item.placedObject.id));

    Array.from(this.placedItemShapes.entries()).forEach(([placedObjectId, shape]) => {
      if (nextPlacedObjectIds.has(placedObjectId)) {
        return;
      }

      this.canvas.remove(shape);
      this.placedItemShapes.delete(placedObjectId);
    });

    items.forEach(item => {
      this.syncPlacedItem(item.placedObject, item.definition);
    });

    sortEntityLayer(this.canvas);
    this.canvas.requestRenderAll();
  }

  destroy(): Promise<boolean> {
    this.stopAnimationLoop();
    this.cancelAllCharacterOffsetAnimations();
    this.camera.dispose();
    this.walkAnimator.dispose();
    this.floatingTextLayer.dispose();
    this.characterLayer.dispose();
    this.mapObjectShapes.clear();
    this.placedItemShapes.clear();
    return this.canvas.dispose();
  }

  private get mapWidth(): number {
    return this.grid.width * this.cellSize;
  }

  private get mapHeight(): number {
    return this.grid.height * this.cellSize;
  }

  private prepareBaseCanvas(): void {
    this.baseCanvasElement.width = this.mapWidth;
    this.baseCanvasElement.height = this.mapHeight;
    this.baseCanvasElement.style.position = 'absolute';
    this.baseCanvasElement.style.inset = '0';
    this.baseCanvasElement.style.width = `${this.mapWidth}px`;
    this.baseCanvasElement.style.height = `${this.mapHeight}px`;
    this.baseCanvasElement.style.zIndex = '0';
    this.baseCanvasElement.style.pointerEvents = 'none';
  }

  private attachBaseCanvas(entityCanvasElement: HTMLCanvasElement): void {
    if (this.baseCanvasElement.isConnected) {
      return;
    }

    entityCanvasElement.parentElement?.insertBefore(this.baseCanvasElement, entityCanvasElement);
  }

  private prepareEntityCanvas(): void {
    this.canvas.wrapperEl.style.position = 'absolute';
    this.canvas.wrapperEl.style.inset = '0';
    this.canvas.wrapperEl.style.zIndex = '1';
    this.canvas.wrapperEl.style.touchAction = 'none';
    this.canvas.lowerCanvasEl.style.touchAction = 'none';
    this.canvas.upperCanvasEl.style.touchAction = 'none';
  }

  private draw(): void {
    this.drawTerrainLayer();
    this.drawMapObjects();
    this.drawInitialCharacters();
    sortEntityLayer(this.canvas);
    this.camera.addControls();
    this.canvas.requestRenderAll();
  }

  private drawTerrainLayer(): void {
    this.baseContext.fillStyle = '#f4ecd8';
    this.baseContext.fillRect(0, 0, this.baseCanvasElement.width, this.baseCanvasElement.height);

    this.grid.getTiles().forEach(tile => {
      const style = this.terrainStyles.get(tile.cell.terrain);
      const x = tile.x * this.cellSize;
      const y = tile.y * this.cellSize;

      this.baseContext.fillStyle = style.fill;
      this.baseContext.fillRect(x, y, this.cellSize, this.cellSize);
      this.baseContext.strokeStyle = style.stroke;
      this.baseContext.lineWidth = 1;
      this.baseContext.strokeRect(x + 0.5, y + 0.5, this.cellSize, this.cellSize);
    });

    TOWN_MAP_FLOOR_DECORATIONS.forEach(decoration => {
      this.drawFloorDecoration(decoration);
    });
  }

  private drawFloorDecoration(decoration: TownMapFloorDecorationData): void {
    const left = decoration.x * this.cellSize;
    const top = decoration.y * this.cellSize;
    const width = decoration.width * this.cellSize;
    const height = decoration.length * this.cellSize;
    const tileSize = this.cellSize;

    this.baseContext.save();
    this.baseContext.fillStyle = 'rgba(229, 214, 181, 0.82)';
    this.baseContext.fillRect(left, top, width, height);
    this.baseContext.strokeStyle = 'rgba(124, 101, 72, 0.5)';
    this.baseContext.lineWidth = 1;

    for (let x = left; x <= left + width; x += tileSize) {
      this.baseContext.beginPath();
      this.baseContext.moveTo(x + 0.5, top);
      this.baseContext.lineTo(x + 0.5, top + height);
      this.baseContext.stroke();
    }

    for (let y = top; y <= top + height; y += tileSize) {
      this.baseContext.beginPath();
      this.baseContext.moveTo(left, y + 0.5);
      this.baseContext.lineTo(left + width, y + 0.5);
      this.baseContext.stroke();
    }

    this.baseContext.strokeStyle = 'rgba(91, 72, 52, 0.75)';
    this.baseContext.lineWidth = 2;
    this.baseContext.strokeRect(left + 1, top + 1, width - 2, height - 2);
    this.baseContext.restore();
  }

  private drawMapObjects(): void {
    this.grid.getMapObjects().forEach(object => {
      const shape = this.objectGlyphFactory.create(object, this.cellSize);

      this.mapObjectShapes.set(object.id, shape);
      this.canvas.add(shape);
    });
  }

  private drawInitialCharacters(): void {
    this.grid.getTiles().forEach(tile => {
      this.grid.getOccupantIdsAt(tile.x, tile.y).forEach(characterId => {
        this.characterLayer.renderCharacter({
          id: characterId,
          x: tile.x,
          y: tile.y,
          color: '#f0cc5f',
        });
      });
      this.syncTileOverlapOffsets(tile);
    });
  }

  private startAnimationLoop(): void {
    if (this.animationFrameId !== null) {
      return;
    }

    const animateAll = (timestamp: number) => {
      this.walkAnimator.advanceWalkers(timestamp);
      this.floatingTextLayer.advanceBubbleAnimations(timestamp);
      sortEntityLayer(this.canvas);

      if (this.hasActiveAnimations()) {
        this.canvas.requestRenderAll();
        this.animationFrameId = requestAnimationFrame(animateAll);
        return;
      }

      this.canvas.requestRenderAll();
      this.animationFrameId = null;
    };

    this.animationFrameId = requestAnimationFrame(animateAll);
  }

  private stopAnimationLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private stopAnimationLoopIfIdle(): void {
    if (!this.hasActiveAnimations()) {
      this.stopAnimationLoop();
    }
  }

  private hasActiveAnimations(): boolean {
    return this.walkAnimator.hasActiveAnimations() || this.floatingTextLayer.hasActiveAnimations();
  }

  private getCharacterPosition(characterId: string, coordinate: GridCoordinate): GridCoordinate {
    const center = this.characterLayer.getCharacterPosition(coordinate);
    const offset = this.characterTileOffsets.get(characterId) ?? ZERO_OFFSET;

    return {
      x: center.x + offset.x,
      y: center.y + offset.y,
    };
  }

  private moveCharacterToTile(characterId: string, target: GridCoordinate): MoveCharacterToTileResult {
    const previousTile = this.grid.getOccupantTile(characterId);

    this.cancelCharacterOffsetAnimation(characterId);

    const moved = this.grid.moveOccupant(characterId, target);

    if (!moved) {
      return { moved: false, position: null };
    }

    this.syncTileOverlapOffsets(previousTile, new Set([characterId]));
    this.syncTileOverlapOffsets(target, new Set([characterId]));

    return {
      moved: true,
      position: this.getCharacterPosition(characterId, target),
    };
  }

  private snapCharacterToGrid(characterId: string, tile: GridCoordinate | null): void {
    if (!tile) {
      return;
    }

    this.characterLayer.positionCharacterToken(characterId, this.getCharacterPosition(characterId, tile));
  }

  private syncTileOverlapOffsets(tile: GridCoordinate | null, skipPositionCharacterIds = new Set<string>()): void {
    if (!tile) {
      return;
    }

    const occupantIds = this.grid.getOccupantIdsAt(tile.x, tile.y);

    occupantIds.forEach(characterId => {
      const nextOffset = occupantIds.length > 1
        ? this.getExistingOrRandomOverlapOffset(characterId)
        : ZERO_OFFSET;

      this.characterTileOffsets.set(characterId, nextOffset);

      if (skipPositionCharacterIds.has(characterId) || this.walkAnimator.isWalking(characterId)) {
        this.cancelCharacterOffsetAnimation(characterId);
        return;
      }

      this.animateCharacterToPosition(characterId, this.getCharacterPosition(characterId, tile));
    });
  }

  private getExistingOrRandomOverlapOffset(characterId: string): GridCoordinate {
    const existingOffset = this.characterTileOffsets.get(characterId);

    if (existingOffset && !isZeroOffset(existingOffset)) {
      return existingOffset;
    }

    return createRandomOverlapOffset(this.cellSize);
  }

  private animateCharacterToPosition(characterId: string, targetPosition: GridCoordinate): void {
    const startPosition = this.getCharacterCenter(characterId);

    this.cancelCharacterOffsetAnimation(characterId);

    if (!startPosition || areSamePosition(startPosition, targetPosition)) {
      this.characterLayer.positionCharacterToken(characterId, targetPosition);
      return;
    }

    const startedAt = performance.now();
    const animate = (timestamp: number) => {
      const elapsedRatio = Math.min(1, (timestamp - startedAt) / OVERLAP_OFFSET_PUSH_DURATION_MS);
      const easedRatio = easeOutCubic(elapsedRatio);
      const nextPosition = {
        x: startPosition.x + (targetPosition.x - startPosition.x) * easedRatio,
        y: startPosition.y + (targetPosition.y - startPosition.y) * easedRatio,
      };

      this.characterLayer.positionCharacterToken(characterId, nextPosition);

      if (elapsedRatio < 1) {
        this.characterOffsetAnimationFrameIds.set(
          characterId,
          window.requestAnimationFrame(animate),
        );
        return;
      }

      this.characterOffsetAnimationFrameIds.delete(characterId);
      this.characterLayer.positionCharacterToken(characterId, targetPosition);
    };

    this.characterOffsetAnimationFrameIds.set(
      characterId,
      window.requestAnimationFrame(animate),
    );
  }

  private cancelCharacterOffsetAnimation(characterId: string): void {
    const frameId = this.characterOffsetAnimationFrameIds.get(characterId);

    if (frameId === undefined) {
      return;
    }

    window.cancelAnimationFrame(frameId);
    this.characterOffsetAnimationFrameIds.delete(characterId);
  }

  private cancelAllCharacterOffsetAnimations(): void {
    Array.from(this.characterOffsetAnimationFrameIds.keys()).forEach(characterId => {
      this.cancelCharacterOffsetAnimation(characterId);
    });
  }

  private getCharacterCenter(characterId: string): GridCoordinate | null {
    return this.characterLayer?.getCharacterCenter(characterId) ?? null;
  }

  private getMapObjectIdFromTarget(target: unknown): string | null {
    const maybeMapObject = target as { get?: (key: string) => unknown } | undefined;
    const mapObjectId = maybeMapObject?.get?.('mapObjectId');

    return typeof mapObjectId === 'string' ? mapObjectId : null;
  }

  private syncPlacedItem(placedObject: PlacedObject, definition: ItemDefinition): void {
    const position = placedObject.worldPosition;

    if (!position) {
      return;
    }

    const center = this.characterLayer.getCharacterPosition(position);
    const existingShape = this.placedItemShapes.get(placedObject.id);

    if (existingShape) {
      existingShape.set({ left: center.x, top: center.y });
      updateEntitySortMetadata(existingShape, center.y + this.cellSize * 0.5);
      existingShape.setCoords();
      return;
    }

    const shape = this.itemGlyphFactory.createPlacedItemGlyph(definition, this.cellSize);

    shape.set({
      left: center.x,
      top: center.y,
    });
    shape.set('mapObjectId', placedObject.id);
    shape.set('placedObjectId', placedObject.id);
    updateEntitySortMetadata(shape, center.y + this.cellSize * 0.5);
    this.placedItemShapes.set(placedObject.id, shape);
    this.canvas.add(shape);
  }

  private handleZoomChange(zoom: number, onZoomChange?: (zoom: number) => void): void {
    this.characterLayer?.syncViewportZoom(zoom);
    this.floatingTextLayer?.syncViewportZoom(zoom);
    onZoomChange?.(zoom);
  }
}

function createRandomOverlapOffset(cellSize: number): GridCoordinate {
  const minDistance = cellSize * OVERLAP_OFFSET_MIN_CELL_RATIO;
  const maxDistance = cellSize * OVERLAP_OFFSET_MAX_CELL_RATIO;
  const angle = Math.random() * Math.PI * 2;
  const distance = minDistance + Math.random() * (maxDistance - minDistance);

  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance,
  };
}

function isZeroOffset(offset: GridCoordinate): boolean {
  return offset.x === 0 && offset.y === 0;
}

function areSamePosition(first: GridCoordinate, second: GridCoordinate): boolean {
  return first.x === second.x && first.y === second.y;
}

function easeOutCubic(value: number): number {
  return 1 - ((1 - value) ** 3);
}
