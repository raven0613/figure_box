import { Canvas, Group, Text } from 'fabric';
import { ExpressionPresetId } from '~/constants/character';
import type { CharacterPerformanceAnimationId } from '~/constants/presentationAnimations';
import type { CharacterRequestLevel } from '~/services/characterRequests/types';
import {
  PresentationAnimationService,
  type AnimationHandle,
} from '~/services/presentationAnimationService';
import type { ItemDefinition } from '~/typing/item';
import { TOWN_MAP_CHARACTER_RENDER_SCALE } from '~/constants/townMapWidgetConstants';
import {
  CharacterTokenFactory,
  getCharacterUiGroupTop,
  getRequestMarkerStyle,
} from './townMapCharacterTokenFactory';
import { TownMapItemGlyphFactory } from './townMapItemGlyphFactory';
import type { GridCoordinate } from './townMapGrid';
import type { TownMapCharacter } from './townMapWidgetTypes';
import { sortEntityLayer, updateEntitySortMetadata } from './townMapLayerSorter';
import type { TownMapCharacterTracker } from './townMapCharacterTracker';
import {
  createTownMapCharacterSpriteRenderer,
  type TownMapCharacterSpriteBody,
  type TownMapCharacterSpriteDirection,
  type TownMapCharacterSpriteRenderer,
  type TownMapCharacterSpriteSet,
} from './townMapCharacterSpriteRenderer';

interface TownMapCharacterLayerOptions {
  canvas: Canvas;
  cellSize: number;
  characterTracker: TownMapCharacterTracker;
}

// 角色 render/update/remove/snap/center
export class TownMapCharacterLayer {
  private readonly canvas: Canvas;
  private readonly cellSize: number;
  private readonly characterTracker: TownMapCharacterTracker;
  private readonly characterTokenFactory = new CharacterTokenFactory();
  private readonly itemGlyphFactory = new TownMapItemGlyphFactory();
  private readonly presentationAnimations = new PresentationAnimationService();
  private readonly characterTokens = new Map<string, Group>();
  private readonly heldItems = new Map<string, Group>();
  private readonly heldItemDefinitions = new Map<string, ItemDefinition>();
  private readonly characters = new Map<string, TownMapCharacter>();
  private readonly presentationAnimationHandles = new Map<string, AnimationHandle>();
  private readonly spriteRenderers = new Map<string, TownMapCharacterSpriteRenderer>();
  private readonly spriteLoadVersions = new Map<string, number>();
  private readonly spriteDirections = new Map<string, TownMapCharacterSpriteDirection>();
  private readonly activePresentationCharacterIds = new Set<string>();
  private isCharacterDraggingEnabled = true;
  private isDisposed = false;
  private isPresentationPaused = false;
  private viewportZoom = 1;

  constructor(options: TownMapCharacterLayerOptions) {
    this.canvas = options.canvas;
    this.cellSize = options.cellSize;
    this.characterTracker = options.characterTracker;
  }

  dispose(): void {
    this.isDisposed = true;
    Array.from(this.presentationAnimationHandles.keys()).forEach(key => {
      this.cancelPresentationAnimation(key);
    });
    this.presentationAnimations.cancelAll();
    Array.from(this.heldItems.keys()).forEach(characterId => {
      this.releaseHeldItem(characterId);
    });
    this.characterTokens.clear();
    this.heldItemDefinitions.clear();
    this.spriteRenderers.clear();
    this.spriteLoadVersions.clear();
    this.spriteDirections.clear();
  }

  getToken(characterId: string): Group | undefined {
    return this.characterTokens.get(characterId);
  }

  getCharacterCenter(characterId: string): GridCoordinate | null {
    const token = this.characterTokens.get(characterId);

    if (!token) {
      return null;
    }

    return {
      x: token.left ?? 0,
      y: token.top ?? 0,
    };
  }

  getCharacterIdFromTarget(target: unknown): string | null {
    if (!target) {
      return null;
    }

    const maybeCharacter = target as { get?: (key: string) => unknown };
    const characterId = maybeCharacter.get?.('characterId');

    return typeof characterId === 'string' ? characterId : null;
  }

  renderCharacter(character: TownMapCharacter): void {
    const position = this.getCharacterPosition(character);
    const existing = this.characterTokens.get(character.id);

    this.characters.set(character.id, character);

    if (existing) {
      this.positionToken(existing, position);
      return;
    }

    const token = this.characterTokenFactory.create(
      character,
      position,
      this.cellSize,
      undefined,
      this.createSpriteBody(character.id),
    );

    token.set('selectable', this.isCharacterDraggingEnabled);
    this.applyTokenUiZoom(token);
    updateEntitySortMetadata(token, position.y);
    this.characterTokens.set(character.id, token);
    this.canvas.add(token);
    sortEntityLayer(this.canvas);
    this.characterTracker.update();
  }

  async setCharacterSpriteSheets(characterId: string, spriteSet: TownMapCharacterSpriteSet): Promise<void> {
    if (this.isDisposed) {
      return;
    }

    const loadVersion = (this.spriteLoadVersions.get(characterId) ?? 0) + 1;

    this.spriteLoadVersions.set(characterId, loadVersion);

    try {
      const renderer = await createTownMapCharacterSpriteRenderer(spriteSet, this.cellSize);

      if (this.isDisposed || this.spriteLoadVersions.get(characterId) !== loadVersion) {
        return;
      }

      this.spriteRenderers.set(characterId, renderer);
      this.rebuildCharacterToken(characterId);
    } catch (error) {
      console.error('Failed to load town map character sprite renderer:', error);
    }
  }

  setCharacterSpriteDirection(characterId: string, direction: TownMapCharacterSpriteDirection): void {
    this.spriteDirections.set(characterId, direction);

    const token = this.characterTokens.get(characterId);
    const spriteBody = token?.get('spriteBodyObject') as TownMapCharacterSpriteBody | undefined;

    if (!spriteBody) {
      return;
    }

    spriteBody.setTownMapSpriteDirection(direction);
    this.canvas.requestRenderAll();
  }

  syncViewportZoom(zoom: number): void {
    if (this.viewportZoom === zoom) {
      return;
    }

    this.viewportZoom = zoom;
    this.characterTokens.forEach(token => {
      this.applyTokenUiZoom(token);
    });
    this.canvas.requestRenderAll();
  }

  setCharacterDraggingEnabled(isEnabled: boolean): void {
    if (this.isCharacterDraggingEnabled === isEnabled) {
      return;
    }

    this.isCharacterDraggingEnabled = isEnabled;
    this.characterTokens.forEach(token => {
      token.set('selectable', isEnabled);
      token.setCoords();
    });
    this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
  }

  moveCharacterToken(characterId: string, target: GridCoordinate): void {
    const token = this.characterTokens.get(characterId);

    if (!token) {
      return;
    }

    this.positionToken(token, this.getCharacterPosition(target));
    this.canvas.requestRenderAll();
  }

  positionCharacterToken(characterId: string, position: GridCoordinate): void {
    const token = this.characterTokens.get(characterId);

    if (!token) {
      return;
    }

    this.positionToken(token, position);
    this.canvas.requestRenderAll();
  }

  updateCharacterStatus(characterId: string, statusText: string): void {
    const token = this.characterTokens.get(characterId);
    const status = token?.get('statusObject') as Text | undefined;

    if (!token || !status || status.text === statusText) {
      return;
    }

    status.set('text', statusText);
    this.updateStoredCharacter(characterId, {
      statusText,
    });
    this.applyTokenUiZoom(token);
    token.setCoords();
    this.canvas.requestRenderAll();
  }

  updateCharacterExpressionPreset(characterId: string, presetId: ExpressionPresetId): void {
    const token = this.characterTokens.get(characterId);
    const expressionPresetLabel = token?.get('expressionPresetObject') as Text | undefined;

    if (!token || !expressionPresetLabel || expressionPresetLabel.text === presetId) {
      return;
    }

    expressionPresetLabel.set('text', presetId);
    this.updateStoredCharacter(characterId, {
      expressionPresetId: presetId,
    });
    this.applyTokenUiZoom(token);
    token.setCoords();
    this.canvas.requestRenderAll();
  }

  updateCharacterRequestMarker(
    characterId: string,
    marker: { label: string; level: CharacterRequestLevel } | null,
  ): void {
    const token = this.characterTokens.get(characterId);
    const requestMarker = token?.get('requestMarkerObject') as Text | undefined;

    if (!token || !requestMarker) {
      return;
    }

    if (!marker) {
      if (!requestMarker.visible) {
        return;
      }

      requestMarker.set({ text: '', visible: false });
      this.applyTokenUiZoom(token);
      token.setCoords();
      this.canvas.requestRenderAll();
      return;
    }

    requestMarker.set({
      text: marker.label,
      visible: true,
      ...getRequestMarkerStyle(marker.level),
    });
    this.applyTokenUiZoom(token);
    token.setCoords();
    this.canvas.requestRenderAll();
  }

  holdItem(characterId: string, itemDefinition: ItemDefinition): void {
    const token = this.characterTokens.get(characterId);

    if (!token) {
      return;
    }

    this.releaseHeldItem(characterId);

    const heldItem = this.itemGlyphFactory.createHeldItemGlyph(itemDefinition, this.cellSize);

    this.heldItemDefinitions.set(characterId, itemDefinition);
    this.heldItems.set(characterId, heldItem);
    this.rebuildCharacterToken(characterId);
  }

  releaseHeldItem(characterId: string): void {
    const hasHeldItem = this.heldItems.has(characterId) || this.heldItemDefinitions.has(characterId);

    if (!hasHeldItem) {
      return;
    }

    this.heldItems.delete(characterId);
    this.heldItemDefinitions.delete(characterId);
    this.cancelCharacterAnimation(characterId);
    this.rebuildCharacterToken(characterId);
  }

  removeCharacterToken(characterId: string): void {
    const token = this.characterTokens.get(characterId);

    if (!token) {
      return;
    }

    this.heldItems.delete(characterId);
    this.heldItemDefinitions.delete(characterId);
    this.cancelCharacterAnimation(characterId);
    this.canvas.remove(token);
    this.characterTokens.delete(characterId);
    this.characters.delete(characterId);
    this.canvas.requestRenderAll();
  }

  playCharacterAnimation(
    characterId: string,
    animationId: CharacterPerformanceAnimationId,
    durationMs?: number,
  ): void {
    const token = this.characterTokens.get(characterId);

    if (!token) {
      return;
    }

    if (animationId === 'heldItemCelebrationAnim') {
      const heldItem = this.heldItems.get(characterId);

      if (!heldItem) {
        return;
      }

      const animationKey = this.getHeldItemAnimationKey(characterId);

      this.cancelPresentationAnimation(animationKey);
      this.trackPresentationAnimation(animationKey, this.presentationAnimations.heldItemCelebrationAnim({
        key: animationKey,
        target: heldItem,
        canvas: this.canvas,
        radius: this.cellSize * 0.38,
        durationMs,
      }));
      return;
    }

    if (animationId === 'characterJumpAnim') {
      const animationKey = this.getCharacterJumpAnimationKey(characterId);

      this.cancelPresentationAnimation(animationKey);
      this.trackPresentationAnimation(animationKey, this.presentationAnimations.characterJumpAnim({
        key: animationKey,
        target: token,
        canvas: this.canvas,
        jumpHeight: this.cellSize * 0.64,
        durationMs,
      }));
    }
  }

  cancelCharacterAnimation(characterId: string): void {
    this.cancelPresentationAnimation(this.getHeldItemAnimationKey(characterId));
    this.cancelPresentationAnimation(this.getCharacterJumpAnimationKey(characterId));
  }

  hasActiveDialogueSpriteAnimations(): boolean {
    return this.isPresentationPaused && this.activePresentationCharacterIds.size > 0;
  }

  setPresentationPaused(
    isPaused: boolean,
    activeCharacterIds: readonly string[] = [],
  ): void {
    const nextActiveCharacterIds = new Set(activeCharacterIds);
    const hasSameActiveCharacters = this.activePresentationCharacterIds.size === nextActiveCharacterIds.size
      && [...this.activePresentationCharacterIds].every(characterId => (
        nextActiveCharacterIds.has(characterId)
      ));

    if (this.isPresentationPaused === isPaused && hasSameActiveCharacters) {
      return;
    }

    this.isPresentationPaused = isPaused;
    this.activePresentationCharacterIds.clear();
    nextActiveCharacterIds.forEach(characterId => {
      this.activePresentationCharacterIds.add(characterId);
    });

    if (isPaused) {
      this.presentationAnimations.pauseAll();
    } else {
      this.presentationAnimations.resumeAll();
    }

    this.characterTokens.forEach((token, characterId) => {
      const spriteBody = token.get('spriteBodyObject') as TownMapCharacterSpriteBody | undefined;

      spriteBody?.setTownMapSpriteAnimationPaused(
        isPaused && !this.activePresentationCharacterIds.has(characterId),
      );
    });
    this.canvas.requestRenderAll();
  }

  snapCharacterToGrid(characterId: string, currentTile: GridCoordinate | null): void {
    const token = this.characterTokens.get(characterId);

    if (!currentTile || !token) {
      return;
    }

    this.positionToken(token, this.getCharacterPosition(currentTile));
    this.canvas.requestRenderAll();
  }

  positionToken(token: Group, position: GridCoordinate): void {
    token.set({ left: position.x, top: position.y });
    updateEntitySortMetadata(token, position.y);
    token.setCoords();
    sortEntityLayer(this.canvas);
    this.characterTracker.update();
  }

  getCharacterPosition(coordinate: GridCoordinate): GridCoordinate {
    return {
      x: coordinate.x * this.cellSize + this.cellSize / 2,
      y: coordinate.y * this.cellSize + this.cellSize / 2,
    };
  }

  private rebuildCharacterToken(characterId: string): void {
    if (this.isDisposed) {
      return;
    }

    const currentToken = this.characterTokens.get(characterId);
    const character = this.characters.get(characterId);

    if (!currentToken || !character) {
      return;
    }

    const currentPosition = {
      x: currentToken.left ?? 0,
      y: currentToken.top ?? 0,
    };
    const heldItem = this.createHeldItemGlyph(characterId);

    const nextToken = this.characterTokenFactory.create(
      character,
      currentPosition,
      this.cellSize,
      heldItem,
      this.createSpriteBody(characterId),
    );

    this.copyRequestMarker(currentToken, nextToken);
    this.applyTokenUiZoom(nextToken);
    updateEntitySortMetadata(nextToken, getNumericTokenValue(currentToken, 'sortBottomY') || currentPosition.y);
    nextToken.set('entityLayerRank', getNumericTokenValue(currentToken, 'entityLayerRank'));
    this.canvas.remove(currentToken);
    this.characterTokens.set(characterId, nextToken);
    this.canvas.add(nextToken);
    sortEntityLayer(this.canvas);
    this.characterTracker.update();
    this.canvas.requestRenderAll();
  }

  private createSpriteBody(characterId: string): TownMapCharacterSpriteBody | undefined {
    const renderer = this.spriteRenderers.get(characterId);

    if (!renderer) {
      return undefined;
    }

    const spriteBody = renderer.createBody(this.spriteDirections.get(characterId) ?? 'front');

    spriteBody.setTownMapSpriteAnimationPaused(
      this.isPresentationPaused && !this.activePresentationCharacterIds.has(characterId),
    );
    return spriteBody;
  }

  private createHeldItemGlyph(characterId: string): Group | undefined {
    const itemDefinition = this.heldItemDefinitions.get(characterId);

    if (!itemDefinition) {
      this.heldItems.delete(characterId);
      return undefined;
    }

    const heldItem = this.itemGlyphFactory.createHeldItemGlyph(itemDefinition, this.cellSize);

    this.heldItems.set(characterId, heldItem);
    return heldItem;
  }

  private applyTokenUiZoom(token: Group): void {
    const inverseZoom = 1 / this.viewportZoom;
    const uiGroup = token.get('uiGroupObject') as Group | undefined;

    if (!uiGroup) {
      return;
    }

    uiGroup.set({
      top: this.getCharacterUiGroupTop(),
      scaleX: inverseZoom,
      scaleY: inverseZoom,
    });
    uiGroup.setCoords();

    token.setCoords();
  }

  private getCharacterUiGroupTop(): number {
    return getCharacterUiGroupTop(
      this.cellSize * TOWN_MAP_CHARACTER_RENDER_SCALE,
      this.viewportZoom,
    );
  }

  private copyRequestMarker(sourceToken: Group, targetToken: Group): void {
    const sourceRequestMarker = sourceToken.get('requestMarkerObject') as Text | undefined;
    const targetRequestMarker = targetToken.get('requestMarkerObject') as Text | undefined;

    if (!sourceRequestMarker || !targetRequestMarker) {
      return;
    }

    targetRequestMarker.set({
      text: sourceRequestMarker.text,
      visible: sourceRequestMarker.visible,
      fill: sourceRequestMarker.fill,
      backgroundColor: sourceRequestMarker.backgroundColor,
    });
  }

  private updateStoredCharacter(characterId: string, patch: Partial<TownMapCharacter>): void {
    const character = this.characters.get(characterId);

    if (!character) {
      return;
    }

    this.characters.set(characterId, {
      ...character,
      ...patch,
    });
  }

  private trackPresentationAnimation(key: string, handle: AnimationHandle): void {
    this.presentationAnimationHandles.set(key, handle);
    void handle.finished.then(() => {
      if (this.presentationAnimationHandles.get(key) === handle) {
        this.presentationAnimationHandles.delete(key);
      }
    });
  }

  private cancelPresentationAnimation(key: string): void {
    const handle = this.presentationAnimationHandles.get(key);

    if (!handle) {
      this.presentationAnimations.cancel(key);
      return;
    }

    this.presentationAnimationHandles.delete(key);
    handle.cancel();
  }

  private getHeldItemAnimationKey(characterId: string): string {
    return `held-item:${characterId}`;
  }

  private getCharacterJumpAnimationKey(characterId: string): string {
    return `character-jump:${characterId}`;
  }
}

function getNumericTokenValue(token: Group, key: string): number {
  const value = token.get(key);

  return typeof value === 'number' ? value : 0;
}
