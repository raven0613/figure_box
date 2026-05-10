import { Canvas, Circle, Ellipse, FabricObject, Group, Path, Rect, Text } from 'fabric';

export type AvatarGroupKey = 'eyes' | 'hair';
export type AvatarTransformProperty = 'offsetX' | 'offsetY' | 'rotate' | 'scale';
export type AvatarEditableProperty = AvatarTransformProperty | 'color';

export type AvatarPartKey =
  | 'face'
  | AvatarGroupKey
  | 'eyes.sclera'
  | 'eyes.color'
  | 'eyes.pupil'
  | 'eyes.upperEyelid'
  | 'eyes.lowerEyelid'
  | 'eyes.light'
  | 'hair.bangs'
  | 'hair.sideburns'
  | 'hair.topHair'
  | 'hair.backHair'
  | 'hair.light'
  | 'mouth'
  | 'nose';

export interface AvatarPartOption {
  id: number;
  label: string;
}

export interface AvatarPartDefinition {
  key: AvatarPartKey;
  label: string;
  zIndex: number;
  defaultColor?: string;
  editableProperties: AvatarEditableProperty[];
  options: AvatarPartOption[];
  parentKey?: AvatarGroupKey;
}

export interface AvatarPartState {
  optionId: number;
  color?: string;
  offsetX?: number;
  offsetY?: number;
  rotate?: number;
  scale?: number;
}

export type AvatarState = Record<AvatarPartKey, AvatarPartState>;

export interface AvatarCanvasOptions {
  width?: number;
  height?: number;
  initialState?: Partial<AvatarState>;
  onChange?: (state: AvatarState) => void;
}

interface AvatarPartContext {
  width: number;
  height: number;
  centerX: number;
  faceCenterY: number;
  getGroupState: (key: AvatarGroupKey) => AvatarPartState;
}

interface Point2D {
  x: number;
  y: number;
}

const DEFAULT_CANVAS_WIDTH = 520;
const DEFAULT_CANVAS_HEIGHT = 560;
const DEFAULT_SCALE = 1;
const LABEL_FONT_SIZE = 12;
const EYE_DISTANCE = 48;

export const AVATAR_PART_DEFINITIONS: AvatarPartDefinition[] = [
  {
    key: 'face',
    label: 'face',
    zIndex: 0,
    defaultColor: '#f2c7a7',
    editableProperties: ['color'],
    options: [{ id: 0, label: 'face z-index 0' }],
  },
  {
    key: 'hair.backHair',
    label: 'backHair',
    zIndex: 1,
    defaultColor: '#27212a',
    editableProperties: ['color', 'offsetX', 'offsetY', 'rotate', 'scale'],
    options: [{ id: 0, label: 'backHair z-index 1' }],
    parentKey: 'hair',
  },
  {
    key: 'eyes',
    label: 'eyes',
    zIndex: 2,
    editableProperties: ['offsetX', 'offsetY', 'rotate', 'scale'],
    options: [{ id: 0, label: 'eyes group z-index 2' }],
  },
  {
    key: 'hair',
    label: 'hair',
    zIndex: 3,
    editableProperties: ['offsetX', 'offsetY', 'rotate', 'scale'],
    options: [{ id: 0, label: 'hair group z-index 3' }],
  },
  {
    key: 'eyes.sclera',
    label: 'sclera',
    zIndex: 4,
    defaultColor: '#fff9ef',
    editableProperties: ['color', 'offsetX', 'offsetY', 'scale'],
    options: [{ id: 0, label: 'sclera z-index 4' }],
    parentKey: 'eyes',
  },
  {
    key: 'eyes.color',
    label: 'eyes color',
    zIndex: 5,
    defaultColor: '#5a86b8',
    editableProperties: ['color', 'offsetX', 'offsetY', 'scale'],
    options: [{ id: 0, label: 'eyes color z-index 5' }],
    parentKey: 'eyes',
  },
  {
    key: 'eyes.pupil',
    label: 'pupil',
    zIndex: 6,
    defaultColor: '#172033',
    editableProperties: ['color', 'offsetX', 'offsetY', 'scale'],
    options: [{ id: 0, label: 'pupil z-index 6' }],
    parentKey: 'eyes',
  },
  {
    key: 'eyes.light',
    label: 'eye light',
    zIndex: 7,
    defaultColor: '#ffffff',
    editableProperties: ['color', 'offsetX', 'offsetY', 'rotate', 'scale'],
    options: [{ id: 0, label: 'eye light z-index 7' }],
    parentKey: 'eyes',
  },
  {
    key: 'eyes.lowerEyelid',
    label: 'lowerEyelid',
    zIndex: 8,
    defaultColor: '#6f3f3a',
    editableProperties: ['color', 'offsetX', 'offsetY', 'rotate', 'scale'],
    options: [{ id: 0, label: 'lowerEyelid z-index 8' }],
    parentKey: 'eyes',
  },
  {
    key: 'eyes.upperEyelid',
    label: 'upperEyelid',
    zIndex: 9,
    defaultColor: '#6f3f3a',
    editableProperties: ['color', 'offsetX', 'offsetY', 'rotate', 'scale'],
    options: [{ id: 0, label: 'upperEyelid z-index 9' }],
    parentKey: 'eyes',
  },
  {
    key: 'nose',
    label: 'nose',
    zIndex: 10,
    defaultColor: '#b36f61',
    editableProperties: ['color', 'offsetX', 'offsetY', 'rotate', 'scale'],
    options: [{ id: 0, label: 'nose z-index 10' }],
  },
  {
    key: 'mouth',
    label: 'mouth',
    zIndex: 11,
    defaultColor: '#b34a55',
    editableProperties: ['color', 'offsetX', 'offsetY', 'rotate', 'scale'],
    options: [{ id: 0, label: 'mouth z-index 11' }],
  },
  {
    key: 'hair.sideburns',
    label: 'sideburns',
    zIndex: 12,
    defaultColor: '#302030',
    editableProperties: ['color', 'offsetX', 'offsetY', 'rotate', 'scale'],
    options: [{ id: 0, label: 'sideburns z-index 12' }],
    parentKey: 'hair',
  },
  {
    key: 'hair.topHair',
    label: 'topHair',
    zIndex: 13,
    defaultColor: '#302030',
    editableProperties: ['color', 'offsetX', 'offsetY', 'rotate', 'scale'],
    options: [{ id: 0, label: 'topHair z-index 13' }],
    parentKey: 'hair',
  },
  {
    key: 'hair.bangs',
    label: 'bangs',
    zIndex: 14,
    defaultColor: '#302030',
    editableProperties: ['color', 'offsetX', 'offsetY', 'rotate', 'scale'],
    options: [{ id: 0, label: 'bangs z-index 14' }],
    parentKey: 'hair',
  },
  {
    key: 'hair.light',
    label: 'hair light',
    zIndex: 15,
    defaultColor: '#7c667e',
    editableProperties: ['color', 'offsetX', 'offsetY', 'rotate', 'scale'],
    options: [{ id: 0, label: 'hair light z-index 15' }],
    parentKey: 'hair',
  },
];

export function createDefaultAvatarState(): AvatarState {
  return AVATAR_PART_DEFINITIONS.reduce((state, definition) => {
    state[definition.key] = {
      optionId: definition.options[0]?.id ?? 0,
      color: definition.defaultColor,
      offsetX: 0,
      offsetY: 0,
      rotate: 0,
      scale: DEFAULT_SCALE,
    };
    return state;
  }, {} as AvatarState);
}

abstract class AvatarPart {
  protected readonly definition: AvatarPartDefinition;
  protected readonly context: AvatarPartContext;
  protected state: AvatarPartState;
  protected object: Group | null = null;

  constructor(definition: AvatarPartDefinition, context: AvatarPartContext, state: AvatarPartState) {
    this.definition = definition;
    this.context = context;
    this.state = { ...state };
  }

  get key(): AvatarPartKey {
    return this.definition.key;
  }

  get zIndex(): number {
    return this.definition.zIndex;
  }

  createObject(): Group {
    this.object = new Group([...this.createArtwork(), ...this.createLabel()], {
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      objectCaching: false,
    });
    this.applyTransform();
    return this.object;
  }

  update(nextState: AvatarPartState): void {
    this.state = { ...this.state, ...nextState };
    this.updateArtworkColor();
    this.applyTransform();
  }

  refreshParentTransform(): void {
    this.applyTransform();
  }

  protected abstract get baseX(): number;
  protected abstract get baseY(): number;
  protected abstract createArtwork(): FabricObject[];

  protected get color(): string {
    return this.state.color ?? this.definition.defaultColor ?? '#333333';
  }

  protected get scale(): number {
    return this.state.scale ?? DEFAULT_SCALE;
  }

  protected createLabel(): FabricObject[] {
    return [
      new Text(`${this.definition.label} z-index ${this.definition.zIndex}`, {
        left: 0,
        top: -14,
        originX: 'center',
        originY: 'center',
        fontSize: LABEL_FONT_SIZE,
        fill: '#111827',
        fontFamily: 'Inter, Arial, sans-serif',
        selectable: false,
        evented: false,
        backgroundColor: 'rgba(255,255,255,0.58)',
      }),
      new Text('0', {
        left: 0,
        top: 16,
        originX: 'center',
        originY: 'center',
        fontSize: LABEL_FONT_SIZE,
        fill: '#111827',
        fontFamily: 'Inter, Arial, sans-serif',
        selectable: false,
        evented: false,
        backgroundColor: 'rgba(255,255,255,0.58)',
      }),
    ];
  }

  protected getPartOffset(): Point2D {
    return {
      x: this.state.offsetX ?? 0,
      y: this.state.offsetY ?? 0,
    };
  }

  protected getPartRotation(): number {
    return this.state.rotate ?? 0;
  }

  protected applyTransform(): void {
    if (!this.object) {
      return;
    }

    const transform = this.resolveWorldTransform(this.getPartOffset(), this.getPartRotation(), this.scale);
    this.object.set(transform);
    this.object.setCoords();
  }

  protected resolveWorldTransform(offset: Point2D, rotation: number, scale: number): {
    left: number;
    top: number;
    angle: number;
    scaleX: number;
    scaleY: number;
  } {
    const parentKey = this.definition.parentKey;

    if (!parentKey) {
      return {
        left: this.baseX + offset.x,
        top: this.baseY + offset.y,
        angle: rotation,
        scaleX: scale,
        scaleY: scale,
      };
    }

    const parentState = this.context.getGroupState(parentKey);
    const parentBase = this.getGroupBase(parentKey);
    const parentScale = parentState.scale ?? DEFAULT_SCALE;
    const parentRotation = parentState.rotate ?? 0;
    const localPoint = {
      x: this.baseX - parentBase.x + offset.x,
      y: this.baseY - parentBase.y + offset.y,
    };
    const rotatedPoint = rotatePoint({
      x: localPoint.x * parentScale,
      y: localPoint.y * parentScale,
    }, parentRotation);

    return {
      left: parentBase.x + (parentState.offsetX ?? 0) + rotatedPoint.x,
      top: parentBase.y + (parentState.offsetY ?? 0) + rotatedPoint.y,
      angle: parentRotation + rotation,
      scaleX: parentScale * scale,
      scaleY: parentScale * scale,
    };
  }

  protected getGroupBase(key: AvatarGroupKey): Point2D {
    if (key === 'eyes') {
      return {
        x: this.context.centerX,
        y: this.context.faceCenterY - 34,
      };
    }

    return {
      x: this.context.centerX,
      y: this.context.faceCenterY - 44,
    };
  }

  protected updateArtworkColor(): void {
    if (!this.object) {
      return;
    }

    this.object.getObjects().forEach(object => {
      if (object.get('data') === 'avatar-art') {
        object.set('fill', this.color);
      }
    });
  }

  protected markAsArtwork<T extends FabricObject>(object: T): T {
    object.set('data', 'avatar-art');
    return object;
  }
}

abstract class AvatarControlGroupPart extends AvatarPart {
  protected createArtwork(): FabricObject[] {
    return [];
  }

  protected getPartOffset(): Point2D {
    return { x: 0, y: 0 };
  }

  protected getPartRotation(): number {
    return 0;
  }

  protected resolveWorldTransform(): {
    left: number;
    top: number;
    angle: number;
    scaleX: number;
    scaleY: number;
  } {
    return {
      left: this.baseX + (this.state.offsetX ?? 0),
      top: this.baseY + (this.state.offsetY ?? 0),
      angle: this.state.rotate ?? 0,
      scaleX: this.state.scale ?? DEFAULT_SCALE,
      scaleY: this.state.scale ?? DEFAULT_SCALE,
    };
  }
}

class EyeGroupPart extends AvatarControlGroupPart {
  protected get baseX(): number {
    return this.context.centerX;
  }

  protected get baseY(): number {
    return this.context.faceCenterY - 34;
  }

  protected createLabel(): FabricObject[] {
    return this.createWideLabel(86);
  }

  private createWideLabel(distance: number): FabricObject[] {
    return [
      new Text(`${this.definition.label} z-index ${this.definition.zIndex}`, {
        left: 0,
        top: -distance,
        originX: 'center',
        originY: 'center',
        fontSize: LABEL_FONT_SIZE,
        fill: '#111827',
        fontFamily: 'Inter, Arial, sans-serif',
        backgroundColor: 'rgba(255,255,255,0.58)',
        selectable: false,
        evented: false,
      }),
      new Text('0', {
        left: 0,
        top: distance,
        originX: 'center',
        originY: 'center',
        fontSize: LABEL_FONT_SIZE,
        fill: '#111827',
        fontFamily: 'Inter, Arial, sans-serif',
        backgroundColor: 'rgba(255,255,255,0.58)',
        selectable: false,
        evented: false,
      }),
    ];
  }
}

class HairGroupPart extends AvatarControlGroupPart {
  protected get baseX(): number {
    return this.context.centerX;
  }

  protected get baseY(): number {
    return this.context.faceCenterY - 44;
  }

  protected createLabel(): FabricObject[] {
    return [
      new Text(`${this.definition.label} z-index ${this.definition.zIndex}`, {
        left: 0,
        top: -172,
        originX: 'center',
        originY: 'center',
        fontSize: LABEL_FONT_SIZE,
        fill: '#111827',
        fontFamily: 'Inter, Arial, sans-serif',
        backgroundColor: 'rgba(255,255,255,0.58)',
        selectable: false,
        evented: false,
      }),
      new Text('0', {
        left: 0,
        top: 172,
        originX: 'center',
        originY: 'center',
        fontSize: LABEL_FONT_SIZE,
        fill: '#111827',
        fontFamily: 'Inter, Arial, sans-serif',
        backgroundColor: 'rgba(255,255,255,0.58)',
        selectable: false,
        evented: false,
      }),
    ];
  }
}

class FacePart extends AvatarPart {
  protected get baseX(): number {
    return this.context.centerX;
  }

  protected get baseY(): number {
    return this.context.faceCenterY;
  }

  protected createArtwork(): FabricObject[] {
    return [
      this.markAsArtwork(new Ellipse({
        rx: 118,
        ry: 146,
        fill: this.color,
        stroke: '#6e4d45',
        strokeWidth: 2,
        originX: 'center',
        originY: 'center',
      })),
    ];
  }
}

abstract class MirroredEyePart extends AvatarPart {
  protected get baseX(): number {
    return this.context.centerX;
  }

  protected get baseY(): number {
    return this.context.faceCenterY - 34;
  }

  protected createArtwork(): FabricObject[] {
    return [
      ...this.createSideArtwork(-1),
      ...this.createSideArtwork(1),
    ];
  }

  update(nextState: AvatarPartState): void {
    super.update(nextState);
    this.updateMirroredChildren();
  }

  protected applyTransform(): void {
    if (!this.object) {
      return;
    }

    this.updateMirroredChildren();
    const transform = this.resolveWorldTransform({ x: 0, y: 0 }, 0, 1);
    this.object.set(transform);
    this.object.setCoords();
  }

  protected createSideLabel(side: -1 | 1): FabricObject[] {
    return [
      new Text(`${this.definition.label} z-index ${this.definition.zIndex}`, {
        left: side * EYE_DISTANCE,
        top: -34,
        originX: 'center',
        originY: 'center',
        fontSize: LABEL_FONT_SIZE,
        fill: '#111827',
        fontFamily: 'Inter, Arial, sans-serif',
        backgroundColor: 'rgba(255,255,255,0.58)',
        selectable: false,
        evented: false,
      }),
      new Text('0', {
        left: side * EYE_DISTANCE,
        top: 34,
        originX: 'center',
        originY: 'center',
        fontSize: LABEL_FONT_SIZE,
        fill: '#111827',
        fontFamily: 'Inter, Arial, sans-serif',
        backgroundColor: 'rgba(255,255,255,0.58)',
        selectable: false,
        evented: false,
      }),
    ];
  }

  protected createLabel(): FabricObject[] {
    return [
      ...this.createSideLabel(-1),
      ...this.createSideLabel(1),
    ];
  }

  protected abstract createSideArtwork(side: -1 | 1): FabricObject[];

  protected updateMirroredChildren(): void {
    if (!this.object) {
      return;
    }

    this.object.getObjects().forEach(object => {
      const side = object.get('data-side') as -1 | 1 | undefined;

      if (!side) {
        return;
      }

      object.set({
        left: this.getSideBaseX(side) + side * (this.state.offsetX ?? 0),
        top: this.getSideBaseY() + (this.state.offsetY ?? 0),
        angle: this.getSideBaseAngle() + side * (this.state.rotate ?? 0),
        scaleX: this.scale,
        scaleY: this.scale,
      });
    });
  }

  protected getSideBaseX(side: -1 | 1): number {
    return side * EYE_DISTANCE;
  }

  protected getSideBaseY(): number {
    return 0;
  }

  protected getSideBaseAngle(): number {
    return 0;
  }

  protected markAsSideArtwork<T extends FabricObject>(object: T, side: -1 | 1): T {
    this.markAsArtwork(object);
    object.set('data-side', side);
    return object;
  }
}

class ScleraPart extends MirroredEyePart {
  protected createSideArtwork(side: -1 | 1): FabricObject[] {
    return [
      this.markAsSideArtwork(new Ellipse({
        rx: 34,
        ry: 19,
        fill: this.color,
        stroke: '#413633',
        strokeWidth: 2,
        originX: 'center',
        originY: 'center',
      }), side),
    ];
  }
}

class IrisPart extends MirroredEyePart {
  protected createSideArtwork(side: -1 | 1): FabricObject[] {
    return [
      this.markAsSideArtwork(new Circle({
        radius: 13,
        fill: this.color,
        originX: 'center',
        originY: 'center',
      }), side),
    ];
  }
}

class PupilPart extends MirroredEyePart {
  protected createSideArtwork(side: -1 | 1): FabricObject[] {
    return [
      this.markAsSideArtwork(new Circle({
        radius: 6,
        fill: this.color,
        originX: 'center',
        originY: 'center',
      }), side),
    ];
  }
}

class EyeLightPart extends MirroredEyePart {
  protected createSideArtwork(side: -1 | 1): FabricObject[] {
    return [
      this.markAsSideArtwork(new Circle({
        radius: 4,
        fill: this.color,
        originX: 'center',
        originY: 'center',
      }), side),
    ];
  }

  protected getSideBaseX(side: -1 | 1): number {
    return side * EYE_DISTANCE - side * 5;
  }

  protected getSideBaseY(): number {
    return -6;
  }
}

class EyelidPart extends MirroredEyePart {
  protected createSideArtwork(side: -1 | 1): FabricObject[] {
    const isUpper = this.definition.key === 'eyes.upperEyelid';

    return [
      this.markAsSideArtwork(new Path(
        isUpper ? 'M -32 0 Q 0 -28 32 0 Q 0 -10 -32 0 Z' : 'M -30 0 Q 0 18 30 0 Q 0 8 -30 0 Z',
        {
          fill: this.color,
          opacity: 0.9,
          originX: 'center',
          originY: 'center',
        }
      ), side),
    ];
  }

  protected getSideBaseY(): number {
    return this.definition.key === 'eyes.upperEyelid' ? -11 : 13;
  }
}

class NosePart extends AvatarPart {
  protected get baseX(): number {
    return this.context.centerX;
  }

  protected get baseY(): number {
    return this.context.faceCenterY + 24;
  }

  protected createArtwork(): FabricObject[] {
    return [
      this.markAsArtwork(new Path('M 0 -24 C 14 4 12 34 -12 30 C 4 22 -4 10 0 -24 Z', {
        fill: this.color,
        opacity: 0.72,
        originX: 'center',
        originY: 'center',
      })),
    ];
  }
}

class MouthPart extends AvatarPart {
  protected get baseX(): number {
    return this.context.centerX;
  }

  protected get baseY(): number {
    return this.context.faceCenterY + 86;
  }

  protected createArtwork(): FabricObject[] {
    return [
      this.markAsArtwork(new Path('M -38 -4 Q 0 34 38 -4 Q 0 14 -38 -4 Z', {
        fill: this.color,
        stroke: '#66333a',
        strokeWidth: 2,
        originX: 'center',
        originY: 'center',
      })),
    ];
  }
}

class BackHairPart extends AvatarPart {
  protected get baseX(): number {
    return this.context.centerX;
  }

  protected get baseY(): number {
    return this.context.faceCenterY - 4;
  }

  protected createArtwork(): FabricObject[] {
    return [
      this.markAsArtwork(new Path('M -132 -86 C -148 0 -122 148 -38 172 C -82 56 -54 -120 0 -142 C 54 -120 82 56 38 172 C 122 148 148 0 132 -86 C 118 -178 -118 -178 -132 -86 Z', {
        fill: this.color,
        originX: 'center',
        originY: 'center',
      })),
    ];
  }
}

class SideburnsPart extends AvatarPart {
  protected get baseX(): number {
    return this.context.centerX;
  }

  protected get baseY(): number {
    return this.context.faceCenterY - 10;
  }

  protected createArtwork(): FabricObject[] {
    return [
      this.markAsArtwork(new Path('M -104 -84 C -142 -24 -134 80 -94 120 C -108 42 -86 -28 -62 -78 Z', {
        fill: this.color,
        originX: 'center',
        originY: 'center',
      })),
      this.markAsArtwork(new Path('M 104 -84 C 142 -24 134 80 94 120 C 108 42 86 -28 62 -78 Z', {
        fill: this.color,
        originX: 'center',
        originY: 'center',
      })),
    ];
  }
}

class TopHairPart extends AvatarPart {
  protected get baseX(): number {
    return this.context.centerX;
  }

  protected get baseY(): number {
    return this.context.faceCenterY - 137;
  }

  protected createArtwork(): FabricObject[] {
    return [
      this.markAsArtwork(new Path('M -92 36 C -86 -44 -26 -84 18 -74 C 6 -54 0 -36 0 -12 C 28 -52 72 -58 96 -22 C 50 -18 30 10 16 44 C -16 12 -52 16 -92 36 Z', {
        fill: this.color,
        originX: 'center',
        originY: 'center',
      })),
    ];
  }
}

class BangsPart extends AvatarPart {
  protected get baseX(): number {
    return this.context.centerX;
  }

  protected get baseY(): number {
    return this.context.faceCenterY - 104;
  }

  protected createArtwork(): FabricObject[] {
    return [
      this.markAsArtwork(new Path('M -112 -22 C -72 -72 66 -78 112 -20 C 82 -22 70 26 38 52 C 40 18 26 -4 4 -10 C -14 24 -44 42 -82 46 C -62 18 -76 -12 -112 -22 Z', {
        fill: this.color,
        originX: 'center',
        originY: 'center',
      })),
    ];
  }
}

class HairLightPart extends AvatarPart {
  protected get baseX(): number {
    return this.context.centerX - 40;
  }

  protected get baseY(): number {
    return this.context.faceCenterY - 140;
  }

  protected createArtwork(): FabricObject[] {
    return [
      this.markAsArtwork(new Rect({
        width: 84,
        height: 10,
        rx: 5,
        ry: 5,
        fill: this.color,
        opacity: 0.55,
        angle: -14,
        originX: 'center',
        originY: 'center',
      })),
    ];
  }
}

class AvatarPartFactory {
  create(definition: AvatarPartDefinition, context: AvatarPartContext, state: AvatarPartState): AvatarPart {
    switch (definition.key) {
      case 'face':
        return new FacePart(definition, context, state);
      case 'eyes':
        return new EyeGroupPart(definition, context, state);
      case 'hair':
        return new HairGroupPart(definition, context, state);
      case 'eyes.sclera':
        return new ScleraPart(definition, context, state);
      case 'eyes.color':
        return new IrisPart(definition, context, state);
      case 'eyes.pupil':
        return new PupilPart(definition, context, state);
      case 'eyes.light':
        return new EyeLightPart(definition, context, state);
      case 'eyes.upperEyelid':
      case 'eyes.lowerEyelid':
        return new EyelidPart(definition, context, state);
      case 'nose':
        return new NosePart(definition, context, state);
      case 'mouth':
        return new MouthPart(definition, context, state);
      case 'hair.backHair':
        return new BackHairPart(definition, context, state);
      case 'hair.sideburns':
        return new SideburnsPart(definition, context, state);
      case 'hair.topHair':
        return new TopHairPart(definition, context, state);
      case 'hair.bangs':
        return new BangsPart(definition, context, state);
      case 'hair.light':
        return new HairLightPart(definition, context, state);
    }
  }
}

class AvatarStateStore {
  private state: AvatarState;

  constructor(initialState?: Partial<AvatarState>) {
    this.state = this.mergeInitialState(initialState);
  }

  getSnapshot(): AvatarState {
    return structuredClone(this.state);
  }

  getPartState(key: AvatarPartKey): AvatarPartState {
    return { ...this.state[key] };
  }

  updatePart(key: AvatarPartKey, patch: Partial<AvatarPartState>): AvatarPartState {
    const nextState = {
      ...this.state[key],
      ...patch,
    };
    this.state = {
      ...this.state,
      [key]: nextState,
    };
    return { ...nextState };
  }

  private mergeInitialState(initialState?: Partial<AvatarState>): AvatarState {
    const defaults = createDefaultAvatarState();

    if (!initialState) {
      return defaults;
    }

    AVATAR_PART_DEFINITIONS.forEach(definition => {
      defaults[definition.key] = {
        ...defaults[definition.key],
        ...initialState[definition.key],
      };
    });

    return defaults;
  }
}

export class AvatarCanvas {
  private readonly canvas: Canvas;
  private readonly stateStore: AvatarStateStore;
  private readonly partFactory = new AvatarPartFactory();
  private readonly parts = new Map<AvatarPartKey, AvatarPart>();
  private readonly onChange?: (state: AvatarState) => void;

  constructor(canvasElement: HTMLCanvasElement | string, options: AvatarCanvasOptions = {}) {
    const width = options.width ?? DEFAULT_CANVAS_WIDTH;
    const height = options.height ?? DEFAULT_CANVAS_HEIGHT;
    this.onChange = options.onChange;
    this.stateStore = new AvatarStateStore(options.initialState);
    this.canvas = new Canvas(canvasElement, {
      width,
      height,
      backgroundColor: '#f7f5ef',
      selection: false,
      preserveObjectStacking: true,
    });

    this.canvas.wrapperEl.style.touchAction = 'none';
    this.canvas.lowerCanvasEl.style.touchAction = 'none';
    this.buildAvatar(width, height);
    this.emitChange();
  }

  static mount(container: HTMLElement, options?: AvatarCanvasOptions): AvatarCanvas {
    const canvasElement = document.createElement('canvas');
    container.appendChild(canvasElement);
    return new AvatarCanvas(canvasElement, options);
  }

  getState(): AvatarState {
    return this.stateStore.getSnapshot();
  }

  getPartState(key: AvatarPartKey): AvatarPartState {
    return this.stateStore.getPartState(key);
  }

  setOption(key: AvatarPartKey, optionId: number): void {
    this.updatePart(key, { optionId });
  }

  setColor(key: AvatarPartKey, color: string): void {
    this.updatePart(key, { color });
  }

  move(key: AvatarPartKey, deltaX: number, deltaY: number): void {
    const current = this.getPartState(key);
    this.updatePart(key, {
      offsetX: (current.offsetX ?? 0) + deltaX,
      offsetY: (current.offsetY ?? 0) + deltaY,
    });
  }

  rotate(key: AvatarPartKey, delta: number): void {
    const current = this.getPartState(key);
    this.updatePart(key, { rotate: (current.rotate ?? 0) + delta });
  }

  scale(key: AvatarPartKey, delta: number): void {
    const current = this.getPartState(key);
    const nextScale = Math.max(0.2, Math.min(3, (current.scale ?? DEFAULT_SCALE) + delta));
    this.updatePart(key, { scale: Number(nextScale.toFixed(2)) });
  }

  destroy(): Promise<boolean> {
    return this.canvas.dispose();
  }

  private buildAvatar(width: number, height: number): void {
    const context: AvatarPartContext = {
      width,
      height,
      centerX: width / 2,
      faceCenterY: height / 2 + 26,
      getGroupState: key => this.stateStore.getPartState(key),
    };

    AVATAR_PART_DEFINITIONS
      .slice()
      .sort((first, second) => first.zIndex - second.zIndex)
      .forEach(definition => {
        const part = this.partFactory.create(definition, context, this.stateStore.getPartState(definition.key));
        this.parts.set(definition.key, part);
        this.canvas.add(part.createObject());
      });

    this.canvas.requestRenderAll();
  }

  private updatePart(key: AvatarPartKey, patch: Partial<AvatarPartState>): void {
    const nextState = this.stateStore.updatePart(key, patch);
    const part = this.parts.get(key);
    part?.update(nextState);

    if (this.isGroupKey(key)) {
      this.refreshGroupChildren(key);
    }

    this.canvas.requestRenderAll();
    this.emitChange();
  }

  private refreshGroupChildren(groupKey: AvatarGroupKey): void {
    AVATAR_PART_DEFINITIONS
      .filter(definition => definition.parentKey === groupKey)
      .forEach(definition => this.parts.get(definition.key)?.refreshParentTransform());
  }

  private isGroupKey(key: AvatarPartKey): key is AvatarGroupKey {
    return key === 'eyes' || key === 'hair';
  }

  private emitChange(): void {
    this.onChange?.(this.getState());
  }
}

function rotatePoint(point: Point2D, degrees: number): Point2D {
  const radians = degrees * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}
