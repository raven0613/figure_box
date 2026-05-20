import { Circle, Ellipse, Group, Rect, Text } from 'fabric';
import type { TerrainType, TownMapObjectData, TownMapObjectType } from '~/constants/townMap';

interface TerrainStyle {
  fill: string;
  stroke: string;
}
// 地形樣式、地圖物件 glyph
export class TerrainStyleCatalog {
  private readonly styles: Record<TerrainType, TerrainStyle> = {
    grass: { fill: '#c8d9c0', stroke: '#b1c9a7' },
    road: { fill: '#e3d2b6', stroke: '#d1bda0' },
    plaza: { fill: '#d7c3a2', stroke: '#b9a27d' },
    water: { fill: '#a4bdcb', stroke: '#8ba5b3' },
    building: { fill: '#ab9280', stroke: '#9e806f' },
    garden: { fill: '#a2cab0', stroke: '#88b89b' },
  };

  get(terrain: TerrainType): TerrainStyle {
    return this.styles[terrain];
  }
}

export class MapObjectGlyphFactory {
  create(object: TownMapObjectData, cellSize: number): Group {
    if (object.type === 'apartment') {
      return this.createApartment(object, cellSize);
    }

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
      evented: object.interactable,
      objectCaching: true,
    });

    this.applyObjectMetadata(group, object, top + height);
    return group;
  }

  private createApartment(object: TownMapObjectData, cellSize: number): Group {
    const left = object.x * cellSize;
    const top = object.y * cellSize;
    const width = object.width * cellSize;
    const height = object.height * cellSize;
    const cornerRadius = Math.min(4, cellSize * 0.25);
    const doorWidth = Math.max(cellSize * 2.2, width * 0.24);
    const doorHeight = Math.max(cellSize * 1.7, height * 0.18);
    const doorLeft = (width - doorWidth) / 2;
    const doorTop = height - doorHeight;
    const canopyWidth = doorWidth + cellSize * 1.2;
    const canopyHeight = Math.max(cellSize * 1.1, height * 0.12);
    const canopyLeft = (width - canopyWidth) / 2;
    const canopyTop = height - canopyHeight * 1.35;

    const body = new Rect({
      left: 0,
      top: 0,
      width,
      height,
      originX: 'left',
      originY: 'top',
      fill: '#635247',
      stroke: '#263238',
      strokeWidth: 1,
      rx: cornerRadius,
      ry: cornerRadius,
      selectable: false,
      evented: false,
    });
    const roofLine = new Rect({
      left: 0,
      top: 0,
      width,
      height: Math.max(3, cellSize * 0.18),
      originX: 'left',
      originY: 'top',
      fill: '#3f332d',
      selectable: false,
      evented: false,
    });
    const windows = this.createApartmentWindows(width, height, cellSize);
    const door = new Rect({
      left: doorLeft,
      top: doorTop,
      width: doorWidth,
      height: doorHeight,
      originX: 'left',
      originY: 'top',
      fill: '#3b2b24',
      stroke: '#251c18',
      strokeWidth: 1,
      rx: Math.min(3, cornerRadius),
      ry: Math.min(3, cornerRadius),
      selectable: false,
      evented: false,
    });
    const canopyShadow = new Rect({
      left: canopyLeft + cellSize * 0.12,
      top: canopyTop + canopyHeight * 0.24,
      width: canopyWidth,
      height: canopyHeight,
      originX: 'left',
      originY: 'top',
      fill: '#2a211d',
      opacity: 0.38,
      rx: cornerRadius,
      ry: cornerRadius,
      selectable: false,
      evented: false,
    });
    const canopy = new Rect({
      left: canopyLeft,
      top: canopyTop,
      width: canopyWidth,
      height: canopyHeight,
      originX: 'left',
      originY: 'top',
      fill: '#4a3a33',
      stroke: '#241c18',
      strokeWidth: 1,
      rx: cornerRadius,
      ry: cornerRadius,
      selectable: false,
      evented: false,
    });
    const canopyTrim = new Rect({
      left: canopyLeft,
      top: canopyTop + canopyHeight - Math.max(2, cellSize * 0.12),
      width: canopyWidth,
      height: Math.max(2, cellSize * 0.12),
      originX: 'left',
      originY: 'top',
      fill: '#d2b48c',
      selectable: false,
      evented: false,
    });
    const label = new Text(this.getGlyph(object.type), {
      left: width / 2,
      top: height * 0.18,
      originX: 'center',
      originY: 'center',
      fontSize: Math.max(8, Math.min(width, height) * 0.18),
      fontFamily: 'Arial, sans-serif',
      fontWeight: '700',
      fill: '#f7fbff',
      selectable: false,
      evented: false,
    });
    const group = new Group([
      body,
      roofLine,
      ...windows,
      door,
      canopyShadow,
      canopy,
      canopyTrim,
      label,
    ], {
      left,
      top,
      originX: 'left',
      originY: 'top',
      selectable: false,
      evented: true,
      objectCaching: true,
    });

    this.applyObjectMetadata(group, object, top + height);
    return group;
  }

  private createApartmentWindows(width: number, height: number, cellSize: number): Rect[] {
    const windowSize = Math.max(cellSize * 0.8, Math.min(width, height) * 0.11);
    const windowTopRows = [height * 0.34, height * 0.55];
    const windowLeftColumns = [width * 0.23, width * 0.77];

    return windowTopRows.flatMap(windowTop => windowLeftColumns.map(windowLeft => (
      this.createApartmentWindow(windowLeft, windowTop, windowSize)
    )));
  }

  private createApartmentWindow(centerX: number, centerY: number, size: number): Rect {
    return new Rect({
      left: centerX - size / 2,
      top: centerY - size / 2,
      width: size,
      height: size,
      originX: 'left',
      originY: 'top',
      fill: '#f4d58d',
      stroke: '#2f2a27',
      strokeWidth: 1,
      rx: 2,
      ry: 2,
      selectable: false,
      evented: false,
    });
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
    const crown = new Ellipse({
      left: centerX,
      top: height * 0.38,
      rx: width * 0.48,
      ry: height * 0.38,
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
      evented: object.interactable,
      objectCaching: true,
    });

    this.applyObjectMetadata(group, object, top + height);
    return group;
  }

  private createLamp(object: TownMapObjectData, cellSize: number): Group {
    const width = object.width * cellSize;
    const height = object.height * cellSize;
    const centerX = width / 2;
    const poleWidth = width * 0.15;
    const poleHeight = height * 0.75;
    const headWidth = width * 0.6;
    const headHeight = height * 0.15;
    const headTop = height - poleHeight - headHeight * 0.3;
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
    const head = new Rect({
      left: centerX - headWidth / 2,
      top: headTop,
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
    const glow = new Circle({
      left: centerX,
      top: headTop + headHeight / 2,
      radius: width * 0.2,
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
      evented: object.interactable,
      objectCaching: true,
    });

    this.applyObjectMetadata(group, object, top + height);
    return group;
  }

  private applyObjectMetadata(group: Group, object: TownMapObjectData, sortBottomY: number): void {
    group.set('mapObjectId', object.id);
    group.set('mapObjectType', object.type);
    group.set('sortBottomY', sortBottomY);
    group.set('entityLayerRank', this.getLayerRank(object.layer));
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
      apartment: 'Apt',
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
      apartment: '#635247',
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
