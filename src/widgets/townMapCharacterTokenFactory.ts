import { Circle, Group, Rect, Text, type FabricObject } from 'fabric';
import { DEFAULT_EXPRESSION_PRESET_ID } from '~/constants/expressionCatalog';
import type { CharacterRequestLevel } from '~/services/characterRequests/types';
import type { GridCoordinate } from './townMapGrid';
import type { TownMapCharacter } from './townMapWidgetTypes';
import {
  CHARACTER_RADIUS_RATIO,
  TOWN_MAP_CHARACTER_RENDER_SCALE,
} from '../constants/townMapWidgetConstants';

const CHARACTER_UI_MARGIN_SCREEN_PX = 6;
const CHARACTER_UI_STATUS_TOP = 0;
const CHARACTER_UI_EXPRESSION_TOP = -13;
const CHARACTER_UI_REQUEST_TOP = -26;

// 角色 token 建立
export class CharacterTokenFactory {
  create(
    character: TownMapCharacter,
    center: GridCoordinate,
    cellSize: number,
    heldItem?: Group,
    spriteBody?: FabricObject,
  ): Group {
    const renderSize = cellSize * TOWN_MAP_CHARACTER_RENDER_SCALE;
    const fallbackToken = new Circle({
      radius: renderSize * CHARACTER_RADIUS_RATIO,
      fill: character.color ?? '#f2d16b',
      stroke: '#2d2d2d',
      strokeWidth: 2,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });
    const label = spriteBody ? null : new Text(character.label ?? character.id.slice(0, 1).toUpperCase(), {
      fontSize: renderSize * 0.28,
      fontWeight: '700',
      fontFamily: 'Arial, sans-serif',
      fill: '#1f1f1f',
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });
    const hitArea = new Rect({
      width: renderSize,
      height: renderSize,
      fill: 'rgba(0,0,0,0)',
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });
    const status = new Text(character.statusText ?? '', {
      top: CHARACTER_UI_STATUS_TOP,
      fontSize: 10,
      fontFamily: 'Arial, sans-serif',
      fill: '#20252b',
      backgroundColor: 'rgba(255, 255, 255, 0.82)',
      originX: 'center',
      originY: 'bottom',
      selectable: false,
      evented: false,
    });
    const expressionPresetId = new Text(character.expressionPresetId ?? DEFAULT_EXPRESSION_PRESET_ID, {
      top: CHARACTER_UI_EXPRESSION_TOP,
      fontSize: 10,
      fontFamily: 'Arial, sans-serif',
      fill: '#24313a',
      backgroundColor: 'rgba(174, 230, 204, 0.9)',
      originX: 'center',
      originY: 'bottom',
      selectable: false,
      evented: false,
    });
    const requestMarker = new Text('', {
      top: CHARACTER_UI_REQUEST_TOP,
      fontSize: 11,
      fontFamily: 'Arial, sans-serif',
      fontWeight: '700',
      fill: '#24313a',
      backgroundColor: 'rgba(246, 232, 184, 0.94)',
      originX: 'center',
      originY: 'bottom',
      selectable: false,
      evented: false,
      visible: false,
    });
    const heldItemSlotBounds = new Rect({
      left: 0,
      top: 0,
      width: 20,
      height: 20,
      fill: 'rgba(0,0,0,0)',
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });
    const heldItemMountBounds = new Rect({
      left: 0,
      top: 0,
      width: 20,
      height: 20,
      fill: 'rgba(0,0,0,0)',
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });
    const heldItemMount = new Group([
      heldItemMountBounds,
      ...(heldItem ? [heldItem] : []),
    ], {
      left: 0,
      top: 0,
      width: 20,
      height: 20,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      objectCaching: false,
    });
    const heldItemSlot = new Group([heldItemSlotBounds, heldItemMount], {
      left: 10,
      top: -10,
      width: 20,
      height: 20,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      objectCaching: false,
    });
    const uiGroup = new Group([requestMarker, expressionPresetId, status], {
      left: 0,
      top: getCharacterUiGroupTop(renderSize, 1),
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      objectCaching: false,
    });
    const bodyObject = spriteBody ?? fallbackToken;

    bodyObject.set({
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });

    const group = new Group([
      uiGroup,
      hitArea,
      bodyObject,
      ...(label ? [label] : []),
      heldItemSlot,
    ], {
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
      objectCaching: false,
    });

    group.set('characterId', character.id);
    group.set('statusObject', status);
    group.set('expressionPresetObject', expressionPresetId);
    group.set('requestMarkerObject', requestMarker);
    group.set('uiGroupObject', uiGroup);
    group.set('spriteBodyObject', spriteBody);
    group.set('heldItemSlotObject', heldItemSlot);
    group.set('heldItemMountObject', heldItemMount);
    group.set('heldItemMountBoundsObject', heldItemMountBounds);
    return group;
  }
}

export function getCharacterUiGroupTop(renderSize: number, zoom: number): number {
  return -renderSize / 2 - CHARACTER_UI_MARGIN_SCREEN_PX / zoom;
}

export function getRequestMarkerStyle(level: CharacterRequestLevel): {
  fill: string;
  backgroundColor: string;
} {
  if (level === 'critical') {
    return {
      fill: '#7c2626',
      backgroundColor: 'rgba(255, 220, 220, 0.96)',
    };
  }

  if (level === 'social') {
    return {
      fill: '#1f5f9f',
      backgroundColor: 'rgba(221, 237, 255, 0.96)',
    };
  }

  return {
    fill: '#256a43',
    backgroundColor: 'rgba(222, 244, 229, 0.96)',
  };
}
