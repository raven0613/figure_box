import { Expression } from '~/constants/character';
import type { CharacterPlacement, GridCoordinate, TownMapTile } from './townMapGrid';

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
  onMapObjectClick?: (objectId: string) => void;
  onCharacterPickUp?: (characterId: string) => void;
  onCharacterDrop?: (characterId: string, tile: GridCoordinate | null) => void;
}
