import { Circle, Ellipse, Group, Polygon, Rect, Text, type FabricObject } from 'fabric';
import type { ItemDefinition } from '~/typing/item';
import { CHARACTER_SCALE } from '~/constants/townMapWidgetConstants';

const DEFAULT_HELD_ITEM_SCALE = 0.45;

export class TownMapItemGlyphFactory {
  createHeldItemGlyph(itemDefinition: ItemDefinition, cellSize: number): Group {
    const scale = itemDefinition.visual.scale?.held ?? DEFAULT_HELD_ITEM_SCALE;
    const size = cellSize * CHARACTER_SCALE * scale;
    const glyph = this.createGlyphByAssetId(itemDefinition.visual.assetId, itemDefinition.id, size);

    glyph.set({
      left: itemDefinition.visual.heldOffset?.x ?? 0,
      top: itemDefinition.visual.heldOffset?.y ?? 0,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });
    glyph.set('itemDefinitionId', itemDefinition.id);
    return glyph;
  }

  private createGlyphByAssetId(assetId: string, itemId: string, size: number): Group {
    if (assetId === 'item/apple') {
      return this.createAppleGlyph(size);
    }

    if (assetId === 'item/toy_ball') {
      return this.createToyBallGlyph(size);
    }

    if (assetId === 'item/cards') {
      return this.createCardsGlyph(size);
    }

    if (assetId === 'item/clear_gem') {
      return this.createGemGlyph(size);
    }

    if (assetId === 'item/silver_bracelet') {
      return this.createBraceletGlyph(size);
    }

    return this.createDefaultGlyph(itemId, size);
  }

  private createAppleGlyph(size: number): Group {
    const body = new Circle({
      radius: size * 0.42,
      fill: '#d84c43',
      stroke: '#7c2727',
      strokeWidth: 1.2,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });
    const shine = new Ellipse({
      left: -size * 0.12,
      top: -size * 0.14,
      rx: size * 0.09,
      ry: size * 0.15,
      angle: 28,
      fill: 'rgba(255,255,255,0.42)',
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });
    const leaf = new Ellipse({
      left: size * 0.18,
      top: -size * 0.44,
      rx: size * 0.16,
      ry: size * 0.08,
      angle: -28,
      fill: '#4d9b55',
      stroke: '#286133',
      strokeWidth: 0.8,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });

    return this.createGlyphGroup([body, shine, leaf]);
  }

  private createToyBallGlyph(size: number): Group {
    const ball = new Circle({
      radius: size * 0.44,
      fill: '#f2d16b',
      stroke: '#6d5a24',
      strokeWidth: 1.2,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });
    const stripe = new Ellipse({
      rx: size * 0.11,
      ry: size * 0.42,
      fill: '#ef7b45',
      angle: 28,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });
    const highlight = new Circle({
      left: -size * 0.14,
      top: -size * 0.15,
      radius: size * 0.08,
      fill: 'rgba(255,255,255,0.55)',
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });

    return this.createGlyphGroup([ball, stripe, highlight]);
  }

  private createCardsGlyph(size: number): Group {
    const backCard = new Rect({
      left: size * 0.08,
      top: -size * 0.04,
      width: size * 0.5,
      height: size * 0.68,
      rx: 1.5,
      ry: 1.5,
      fill: '#9cc7ef',
      stroke: '#2f5f8a',
      strokeWidth: 1,
      angle: 10,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });
    const frontCard = new Rect({
      left: -size * 0.08,
      top: size * 0.04,
      width: size * 0.5,
      height: size * 0.68,
      rx: 1.5,
      ry: 1.5,
      fill: '#fffaf0',
      stroke: '#7f5f3e',
      strokeWidth: 1,
      angle: -9,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });
    const mark = new Text('A', {
      left: -size * 0.08,
      top: size * 0.04,
      fontSize: size * 0.26,
      fontWeight: '700',
      fontFamily: 'Arial, sans-serif',
      fill: '#b64646',
      angle: -9,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });

    return this.createGlyphGroup([backCard, frontCard, mark]);
  }

  private createGemGlyph(size: number): Group {
    const gem = new Polygon([
      { x: 0, y: -size * 0.5 },
      { x: size * 0.45, y: -size * 0.1 },
      { x: size * 0.24, y: size * 0.5 },
      { x: -size * 0.24, y: size * 0.5 },
      { x: -size * 0.45, y: -size * 0.1 },
    ], {
      fill: '#7ed9ff',
      stroke: '#287ca0',
      strokeWidth: 1.1,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });
    const glint = new Polygon([
      { x: -size * 0.08, y: -size * 0.32 },
      { x: size * 0.08, y: -size * 0.12 },
      { x: -size * 0.08, y: size * 0.08 },
      { x: -size * 0.24, y: -size * 0.12 },
    ], {
      fill: 'rgba(255,255,255,0.55)',
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });

    return this.createGlyphGroup([gem, glint]);
  }

  private createBraceletGlyph(size: number): Group {
    const ring = new Circle({
      radius: size * 0.42,
      fill: 'rgba(255,255,255,0)',
      stroke: '#c8d0d7',
      strokeWidth: Math.max(2, size * 0.16),
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });
    const shine = new Circle({
      left: size * 0.2,
      top: -size * 0.24,
      radius: size * 0.1,
      fill: '#ffffff',
      stroke: '#9aa6b2',
      strokeWidth: 0.7,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });

    return this.createGlyphGroup([ring, shine]);
  }

  private createDefaultGlyph(itemId: string, size: number): Group {
    const body = new Rect({
      width: size * 0.84,
      height: size * 0.84,
      rx: 2,
      ry: 2,
      fill: '#f4df8a',
      stroke: '#6d5a24',
      strokeWidth: 1,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });
    const label = new Text(itemId.slice(0, 1).toUpperCase(), {
      fontSize: size * 0.46,
      fontWeight: '700',
      fontFamily: 'Arial, sans-serif',
      fill: '#3f3518',
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });

    return this.createGlyphGroup([body, label]);
  }

  private createGlyphGroup(objects: FabricObject[]): Group {
    return new Group(objects, {
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      objectCaching: false,
    });
  }
}
