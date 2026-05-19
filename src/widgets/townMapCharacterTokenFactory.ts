import { Circle, Group, Text } from 'fabric';
import { Expression } from '~/constants/character';
import type { CharacterRequestLevel } from '~/services/characterRequests/types';
import type { GridCoordinate } from './townMapGrid';
import type { TownMapCharacter } from './townMapWidgetTypes';
import {
  CHARACTER_RADIUS_RATIO,
  CHARACTER_SCALE,
} from '../constants/townMapWidgetConstants';

// 角色 token 建立
export class CharacterTokenFactory {
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
    const requestMarker = new Text('', {
      top: -renderSize * 1.16,
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
    const group = new Group([requestMarker, expression, status, token, label], {
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
    group.set('requestMarkerObject', requestMarker);
    return group;
  }
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
