import { Canvas, FabricImage, Rect, type Group } from 'fabric';
import { TOWN_MAP_CHARACTER_RENDER_SCALE } from '~/constants/townMapWidgetConstants';
import { sortEntityLayer } from './townMapLayerSorter';
import type { GridCoordinate } from './townMapGrid';

const wallImageUrl = new URL('../assets/map/wall.png', import.meta.url).href;

const CINEMATIC_DIM_LAYER_RANK = 1_000;
const CINEMATIC_WALL_LAYER_RANK = 1_100;
const CINEMATIC_CHARACTER_LAYER_RANK = 1_200;

export type WallSlamDirection = 'north' | 'east' | 'south' | 'west';

export interface ShowWallSlamSceneInput {
  initiatorId: string;
  targetId: string;
  direction: WallSlamDirection;
  wallDistanceCells: number;
  wallDropDistanceCells: number;
  wallEnterDurationMs: number;
  backgroundDimOpacity: number;
  backgroundDimDurationMs: number;
}

interface HideWallSlamSceneInput {
  wallExitDurationMs: number;
  backgroundDimDurationMs: number;
}

interface CharacterLayerMetadata {
  entityLayerRank: unknown;
  sortBottomY: unknown;
}

interface ActiveCinematicScene {
  dimOverlay: Rect;
  focusedCharacterMetadata: Map<string, CharacterLayerMetadata>;
  wall: FabricImage;
}

interface ActiveDialogueFocus {
  dimOverlay: Rect;
  focusedCharacterMetadata: Map<string, CharacterLayerMetadata>;
}

interface TownMapCinematicLayerOptions {
  canvas: Canvas;
  cellSize: number;
  mapWidth: number;
  mapHeight: number;
  getCharacterCenter: (characterId: string) => GridCoordinate | null;
  getCharacterToken: (characterId: string) => Group | undefined;
}

export class TownMapCinematicLayer {
  private readonly canvas: Canvas;
  private readonly cellSize: number;
  private readonly mapWidth: number;
  private readonly mapHeight: number;
  private readonly getCharacterCenter: (characterId: string) => GridCoordinate | null;
  private readonly getCharacterToken: (characterId: string) => Group | undefined;
  private activeScene: ActiveCinematicScene | null = null;
  private activeDialogueFocus: ActiveDialogueFocus | null = null;
  private animationVersion = 0;

  constructor(options: TownMapCinematicLayerOptions) {
    this.canvas = options.canvas;
    this.cellSize = options.cellSize;
    this.mapWidth = options.mapWidth;
    this.mapHeight = options.mapHeight;
    this.getCharacterCenter = options.getCharacterCenter;
    this.getCharacterToken = options.getCharacterToken;
  }

  async showWallSlamScene(input: ShowWallSlamSceneInput): Promise<boolean> {
    this.clearImmediately();
    const loadVersion = this.animationVersion;

    const targetCenter = this.getCharacterCenter(input.targetId);
    const initiatorToken = this.getCharacterToken(input.initiatorId);
    const targetToken = this.getCharacterToken(input.targetId);

    if (!targetCenter || !initiatorToken || !targetToken) {
      return false;
    }

    try {
      const wall = await FabricImage.fromURL(wallImageUrl);
      const latestTargetCenter = this.getCharacterCenter(input.targetId);

      if (loadVersion !== this.animationVersion || !latestTargetCenter) {
        return false;
      }

      const dimOverlay = this.createDimOverlay();
      const focusedCharacterMetadata = this.focusCharacters([
        initiatorToken,
        targetToken,
      ]);
      const wallTarget = this.getWallTargetPosition(
        latestTargetCenter,
        input.direction,
        input.wallDistanceCells,
      );
      const wallStartTop = wallTarget.y - input.wallDropDistanceCells * this.cellSize;

      wall.set({
        left: wallTarget.x,
        top: wallStartTop,
        originX: 'center',
        originY: 'bottom',
        flipX: input.direction === 'west',
        selectable: false,
        evented: false,
        objectCaching: true,
      });
      wall.set('sortBottomY', Number.POSITIVE_INFINITY);
      wall.set('entityLayerRank', CINEMATIC_WALL_LAYER_RANK);
      this.canvas.add(dimOverlay);
      this.canvas.add(wall);
      this.activeScene = {
        dimOverlay,
        focusedCharacterMetadata,
        wall,
      };
      sortEntityLayer(this.canvas);
      this.canvas.requestRenderAll();

      const animationVersion = this.animationVersion;
      const didDropWall = await this.animateValue({
        animationVersion,
        durationMs: input.wallEnterDurationMs,
        from: wallStartTop,
        to: wallTarget.y,
        onUpdate: top => {
          wall.set({ top, dirty: true });
          wall.setCoords();
        },
      });

      if (!didDropWall) {
        return false;
      }

      return this.animateValue({
        animationVersion,
        durationMs: input.backgroundDimDurationMs,
        from: 0,
        to: input.backgroundDimOpacity,
        onUpdate: opacity => {
          dimOverlay.set({ opacity, dirty: true });
        },
      });
    } catch (error) {
      console.error('Failed to show wall slam cinematic scene:', error);
      this.clearImmediately();
      return false;
    }
  }

  async showDialogueFocus(
    participantIds: readonly string[],
    backgroundDimOpacity: number,
    transitionDurationMs: number,
  ): Promise<boolean> {
    this.clearDialogueFocusImmediately();
    const participantTokens = [...new Set(participantIds)]
      .map(participantId => this.getCharacterToken(participantId))
      .filter((token): token is Group => token !== undefined);

    if (participantTokens.length === 0) {
      return false;
    }

    const dimOverlay = this.createDimOverlay();
    const focusedCharacterMetadata = this.focusCharacters(participantTokens);

    this.canvas.add(dimOverlay);
    this.activeDialogueFocus = {
      dimOverlay,
      focusedCharacterMetadata,
    };
    sortEntityLayer(this.canvas);
    this.canvas.requestRenderAll();

    return this.animateValue({
      animationVersion: this.animationVersion,
      durationMs: transitionDurationMs,
      from: 0,
      to: backgroundDimOpacity,
      onUpdate: opacity => {
        dimOverlay.set({ opacity, dirty: true });
      },
    });
  }

  async hideDialogueFocus(transitionDurationMs: number): Promise<void> {
    const dialogueFocus = this.activeDialogueFocus;

    if (!dialogueFocus) {
      return;
    }

    const animationVersion = ++this.animationVersion;

    const didHideDialogueFocus = await this.animateValue({
      animationVersion,
      durationMs: transitionDurationMs,
      from: dialogueFocus.dimOverlay.opacity,
      to: 0,
      onUpdate: opacity => {
        dialogueFocus.dimOverlay.set({ opacity, dirty: true });
      },
    });

    if (
      !didHideDialogueFocus
      || this.activeDialogueFocus !== dialogueFocus
    ) {
      return;
    }

    this.clearDialogueFocusImmediately();
  }

  async hideWallSlamScene(input: HideWallSlamSceneInput): Promise<void> {
    const scene = this.activeScene;

    if (!scene) {
      return;
    }

    const animationVersion = ++this.animationVersion;
    const wallStartTop = scene.wall.top ?? 0;
    const wallTargetTop = wallStartTop - this.mapHeight;

    await Promise.all([
      this.animateValue({
        animationVersion,
        durationMs: input.wallExitDurationMs,
        from: wallStartTop,
        to: wallTargetTop,
        onUpdate: top => {
          scene.wall.set({ top, dirty: true });
          scene.wall.setCoords();
        },
      }),
      this.animateValue({
        animationVersion,
        durationMs: input.backgroundDimDurationMs,
        from: scene.dimOverlay.opacity,
        to: 0,
        onUpdate: opacity => {
          scene.dimOverlay.set({ opacity, dirty: true });
        },
      }),
    ]);
    this.clearImmediately();
  }

  clearImmediately(): void {
    this.animationVersion += 1;
    this.clearDialogueFocusObjects();

    if (!this.activeScene) {
      sortEntityLayer(this.canvas);
      this.canvas.requestRenderAll();
      return;
    }

    this.restoreCharacterMetadata(this.activeScene.focusedCharacterMetadata);
    this.canvas.remove(this.activeScene.wall);
    this.canvas.remove(this.activeScene.dimOverlay);
    this.activeScene = null;
    sortEntityLayer(this.canvas);
    this.canvas.requestRenderAll();
  }

  dispose(): void {
    this.clearImmediately();
  }

  private clearDialogueFocusImmediately(): void {
    this.animationVersion += 1;
    this.clearDialogueFocusObjects();
    sortEntityLayer(this.canvas);
    this.canvas.requestRenderAll();
  }

  private clearDialogueFocusObjects(): void {
    if (!this.activeDialogueFocus) {
      return;
    }

    this.restoreCharacterMetadata(this.activeDialogueFocus.focusedCharacterMetadata);
    this.canvas.remove(this.activeDialogueFocus.dimOverlay);
    this.activeDialogueFocus = null;
  }

  private createDimOverlay(): Rect {
    const overlay = new Rect({
      left: 0,
      top: 0,
      width: this.mapWidth,
      height: this.mapHeight,
      originX: 'left',
      originY: 'top',
      fill: '#071018',
      opacity: 0,
      selectable: false,
      evented: false,
    });

    overlay.set('sortBottomY', Number.POSITIVE_INFINITY);
    overlay.set('entityLayerRank', CINEMATIC_DIM_LAYER_RANK);
    return overlay;
  }

  private focusCharacters(tokens: readonly Group[]): Map<string, CharacterLayerMetadata> {
    const metadataByCharacterId = new Map<string, CharacterLayerMetadata>();

    tokens.forEach(token => {
      const characterId = token.get('characterId');

      if (typeof characterId !== 'string') {
        return;
      }

      metadataByCharacterId.set(characterId, {
        entityLayerRank: token.get('entityLayerRank'),
        sortBottomY: token.get('sortBottomY'),
      });
      token.set('sortBottomY', Number.POSITIVE_INFINITY);
      token.set('entityLayerRank', CINEMATIC_CHARACTER_LAYER_RANK);
    });

    return metadataByCharacterId;
  }

  private restoreCharacterMetadata(
    metadataByCharacterId: ReadonlyMap<string, CharacterLayerMetadata>,
  ): void {
    metadataByCharacterId.forEach((metadata, characterId) => {
      const token = this.getCharacterToken(characterId);

      if (!token) {
        return;
      }

      token.set('sortBottomY', metadata.sortBottomY);
      token.set('entityLayerRank', metadata.entityLayerRank);
    });
  }

  private getWallTargetPosition(
    targetCenter: GridCoordinate,
    direction: WallSlamDirection,
    wallDistanceCells: number,
  ): GridCoordinate {
    const directionVector = getDirectionVector(direction);
    const characterHalfHeight = this.cellSize * TOWN_MAP_CHARACTER_RENDER_SCALE / 2;

    return {
      x: targetCenter.x + directionVector.x * wallDistanceCells * this.cellSize,
      y: targetCenter.y
        + directionVector.y * wallDistanceCells * this.cellSize
        + characterHalfHeight,
    };
  }

  private animateValue(input: {
    animationVersion: number;
    durationMs: number;
    from: number;
    to: number;
    onUpdate: (value: number) => void;
  }): Promise<boolean> {
    const durationMs = Math.max(0, input.durationMs);

    if (durationMs === 0) {
      if (input.animationVersion !== this.animationVersion) {
        return Promise.resolve(false);
      }

      input.onUpdate(input.to);
      this.canvas.requestRenderAll();
      return Promise.resolve(true);
    }

    return new Promise(resolve => {
      const startedAt = performance.now();
      const animate = (timestamp: number) => {
        if (input.animationVersion !== this.animationVersion) {
          resolve(false);
          return;
        }

        const elapsedRatio = Math.min(1, (timestamp - startedAt) / durationMs);
        const easedRatio = easeOutCubic(elapsedRatio);

        input.onUpdate(input.from + (input.to - input.from) * easedRatio);
        this.canvas.requestRenderAll();

        if (elapsedRatio < 1) {
          window.requestAnimationFrame(animate);
          return;
        }

        resolve(true);
      };

      window.requestAnimationFrame(animate);
    });
  }
}

export function getWallSlamDirectionVector(direction: WallSlamDirection): GridCoordinate {
  return getDirectionVector(direction);
}

function getDirectionVector(direction: WallSlamDirection): GridCoordinate {
  switch (direction) {
    case 'north':
      return { x: 0, y: -1 };
    case 'east':
      return { x: 1, y: 0 };
    case 'south':
      return { x: 0, y: 1 };
    case 'west':
      return { x: -1, y: 0 };
  }
}

function easeOutCubic(value: number): number {
  return 1 - ((1 - value) ** 3);
}
