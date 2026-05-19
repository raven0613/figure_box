import { Canvas, Group, Text } from 'fabric';
import { Expression } from '~/constants/character';
import type { CharacterRequestLevel } from '~/services/characterRequests/types';
import { CharacterTokenFactory, getRequestMarkerStyle } from './townMapCharacterTokenFactory';
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
  private readonly characterTokens = new Map<string, Group>();

  constructor(options: TownMapCharacterLayerOptions) {
    this.canvas = options.canvas;
    this.cellSize = options.cellSize;
    this.characterTracker = options.characterTracker;
  }

  dispose(): void {
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

  removeCharacterToken(characterId: string): void {
    const token = this.characterTokens.get(characterId);

    if (!token) {
      return;
    }

    this.canvas.remove(token);
    this.characterTokens.delete(characterId);
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
}
