import { Canvas, Circle, Ellipse, FabricObject, Group, Rect, Text } from 'fabric';
import { TownMapGrid, type CharacterPlacement, type GridCoordinate, type TownMapTile } from './townMapGrid';
import { TownMapCamera } from './townMapCamera';
import { TownMapCharacterTracker } from './townMapCharacterTracker';
import { Expression } from '~/constants/character';
import type { MapActivityView, MapBubbleSequence, MapBubbleSequenceLine } from '~/typing/eventDialoguePresentation';
import type { MapDialogueBubbleAnimation } from '~/constants/event';
import type { TerrainType, TownMapCellData, TownMapObjectData, TownMapObjectType } from '~/constants/townMap';

export interface TownMapCharacter extends CharacterPlacement {
  color?: string;
  label?: string;
  statusText?: string;
  expression?: Expression;
}

export interface FabricTownMapOptions {
  baseCanvasElement?: HTMLCanvasElement;
  cellSize?: number;
  onTileClick?: (tile: TownMapTile) => void;
  onCharacterPickUp?: (characterId: string) => void;
  onCharacterDrop?: (characterId: string, tile: GridCoordinate | null) => void;
}

interface TerrainStyle {
  fill: string;
  stroke: string;
}

const DEFAULT_CELL_SIZE = 20;
const CHARACTER_RADIUS_RATIO = 0.28;
const CHARACTER_SCALE = 2;
const DEFAULT_ENTITY_LAYER_RANK = 50;
const FLOATING_UI_LAYER_RANK = 100;

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
  create(object: TownMapObjectData, cellSize: number): Group {
    if (object.type === 'tree') {
      return this.createTree(object, cellSize);
    }

    if (object.type === 'lamp') {
      return this.createLamp(object, cellSize);
    }

    const left = object.x * cellSize;
    const top = object.y * cellSize;
    const width = object.width * cellSize;
    const height = object.height * cellSize;
    const body = new Rect({
      left: 0,
      top: 0,
      width,
      height,
      originX: 'left',
      originY: 'top',
      fill: this.getFill(object.type),
      stroke: '#263238',
      strokeWidth: 1,
      rx: Math.min(4, cellSize * 0.25),
      ry: Math.min(4, cellSize * 0.25),
      selectable: false,
      evented: false,
    });
    const glyph = new Text(this.getGlyph(object.type), {
      left: width / 2,
      top: height / 2,
      originX: 'center',
      originY: 'center',
      fontSize: Math.max(8, Math.min(width, height) * 0.38),
      fontFamily: 'Arial, sans-serif',
      fontWeight: '700',
      fill: '#f7fbff',
      selectable: false,
      evented: false,
    });
    const group = new Group([body, glyph], {
      left,
      top,
      originX: 'left',
      originY: 'top',
      selectable: false,
      evented: false,
      objectCaching: true,
    });

    group.set('mapObjectId', object.id);
    group.set('sortBottomY', top + height);
    group.set('entityLayerRank', this.getLayerRank(object.layer));
    return group;
  }

  private createTree(object: TownMapObjectData, cellSize: number): Group {
    const width = object.width * cellSize;
    const height = object.height * cellSize;
    const centerX = width / 2;

    const trunkWidth = width * 0.2;
    const trunkHeight = height * 0.35;
    const trunk = new Rect({
      left: centerX - trunkWidth / 2,
      top: height - trunkHeight,
      width: trunkWidth,
      height: trunkHeight,
      originX: 'left',
      originY: 'top',
      fill: '#5c3a1e',
      selectable: false,
      evented: false,
    });

    const crownRx = width * 0.48;
    const crownRy = height * 0.38;
    const crown = new Ellipse({
      left: centerX,
      top: height * 0.38,
      rx: crownRx,
      ry: crownRy,
      originX: 'center',
      originY: 'center',
      fill: '#2f7651',
      selectable: false,
      evented: false,
    });

    const left = object.x * cellSize;
    const top = object.y * cellSize;
    const group = new Group([trunk, crown], {
      left,
      top,
      originX: 'left',
      originY: 'top',
      selectable: false,
      evented: false,
      objectCaching: true,
    });

    group.set('mapObjectId', object.id);
    group.set('sortBottomY', top + height);
    group.set('entityLayerRank', this.getLayerRank(object.layer));
    return group;
  }

  private createLamp(object: TownMapObjectData, cellSize: number): Group {
    const width = object.width * cellSize;
    const height = object.height * cellSize;
    const centerX = width / 2;

    const poleWidth = width * 0.15;
    const poleHeight = height * 0.75;
    const pole = new Rect({
      left: centerX - poleWidth / 2,
      top: height - poleHeight,
      width: poleWidth,
      height: poleHeight,
      originX: 'left',
      originY: 'top',
      fill: '#5a5a5a',
      selectable: false,
      evented: false,
    });

    const headWidth = width * 0.6;
    const headHeight = height * 0.15;
    const head = new Rect({
      left: centerX - headWidth / 2,
      top: height - poleHeight - headHeight * 0.3,
      width: headWidth,
      height: headHeight,
      originX: 'left',
      originY: 'top',
      fill: '#d0a84f',
      rx: headHeight * 0.3,
      ry: headHeight * 0.3,
      selectable: false,
      evented: false,
    });

    const glowRadius = width * 0.2;
    const glow = new Circle({
      left: centerX,
      top: height - poleHeight - headHeight * 0.3 + headHeight / 2,
      radius: glowRadius,
      originX: 'center',
      originY: 'center',
      fill: '#ffeaa7',
      opacity: 0.5,
      selectable: false,
      evented: false,
    });

    const left = object.x * cellSize;
    const top = object.y * cellSize;
    const group = new Group([glow, pole, head], {
      left,
      top,
      originX: 'left',
      originY: 'top',
      selectable: false,
      evented: false,
      objectCaching: true,
    });

    group.set('mapObjectId', object.id);
    group.set('sortBottomY', top + height);
    group.set('entityLayerRank', this.getLayerRank(object.layer));
    return group;
  }

  private getGlyph(type: TownMapObjectType): string {
    const glyphs: Record<TownMapObjectType, string> = {
      well: 'W',
      marketStall: 'M',
      sign: 'S',
      door: 'D',
      tree: 'T',
      lamp: 'L',
      ground: 'G',
      chair: 'C',
      table: 'Tb',
      bookcase: 'B',
      statue: 'St',
      noticeBoard: 'N',
      gate: 'Ga',
    };

    return glyphs[type];
  }

  private getFill(type: TownMapObjectType): string {
    const fills: Record<TownMapObjectType, string> = {
      well: '#5d7f91',
      marketStall: '#b15f4a',
      sign: '#806246',
      door: '#6e4d36',
      tree: '#2f7651',
      lamp: '#d0a84f',
      ground: '#6f7e86',
      chair: '#9b6a45',
      table: '#7f5c3f',
      bookcase: '#5b3f2f',
      statue: '#7c8792',
      noticeBoard: '#8a633f',
      gate: '#4f6c78',
    };

    return fills[type];
  }

  private getLayerRank(layer: TownMapObjectData['layer']): number {
    const ranks: Record<TownMapObjectData['layer'], number> = {
      floorObject: 0,
      wallObject: 1,
      decoration: 2,
    };

    return ranks[layer];
  }
}

class CharacterTokenFactory {
  create(character: TownMapCharacter, center: GridCoordinate, cellSize: number): Group {
    const renderSize = cellSize * CHARACTER_SCALE;
    const token = new Circle({
      radius: renderSize * CHARACTER_RADIUS_RATIO,
      fill: character.color ?? '#f2d16b',
      stroke: '#2d2d2d',
      strokeWidth: 2,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });
    const label = new Text(character.label ?? character.id.slice(0, 1).toUpperCase(), {
      fontSize: renderSize * 0.28,
      fontWeight: '700',
      fontFamily: 'Arial, sans-serif',
      fill: '#1f1f1f',
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });
    const status = new Text(character.statusText ?? '', {
      top: -renderSize * 0.48,
      fontSize: 10,
      fontFamily: 'Arial, sans-serif',
      fill: '#20252b',
      backgroundColor: 'rgba(255, 255, 255, 0.82)',
      originX: 'center',
      originY: 'bottom',
      selectable: false,
      evented: false,
    });
    const expression = new Text(character.expression ?? Expression.Normal, {
      top: -renderSize * 0.82,
      fontSize: 10,
      fontFamily: 'Arial, sans-serif',
      fill: '#24313a',
      backgroundColor: 'rgba(174, 230, 204, 0.9)',
      originX: 'center',
      originY: 'bottom',
      selectable: false,
      evented: false,
    });
    const group = new Group([expression, status, token, label], {
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
    group.set('expressionObject', expression);
    return group;
  }
}

interface WalkState {
  token: Group;
  allPoints: GridCoordinate[];
  segmentLengths: number[];
  currentSegment: number;
  segmentProgress: number;
  lastTimestamp: number | null;
  speed: number;
  path: GridCoordinate[];
  characterId: string;
  onArrive: (position: GridCoordinate) => void;
  onBlocked: (position: GridCoordinate) => void;
}

interface BubbleAnimationState {
  bubble: Text;
  animation: MapDialogueBubbleAnimation;
  startedAt: number | null;
  durationMs: number;
  startLeft: number;
  startTop: number;
  direction: 1 | -1;
}

export class FabricTownMapWidget {
  private readonly baseCanvasElement: HTMLCanvasElement;
  private readonly baseContext: CanvasRenderingContext2D;
  private readonly canvas: Canvas;
  private readonly camera: TownMapCamera;
  private readonly characterTracker: TownMapCharacterTracker;
  private readonly grid = new TownMapGrid();
  private readonly terrainStyles = new TerrainStyleCatalog();
  private readonly objectGlyphFactory = new MapObjectGlyphFactory();
  private readonly characterTokenFactory = new CharacterTokenFactory();
  private readonly cellSize: number;
  private readonly mapObjectShapes = new Map<string, Group>();
  private readonly characterTokens = new Map<string, Group>();
  private readonly characterBubbles = new Map<string, Text>();
  private readonly bubbleTimers = new Map<string, number>();
  private readonly bubbleAnimations = new Map<string, BubbleAnimationState>();
  private readonly mapActivityLabels = new Map<string, Text>();
  private readonly mapActivityTimers = new Map<string, number>();
  private readonly walkers = new Map<string, WalkState>();
  private animationFrameId: number | null = null;
  private pendingTileClick: TownMapTile | null = null;
  private readonly onTileClick?: (tile: TownMapTile) => void;
  private readonly onCharacterPickUp?: (characterId: string) => void;
  private readonly onCharacterDrop?: (characterId: string, tile: GridCoordinate | null) => void;

  constructor(canvasElement: HTMLCanvasElement | string, options: FabricTownMapOptions = {}) {
    this.cellSize = options.cellSize ?? DEFAULT_CELL_SIZE;
    this.onTileClick = options.onTileClick;
    this.onCharacterPickUp = options.onCharacterPickUp;
    this.onCharacterDrop = options.onCharacterDrop;

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
      width: this.grid.width * this.cellSize,
      height: this.grid.height * this.cellSize,
      backgroundColor: 'transparent',
      selection: false,
      allowTouchScrolling: false,
    });
    this.prepareEntityCanvas();
    this.camera = new TownMapCamera({
      canvas: this.canvas,
      baseCanvasElement: this.baseCanvasElement,
      mapWidth: this.grid.width * this.cellSize,
      mapHeight: this.grid.height * this.cellSize,
      viewportWidth: this.grid.width * this.cellSize,
      viewportHeight: this.grid.height * this.cellSize,
    });
    this.characterTracker = new TownMapCharacterTracker({
      canvas: this.canvas,
      camera: this.camera,
      getCharacterCenter: characterId => this.getCharacterCenter(characterId),
    });
    this.bindPointerEvents();
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
      this.updateEntitySortMetadata(token, pos.y);
      token.setCoords();
      this.sortEntityLayer();
      this.characterTracker.update();
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

  updateCharacterExpression(characterId: string, expressionText: Expression): void {
    const token = this.characterTokens.get(characterId);
    const expression = token?.get('expressionObject') as Text | undefined;

    if (!token || !expression || expression.text === expressionText) {
      return;
    }

    expression.set('text', expressionText);
    token.setCoords();
    this.canvas.requestRenderAll();
  }

  showCharacterBubble(
    characterId: string,
    text: string,
    durationMs = 2600,
    animation: MapDialogueBubbleAnimation = 'fade',
  ): void {
    const token = this.characterTokens.get(characterId);

    if (!token) {
      return;
    }

    const existingTimer = this.bubbleTimers.get(characterId);

    if (existingTimer) {
      window.clearTimeout(existingTimer);
      this.bubbleTimers.delete(characterId);
    }
    this.bubbleAnimations.delete(characterId);

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
      bubble.set('sortBottomY', Number.POSITIVE_INFINITY);
      bubble.set('entityLayerRank', FLOATING_UI_LAYER_RANK);
      this.characterBubbles.set(characterId, bubble);
      this.canvas.add(bubble);
    }

    bubble.set({
      text,
      left: token.left ?? 0,
      top: (token.top ?? 0) - this.cellSize * CHARACTER_SCALE * 0.46,
      opacity: animation === 'fade' ? 0 : 1,
    });
    this.canvas.bringObjectToFront(bubble);
    this.bubbleAnimations.set(characterId, {
      bubble,
      animation,
      startedAt: null,
      durationMs,
      startLeft: token.left ?? 0,
      startTop: (token.top ?? 0) - this.cellSize * CHARACTER_SCALE * 0.46,
      direction: Math.random() > 0.5 ? 1 : -1,
    });
    this.startAnimationLoop();
    this.canvas.requestRenderAll();

    const timer = window.setTimeout(() => {
      this.removeCharacterBubble(characterId);
    }, durationMs);

    this.bubbleTimers.set(characterId, timer);
  }

  playMapBubbleSequence(
    sequence: MapBubbleSequence,
    onLine?: (line: MapBubbleSequenceLine) => void,
  ): () => void {
    if (sequence.visibleAtZoom !== undefined && this.getZoom() < sequence.visibleAtZoom) {
      return () => undefined;
    }

    const timers = sequence.lines.map((line, index) => window.setTimeout(() => {
      onLine?.(line);
      this.showMapBubbleSequenceLine(line, sequence);
    }, index * sequence.intervalMs));

    return () => {
      timers.forEach(timer => window.clearTimeout(timer));
    };
  }

  showMapActivity(activity: MapActivityView, durationMs = 4800): void {
    if (activity.visibleAtZoom !== undefined && this.getZoom() < activity.visibleAtZoom) {
      return;
    }

    const points = activity.participantIds
      .map(characterId => this.getCharacterCenter(characterId))
      .filter((point): point is GridCoordinate => point !== null);

    if (points.length === 0) {
      return;
    }

    const existingTimer = this.mapActivityTimers.get(activity.id);

    if (existingTimer) {
      window.clearTimeout(existingTimer);
      this.mapActivityTimers.delete(activity.id);
    }

    const center = points.reduce(
      (sum, point) => ({
        x: sum.x + point.x / points.length,
        y: sum.y + point.y / points.length,
      }),
      { x: 0, y: 0 },
    );
    let label = this.mapActivityLabels.get(activity.id);

    if (!label) {
      label = new Text(activity.label, {
        fontSize: 12,
        fontFamily: 'Arial, sans-serif',
        fontWeight: '700',
        fill: '#24313a',
        backgroundColor: 'rgba(246, 232, 184, 0.94)',
        originX: 'center',
        originY: 'bottom',
        selectable: false,
        evented: false,
      });
      label.set('sortBottomY', Number.POSITIVE_INFINITY);
      label.set('entityLayerRank', FLOATING_UI_LAYER_RANK);
      this.mapActivityLabels.set(activity.id, label);
      this.canvas.add(label);
    }

    label.set({
      text: activity.label,
      left: center.x,
      top: center.y - this.cellSize * CHARACTER_SCALE * 1.1,
    });
    this.canvas.bringObjectToFront(label);
    this.canvas.requestRenderAll();

    const timer = window.setTimeout(() => {
      const currentLabel = this.mapActivityLabels.get(activity.id);

      if (currentLabel) {
        this.canvas.remove(currentLabel);
        this.mapActivityLabels.delete(activity.id);
        this.canvas.requestRenderAll();
      }

      this.mapActivityTimers.delete(activity.id);
    }, durationMs);

    this.mapActivityTimers.set(activity.id, timer);
  }

  getZoom(): number {
    return this.camera.getZoom();
  }

  getCharacterTile(characterId: string): GridCoordinate | null {
    return this.grid.getOccupantTile(characterId);
  }

  removeCharacter(characterId: string): void {
    const token = this.characterTokens.get(characterId);
    this.grid.removeOccupant(characterId);
    this.characterTracker.removeCharacter(characterId);

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
    this.bubbleAnimations.delete(characterId);

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

    const moved = this.grid.moveOccupant(characterId, path[0]);

    if (!moved) {
      const currentTile = this.getCharacterTile(characterId);
      onBlocked(currentTile ?? path[0]);
      return;
    }

    const speed = this.cellSize / 300;
    const waypoints = path.map(p => this.getCharacterPosition(p));
    const startPos = { x: token.left ?? 0, y: token.top ?? 0 };
    const allPoints = [startPos, ...waypoints];
    const segmentLengths: number[] = [];

    for (let i = 0; i < allPoints.length - 1; i++) {
      const dx = allPoints[i + 1].x - allPoints[i].x;
      const dy = allPoints[i + 1].y - allPoints[i].y;
      segmentLengths.push(Math.sqrt(dx * dx + dy * dy));
    }

    this.walkers.set(characterId, {
      token,
      allPoints,
      segmentLengths,
      currentSegment: 0,
      segmentProgress: 0,
      lastTimestamp: null,
      speed,
      path,
      characterId,
      onArrive,
      onBlocked,
    });

    this.startAnimationLoop();
  }

  cancelWalk(characterId: string): void {
    this.walkers.delete(characterId);

    if (!this.hasActiveAnimations()) {
      this.stopAnimationLoop();
    }
  }

  getCell(x: number, y: number): TownMapCellData | null {
    return this.grid.getTile(x, y)?.cell ?? null;
  }

  destroy(): Promise<boolean> {
    this.stopAnimationLoop();
    this.camera.dispose();
    this.walkers.clear();
    this.bubbleAnimations.clear();
    this.bubbleTimers.forEach(timer => window.clearTimeout(timer));
    this.bubbleTimers.clear();
    this.mapActivityTimers.forEach(timer => window.clearTimeout(timer));
    this.mapActivityTimers.clear();
    this.characterBubbles.clear();
    this.mapActivityLabels.clear();
    this.mapObjectShapes.clear();
    return this.canvas.dispose();
  }

  private bindPointerEvents(): void {
    this.canvas.on('mouse:wheel', event => {
      this.camera.handleWheel(event.e);
    });

    this.canvas.on('mouse:down', event => {
      this.pendingTileClick = null;

      if (this.camera.isZoomControl(event.target)) {
        return;
      }

      if (this.characterTracker.isTrackingControl(event.target)) {
        return;
      }

      const characterId = this.getCharacterIdFromTarget(event.target);

      if (characterId) {
        this.characterTracker.selectCharacter(characterId);
        this.onCharacterPickUp?.(characterId);
        return;
      }

      const pointer = this.canvas.getScenePoint(event.e);
      this.pendingTileClick = this.grid.getTile(Math.floor(pointer.x / this.cellSize), Math.floor(pointer.y / this.cellSize));
      this.camera.startPan(event.e, event.target);
    });

    this.canvas.on('mouse:move', event => {
      this.camera.pan(event.e);
    });

    this.canvas.on('mouse:up', event => {
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

      if (!characterId && this.pendingTileClick && !didPan) {
        this.onTileClick?.(this.pendingTileClick);
      }

      this.pendingTileClick = null;

      if (!characterId) {
        return;
      }

      const pointer = this.canvas.getScenePoint(event.e);
      const tile = this.grid.getTile(Math.floor(pointer.x / this.cellSize), Math.floor(pointer.y / this.cellSize));
      this.onCharacterDrop?.(characterId, tile ? { x: tile.x, y: tile.y } : null);
      this.snapCharacterToGrid(characterId);
    });
  }

  private prepareBaseCanvas(): void {
    const width = this.grid.width * this.cellSize;
    const height = this.grid.height * this.cellSize;
    this.baseCanvasElement.width = width;
    this.baseCanvasElement.height = height;
    this.baseCanvasElement.style.position = 'absolute';
    this.baseCanvasElement.style.inset = '0';
    this.baseCanvasElement.style.width = `${width}px`;
    this.baseCanvasElement.style.height = `${height}px`;
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

    this.grid.getMapObjects().forEach(object => {
      const shape = this.objectGlyphFactory.create(object, this.cellSize);
      this.mapObjectShapes.set(object.id, shape);
      this.canvas.add(shape);
    });

    this.grid.getTiles().forEach(tile => {
      if (tile.cell.occupantId) {
        this.renderCharacter({
          id: tile.cell.occupantId,
          x: tile.x,
          y: tile.y,
          color: '#f0cc5f',
        });
      }
    });

    this.sortEntityLayer();
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

  private startAnimationLoop(): void {
    if (this.animationFrameId !== null) {
      return;
    }

    const animateAll = (timestamp: number) => {
      const completedWalkers: { id: string; walker: WalkState }[] = [];

      this.walkers.forEach((walker, id) => {
        const result = this.advanceWalker(walker, timestamp);

        if (result !== 'continue') {
          completedWalkers.push({ id, walker });
        }
      });

      completedWalkers.forEach(({ id, walker }) => {
        if (this.walkers.get(id) === walker) {
          this.walkers.delete(id);
        }
      });
      this.advanceBubbleAnimations(timestamp);

      this.sortEntityLayer();

      if (this.hasActiveAnimations()) {
        this.canvas.requestRenderAll();
        this.animationFrameId = requestAnimationFrame(animateAll);
      } else {
        this.canvas.requestRenderAll();
        this.animationFrameId = null;
      }
    };

    this.animationFrameId = requestAnimationFrame(animateAll);
  }

  private stopAnimationLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private hasActiveAnimations(): boolean {
    return this.walkers.size > 0 || this.bubbleAnimations.size > 0;
  }

  private advanceWalker(walker: WalkState, timestamp: number): 'continue' | 'done' {
    if (walker.lastTimestamp === null) {
      walker.lastTimestamp = timestamp;
    }

    const delta = timestamp - walker.lastTimestamp;
    walker.lastTimestamp = timestamp;
    walker.segmentProgress += walker.speed * delta;

    while (
      walker.currentSegment < walker.segmentLengths.length
      && walker.segmentProgress >= walker.segmentLengths[walker.currentSegment]
    ) {
      walker.segmentProgress -= walker.segmentLengths[walker.currentSegment];
      walker.currentSegment++;

      if (walker.currentSegment < walker.path.length) {
        const nextMoved = this.grid.moveOccupant(walker.characterId, walker.path[walker.currentSegment]);

        if (!nextMoved) {
          const snapPoint = walker.allPoints[walker.currentSegment];
          walker.token.set({ left: snapPoint.x, top: snapPoint.y });
          this.updateEntitySortMetadata(walker.token, snapPoint.y);
          walker.token.setCoords();
          this.characterTracker.update();
          const currentTile = this.getCharacterTile(walker.characterId);
          walker.onBlocked(currentTile ?? walker.path[walker.currentSegment]);
          return 'done';
        }
      }
    }

    if (walker.currentSegment >= walker.segmentLengths.length) {
      const final = walker.allPoints[walker.allPoints.length - 1];
      walker.token.set({ left: final.x, top: final.y });
      this.updateEntitySortMetadata(walker.token, final.y);
      walker.token.setCoords();
      this.characterTracker.update();
      walker.onArrive(walker.path[walker.path.length - 1]);
      return 'done';
    }

    const t = walker.segmentProgress / walker.segmentLengths[walker.currentSegment];
    const from = walker.allPoints[walker.currentSegment];
    const to = walker.allPoints[walker.currentSegment + 1];
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;

    walker.token.set({ left: x, top: y });
    this.updateEntitySortMetadata(walker.token, y);
    walker.token.setCoords();
    this.characterTracker.update();
    return 'continue';
  }

  private advanceBubbleAnimations(timestamp: number): void {
    const completedCharacterIds: string[] = [];

    this.bubbleAnimations.forEach((state, characterId) => {
      if (state.startedAt === null) {
        state.startedAt = timestamp;
      }

      const progress = Math.min(1, (timestamp - state.startedAt) / state.durationMs);

      if (state.animation === 'fade') {
        this.applyFadeBubbleAnimation(state, progress);
      } else {
        this.applyBounceAwayBubbleAnimation(state, progress);
      }

      if (progress >= 1) {
        completedCharacterIds.push(characterId);
      }
    });

    completedCharacterIds.forEach(characterId => {
      this.removeCharacterBubble(characterId);
    });
  }

  private applyFadeBubbleAnimation(state: BubbleAnimationState, progress: number): void {
    const opacity = progress < 0.18
      ? progress / 0.18
      : progress > 0.78
        ? Math.max(0, (1 - progress) / 0.22)
        : 1;

    state.bubble.set({
      opacity,
      left: state.startLeft,
      top: state.startTop - easeOutCubic(progress) * this.cellSize * 0.35,
    });
  }

  private applyBounceAwayBubbleAnimation(state: BubbleAnimationState, progress: number): void {
    const travel = easeOutBack(progress) * this.cellSize * 1.35 * state.direction;
    const hop = Math.sin(progress * Math.PI) * this.cellSize * 0.34;
    const opacity = progress < 0.62 ? 1 : Math.max(0, (1 - progress) / 0.38);

    state.bubble.set({
      opacity,
      left: state.startLeft + travel,
      top: state.startTop - hop,
      angle: state.direction * progress * 7,
    });
  }

  private showMapBubbleSequenceLine(line: MapBubbleSequenceLine, sequence: MapBubbleSequence): void {
    if (line.expression) {
      this.updateCharacterExpression(line.characterId, line.expression);
    }

    this.showCharacterBubble(
      line.characterId,
      line.text,
      sequence.bubbleDurationMs,
      sequence.animation,
    );
  }

  private removeCharacterBubble(characterId: string): void {
    const timer = this.bubbleTimers.get(characterId);

    if (timer) {
      window.clearTimeout(timer);
      this.bubbleTimers.delete(characterId);
    }

    const currentBubble = this.characterBubbles.get(characterId);

    if (!currentBubble) {
      this.bubbleAnimations.delete(characterId);
      return;
    }

    this.canvas.remove(currentBubble);
    this.characterBubbles.delete(characterId);
    this.bubbleAnimations.delete(characterId);
    this.canvas.requestRenderAll();
  }

  private renderCharacter(character: TownMapCharacter): void {
    const pos = this.getCharacterPosition(character);
    const existing = this.characterTokens.get(character.id);

    if (existing) {
      existing.set({ left: pos.x, top: pos.y });
      this.updateEntitySortMetadata(existing, pos.y);
      existing.setCoords();
      this.sortEntityLayer();
      this.characterTracker.update();
      return;
    }

    const token = this.characterTokenFactory.create(character, pos, this.cellSize);
    this.updateEntitySortMetadata(token, pos.y);
    this.characterTokens.set(character.id, token);
    this.canvas.add(token);
    this.sortEntityLayer();
    this.characterTracker.update();
  }

  private snapCharacterToGrid(characterId: string): void {
    const currentTile = this.getCharacterTile(characterId);
    const token = this.characterTokens.get(characterId);

    if (!currentTile || !token) {
      return;
    }

    const pos = this.getCharacterPosition(currentTile);
    token.set({ left: pos.x, top: pos.y });
    this.updateEntitySortMetadata(token, pos.y);
    token.setCoords();
    this.sortEntityLayer();
    this.characterTracker.update();
    this.canvas.requestRenderAll();
  }

  private sortEntityLayer(): void {
    const sortedObjects = [...this.canvas.getObjects()].sort((first, second) => {
      const firstBottomY = this.getNumericFabricValue(first, 'sortBottomY');
      const secondBottomY = this.getNumericFabricValue(second, 'sortBottomY');
      const bottomDelta = firstBottomY - secondBottomY;

      if (bottomDelta !== 0) {
        return bottomDelta;
      }

      return this.getNumericFabricValue(first, 'entityLayerRank') - this.getNumericFabricValue(second, 'entityLayerRank');
    });

    sortedObjects.forEach((object, index) => {
      this.canvas.moveObjectTo(object, index);
    });
  }

  private updateEntitySortMetadata(object: FabricObject, bottomY: number): void {
    object.set('sortBottomY', bottomY);
    object.set('entityLayerRank', object.get('entityLayerRank') ?? DEFAULT_ENTITY_LAYER_RANK);
  }

  private getNumericFabricValue(object: FabricObject, key: string): number {
    const value = object.get(key);
    return typeof value === 'number' ? value : 0;
  }

  private getCharacterPosition(coordinate: GridCoordinate): GridCoordinate {
    return {
      x: coordinate.x * this.cellSize + this.cellSize / 2,
      y: coordinate.y * this.cellSize + this.cellSize / 2,
    };
  }

  private getCharacterCenter(characterId: string): GridCoordinate | null {
    const token = this.characterTokens.get(characterId);

    if (!token) {
      return null;
    }

    return {
      x: token.left ?? 0,
      y: token.top ?? 0,
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

function easeOutCubic(progress: number): number {
  return 1 - Math.pow(1 - progress, 3);
}

function easeOutBack(progress: number): number {
  const overshoot = 1.45;
  const shifted = progress - 1;

  return 1 + (overshoot + 1) * Math.pow(shifted, 3) + overshoot * Math.pow(shifted, 2);
}
