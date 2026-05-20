import { Canvas, Group, Text } from 'fabric';
import { Expression } from '~/constants/character';
import type { CharacterRequestLevel } from '~/services/characterRequests/types';
import { PresentationAnimationService } from '~/services/presentationAnimationService';
import type { ItemDefinition } from '~/typing/item';
import { CharacterTokenFactory, getRequestMarkerStyle } from './townMapCharacterTokenFactory';
import { TownMapItemGlyphFactory } from './townMapItemGlyphFactory';
import type { GridCoordinate } from './townMapGrid';
import type { TownMapCharacter } from './townMapWidgetTypes';
import { sortEntityLayer, updateEntitySortMetadata } from './townMapLayerSorter';
import type { TownMapCharacterTracker } from './townMapCharacterTracker';

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
  private readonly characters = new Map<string, TownMapCharacter>();

  constructor(options: TownMapCharacterLayerOptions) {
    this.canvas = options.canvas;
    this.cellSize = options.cellSize;
    this.characterTracker = options.characterTracker;
  }

  dispose(): void {
    this.presentationAnimations.cancelAll();
    Array.from(this.heldItems.keys()).forEach(characterId => {
      this.releaseHeldItem(characterId);
    });
    this.characterTokens.clear();
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

    const token = this.characterTokenFactory.create(character, position, this.cellSize);

    updateEntitySortMetadata(token, position.y);
    this.characterTokens.set(character.id, token);
    this.canvas.add(token);
    sortEntityLayer(this.canvas);
    this.characterTracker.update();
  }

  moveCharacterToken(characterId: string, target: GridCoordinate): void {
    const token = this.characterTokens.get(characterId);

    if (!token) {
      return;
    }

    this.positionToken(token, this.getCharacterPosition(target));
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
    this.updateStoredCharacter(characterId, {
      expression: expressionText,
    });
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
      token.setCoords();
      this.canvas.requestRenderAll();
      return;
    }

    requestMarker.set({
      text: marker.label,
      visible: true,
      ...getRequestMarkerStyle(marker.level),
    });
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

    this.heldItems.set(characterId, heldItem);
    this.rebuildCharacterToken(characterId);
    void this.playRewardHeldItemSequence(characterId, heldItem);
  }

  releaseHeldItem(characterId: string): void {
    const heldItem = this.heldItems.get(characterId);

    if (!heldItem) {
      return;
    }

    this.heldItems.delete(characterId);
    this.presentationAnimations.cancel(this.getHeldItemAnimationKey(characterId));
    this.presentationAnimations.cancel(this.getCharacterJumpAnimationKey(characterId));
    this.rebuildCharacterToken(characterId);
  }

  removeCharacterToken(characterId: string): void {
    const token = this.characterTokens.get(characterId);

    if (!token) {
      return;
    }

    this.heldItems.delete(characterId);
    this.presentationAnimations.cancel(this.getHeldItemAnimationKey(characterId));
    this.presentationAnimations.cancel(this.getCharacterJumpAnimationKey(characterId));
    this.canvas.remove(token);
    this.characterTokens.delete(characterId);
    this.characters.delete(characterId);
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
    const currentToken = this.characterTokens.get(characterId);
    const character = this.characters.get(characterId);

    if (!currentToken || !character) {
      return;
    }

    const currentPosition = {
      x: currentToken.left ?? 0,
      y: currentToken.top ?? 0,
    };
    const heldItem = this.heldItems.get(characterId);

    if (heldItem) {
      this.positionHeldItemInSlot(heldItem);
    }

    const nextToken = this.characterTokenFactory.create(character, currentPosition, this.cellSize, heldItem);

    this.copyRequestMarker(currentToken, nextToken);
    updateEntitySortMetadata(nextToken, getNumericTokenValue(currentToken, 'sortBottomY') || currentPosition.y);
    nextToken.set('entityLayerRank', getNumericTokenValue(currentToken, 'entityLayerRank'));
    this.canvas.remove(currentToken);
    this.characterTokens.set(characterId, nextToken);
    this.canvas.add(nextToken);
    sortEntityLayer(this.canvas);
    this.characterTracker.update();
    this.canvas.requestRenderAll();
  }

  private positionHeldItemInSlot(heldItem: Group): void {
    heldItem.set({
      left: heldItem.left ?? 0,
      top: heldItem.top ?? 0,
      originX: 'center',
      originY: 'center',
      dirty: true,
    });
    heldItem.setCoords();
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

  private async playRewardHeldItemSequence(characterId: string, heldItem: Group): Promise<void> {
    const itemCelebration = this.presentationAnimations.playHeldItemCelebration({
      key: this.getHeldItemAnimationKey(characterId),
      target: heldItem,
      canvas: this.canvas,
      radius: this.cellSize * 0.38,
    });

    await itemCelebration.finished;

    if (this.heldItems.get(characterId) !== heldItem) {
      return;
    }

    const token = this.characterTokens.get(characterId);

    if (!token) {
      return;
    }

    this.presentationAnimations.playCharacterJump({
      key: this.getCharacterJumpAnimationKey(characterId),
      target: token,
      canvas: this.canvas,
      jumpHeight: this.cellSize * 0.64,
    });
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
