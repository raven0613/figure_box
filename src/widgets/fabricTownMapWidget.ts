import { Canvas, type Group } from 'fabric';
import { TownMapGrid, type GridCoordinate, type TownMapTile } from './townMapGrid';
import { TownMapCamera } from './townMapCamera';
import { TownMapCharacterTracker } from './townMapCharacterTracker';
import { TownMapCharacterLayer } from './townMapCharacterLayer';
import { TownMapFloatingTextLayer } from './townMapFloatingTextLayer';
import { TownMapWalkAnimator } from './townMapWalkAnimator';
import { TownMapPointerController } from './townMapPointerController';
import {
  MapObjectGlyphFactory,
  TerrainStyleCatalog,
} from './townMapObjectGlyphFactory';
import { sortEntityLayer } from './townMapLayerSorter';
import { DEFAULT_CELL_SIZE } from '../constants/townMapWidgetConstants';
import type { Expression } from '~/constants/character';
import type { MapActivityView, MapBubbleSequence, MapBubbleSequenceLine } from '~/typing/eventDialoguePresentation';
import type { MapDialogueBubbleAnimation } from '~/constants/event';
import type { TownMapCellData, TownMapObjectData } from '~/constants/townMap';
import type {
  FabricTownMapOptions,
  TownMapCharacter,
} from './townMapWidgetTypes';

export type {
  FabricTownMapOptions,
  TownMapCharacter,
} from './townMapWidgetTypes';

export class FabricTownMapWidget {
  private readonly baseCanvasElement: HTMLCanvasElement;
  private readonly baseContext: CanvasRenderingContext2D;
  private readonly canvas: Canvas;
  private readonly camera: TownMapCamera;
  private readonly characterTracker: TownMapCharacterTracker;
  private readonly characterLayer: TownMapCharacterLayer;
  private readonly floatingTextLayer: TownMapFloatingTextLayer;
  private readonly walkAnimator: TownMapWalkAnimator;
  private readonly grid = new TownMapGrid();
  private readonly terrainStyles = new TerrainStyleCatalog();
  private readonly objectGlyphFactory = new MapObjectGlyphFactory();
  private readonly cellSize: number;
  private readonly mapObjectShapes = new Map<string, Group>();
  private animationFrameId: number | null = null;

  constructor(canvasElement: HTMLCanvasElement | string, options: FabricTownMapOptions = {}) {
    this.cellSize = options.cellSize ?? DEFAULT_CELL_SIZE;

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
    });
    this.walkAnimator = new TownMapWalkAnimator({
      grid: this.grid,
      cellSize: this.cellSize,
      getCharacterToken: characterId => this.characterLayer.getToken(characterId),
      getCharacterTile: characterId => this.getCharacterTile(characterId),
      getCharacterPosition: coordinate => this.getCharacterPosition(coordinate),
      positionToken: (token, position) => {
        this.characterLayer.positionToken(token, position);
      },
      startAnimationLoop: () => this.startAnimationLoop(),
      stopAnimationLoopIfIdle: () => this.stopAnimationLoopIfIdle(),
    });
    const pointerController = new TownMapPointerController({
      canvas: this.canvas,
      camera: this.camera,
      characterTracker: this.characterTracker,
      grid: this.grid,
      cellSize: this.cellSize,
      getCharacterIdFromTarget: target => this.characterLayer.getCharacterIdFromTarget(target),
      getCharacterTile: characterId => this.getCharacterTile(characterId),
      snapCharacterToGrid: (characterId, tile) => {
        this.characterLayer.snapCharacterToGrid(characterId, tile);
      },
      onTileClick: options.onTileClick,
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

  getMapObjectsAt(x: number, y: number): TownMapObjectData[] {
    return this.grid.getMapObjectsAt(x, y);
  }

  placeCharacter(character: TownMapCharacter): boolean {
    const placed = this.grid.placeOccupant(character);

    if (!placed) {
      return false;
    }

    this.characterLayer.renderCharacter(character);
    this.canvas.requestRenderAll();
    return true;
  }

  moveCharacter(characterId: string, target: GridCoordinate): boolean {
    const moved = this.grid.moveOccupant(characterId, target);

    if (!moved) {
      return false;
    }

    this.characterLayer.moveCharacterToken(characterId, target);
    return true;
  }

  updateCharacterStatus(characterId: string, statusText: string): void {
    this.characterLayer.updateCharacterStatus(characterId, statusText);
  }

  updateCharacterExpression(characterId: string, expressionText: Expression): void {
    this.characterLayer.updateCharacterExpression(characterId, expressionText);
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

  playMapBubbleSequence(
    sequence: MapBubbleSequence,
    onLine?: (line: MapBubbleSequenceLine) => void,
  ): () => void {
    return this.floatingTextLayer.playMapBubbleSequence(sequence, onLine);
  }

  showMapActivity(activity: MapActivityView, durationMs = 4800): void {
    this.floatingTextLayer.showMapActivity(activity, durationMs);
  }

  getZoom(): number {
    return this.camera.getZoom();
  }

  getCharacterTile(characterId: string): GridCoordinate | null {
    return this.grid.getOccupantTile(characterId);
  }

  removeCharacter(characterId: string): void {
    this.grid.removeOccupant(characterId);
    this.characterTracker.removeCharacter(characterId);
    this.characterLayer.removeCharacterToken(characterId);
    this.floatingTextLayer.removeCharacterUi(characterId);
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
    this.walkAnimator.walkCharacterAlongPath(characterId, path, onArrive, onBlocked);
  }

  cancelWalk(characterId: string): void {
    this.walkAnimator.cancelWalk(characterId);
  }

  getCell(x: number, y: number): TownMapCellData | null {
    return this.grid.getTile(x, y)?.cell ?? null;
  }

  destroy(): Promise<boolean> {
    this.stopAnimationLoop();
    this.camera.dispose();
    this.walkAnimator.dispose();
    this.floatingTextLayer.dispose();
    this.characterLayer.dispose();
    this.mapObjectShapes.clear();
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
      if (!tile.cell.occupantId) {
        return;
      }

      this.characterLayer.renderCharacter({
        id: tile.cell.occupantId,
        x: tile.x,
        y: tile.y,
        color: '#f0cc5f',
      });
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

  private getCharacterPosition(coordinate: GridCoordinate): GridCoordinate {
    return this.characterLayer.getCharacterPosition(coordinate);
  }

  private getCharacterCenter(characterId: string): GridCoordinate | null {
    return this.characterLayer?.getCharacterCenter(characterId) ?? null;
  }
}
