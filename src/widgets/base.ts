import { Canvas, FabricObject } from 'fabric';
import { canvasService, CanvasTag } from '~/services/canvasCtxService';

export interface Position {
  x: number;
  y: number;
}

export interface Base {
  draw(): BaseWidget | Promise<BaseWidget>;
  destroy(): void;
  getShape(): FabricObject;
}

export abstract class BaseWidget<T extends FabricObject = FabricObject> implements Base {
  protected position: Position;
  protected shape: T;
  protected container: Canvas;

  // TODO: Refactor parameters to object
  constructor(position: Position, shape: T, containerType: CanvasTag = CanvasTag.STATIC) {
    this.position = { x: position.x, y: position.y };
    this.shape = shape;
    this.container = canvasService.getCanvasContext(containerType);
  }

  draw(): this {
    this.container.add(this.shape);
    return this;
  }

  destroy(): void {
    this.container.remove(this.shape);
  }

  getShape(): T {
    return this.shape;
  }
}
