import { Canvas, Group, Rect, Text, type FabricObject } from 'fabric';

type ViewportTransform = [number, number, number, number, number, number];
type ZoomControlAction = 'zoom-in' | 'zoom-out';

interface TownMapCameraOptions {
  canvas: Canvas;
  baseCanvasElement: HTMLCanvasElement;
  mapWidth: number;
  mapHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  minZoom?: number;
  maxZoom?: number;
  onZoomChange?: (zoom: number) => void;
}

interface PointerPosition {
  x: number;
  y: number;
}

export interface TownMapCameraPoint {
  x: number;
  y: number;
}

interface PinchGestureState {
  startCenter: PointerPosition;
  startDistance: number;
  startViewport: ViewportTransform;
  startZoom: number;
}

const DEFAULT_MIN_ZOOM = 1;
const DEFAULT_MAX_ZOOM = 4;
const WHEEL_ZOOM_FACTOR = 0.0018;
const PAN_MOVE_THRESHOLD = 3;
const ZOOM_CONTROL_SIZE = 34;
const ZOOM_CONTROL_GAP = 8;
const ZOOM_CONTROL_MARGIN = 14;

export class TownMapCamera {
  private readonly canvas: Canvas;
  private readonly baseCanvasElement: HTMLCanvasElement;
  private readonly mapWidth: number;
  private readonly mapHeight: number;
  private readonly viewportWidth: number;
  private readonly viewportHeight: number;
  private readonly minZoom: number;
  private readonly maxZoom: number;
  private readonly onZoomChange?: (zoom: number) => void;
  private readonly zoomControls: Group[];
  private zoom = 1;
  private notifiedZoom = 1;
  private panStart: PointerPosition | null = null;
  private viewportStart: ViewportTransform | null = null;
  private hasPannedSincePointerDown = false;
  private pinchGesture: PinchGestureState | null = null;

  constructor(options: TownMapCameraOptions) {
    this.canvas = options.canvas;
    this.baseCanvasElement = options.baseCanvasElement;
    this.mapWidth = options.mapWidth;
    this.mapHeight = options.mapHeight;
    this.viewportWidth = options.viewportWidth;
    this.viewportHeight = options.viewportHeight;
    this.minZoom = options.minZoom ?? DEFAULT_MIN_ZOOM;
    this.maxZoom = options.maxZoom ?? DEFAULT_MAX_ZOOM;
    this.onZoomChange = options.onZoomChange;
    this.zoomControls = this.createZoomControls();

    this.applyViewport([1, 0, 0, 1, 0, 0]);
    this.bindTouchGestures();
  }

  getZoom(): number {
    return this.zoom;
  }

  centerOn(point: TownMapCameraPoint): void {
    this.applyViewport(this.clampViewport([
      this.zoom,
      0,
      0,
      this.zoom,
      this.viewportWidth / 2 - point.x * this.zoom,
      this.viewportHeight / 2 - point.y * this.zoom,
    ]));
  }

  addControls(): void {
    this.zoomControls.forEach(control => this.canvas.add(control));
    this.updateZoomControlPositions();
  }

  isZoomControl(target: unknown): boolean {
    return this.getZoomControlAction(target) !== null;
  }

  handleZoomControl(target: unknown): boolean {
    const action = this.getZoomControlAction(target);

    if (!action) {
      return false;
    }

    const nextZoom = action === 'zoom-in'
      ? Math.min(this.maxZoom, Math.floor(this.zoom) + 1)
      : Math.max(this.minZoom, Math.ceil(this.zoom) - 1);

    this.zoomToCenter(nextZoom);
    return true;
  }

  handleWheel(event: WheelEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const nextZoom = this.clampZoom(this.zoom * (1 - event.deltaY * WHEEL_ZOOM_FACTOR));
    const pointer = this.getViewportPointer(event);
    this.zoomToPoint(pointer, nextZoom);
  }

  startPan(event: MouseEvent | TouchEvent | PointerEvent, target: unknown): boolean {
    if (this.zoom <= this.minZoom || target) {
      return false;
    }

    this.panStart = this.getViewportPointer(event);
    this.viewportStart = this.getViewportTransform();
    this.hasPannedSincePointerDown = false;
    this.canvas.defaultCursor = 'grabbing';
    return true;
  }

  pan(event: MouseEvent | TouchEvent | PointerEvent): boolean {
    if (!this.panStart || !this.viewportStart) {
      return false;
    }

    const pointer = this.getViewportPointer(event);
    const deltaX = pointer.x - this.panStart.x;
    const deltaY = pointer.y - this.panStart.y;

    if (Math.abs(deltaX) > PAN_MOVE_THRESHOLD || Math.abs(deltaY) > PAN_MOVE_THRESHOLD) {
      this.hasPannedSincePointerDown = true;
    }

    const nextViewport: ViewportTransform = [
      this.zoom,
      0,
      0,
      this.zoom,
      this.viewportStart[4] + deltaX,
      this.viewportStart[5] + deltaY,
    ];

    this.applyViewport(this.clampViewport(nextViewport));
    return true;
  }

  endPan(): boolean {
    const didPan = this.hasPannedSincePointerDown;
    this.panStart = null;
    this.viewportStart = null;
    this.hasPannedSincePointerDown = false;
    this.canvas.defaultCursor = 'default';
    return didPan;
  }

  dispose(): void {
    this.canvas.upperCanvasEl.removeEventListener('touchstart', this.handleTouchStart);
    this.canvas.upperCanvasEl.removeEventListener('touchmove', this.handleTouchMove);
    this.canvas.upperCanvasEl.removeEventListener('touchend', this.handleTouchEnd);
    this.canvas.upperCanvasEl.removeEventListener('touchcancel', this.handleTouchEnd);
  }

  private bindTouchGestures(): void {
    this.canvas.upperCanvasEl.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    this.canvas.upperCanvasEl.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.canvas.upperCanvasEl.addEventListener('touchend', this.handleTouchEnd, { passive: false });
    this.canvas.upperCanvasEl.addEventListener('touchcancel', this.handleTouchEnd, { passive: false });
  }

  private handleTouchStart = (event: TouchEvent): void => {
    if (event.touches.length !== 2) {
      return;
    }

    event.preventDefault();
    const touches = this.getTouchPair(event);

    if (!touches) {
      return;
    }

    this.endPan();
    this.pinchGesture = {
      startCenter: this.getTouchCenter(touches),
      startDistance: this.getTouchDistance(touches),
      startViewport: this.getViewportTransform(),
      startZoom: this.zoom,
    };
  };

  private handleTouchMove = (event: TouchEvent): void => {
    if (event.touches.length !== 2 || !this.pinchGesture) {
      return;
    }

    event.preventDefault();
    const touches = this.getTouchPair(event);

    if (!touches || this.pinchGesture.startDistance === 0) {
      return;
    }

    const center = this.getTouchCenter(touches);
    const distance = this.getTouchDistance(touches);
    const nextZoom = this.clampZoom(this.pinchGesture.startZoom * (distance / this.pinchGesture.startDistance));
    const sceneX = (this.pinchGesture.startCenter.x - this.pinchGesture.startViewport[4]) / this.pinchGesture.startZoom;
    const sceneY = (this.pinchGesture.startCenter.y - this.pinchGesture.startViewport[5]) / this.pinchGesture.startZoom;

    this.zoom = nextZoom;
    this.applyViewport(this.clampViewport([
      nextZoom,
      0,
      0,
      nextZoom,
      center.x - sceneX * nextZoom,
      center.y - sceneY * nextZoom,
    ]));
  };

  private handleTouchEnd = (event: TouchEvent): void => {
    if (event.touches.length >= 2) {
      return;
    }

    this.pinchGesture = null;
  };

  private zoomToCenter(nextZoom: number): void {
    this.zoomToPoint(
      {
        x: this.viewportWidth / 2,
        y: this.viewportHeight / 2,
      },
      nextZoom,
    );
  }

  private zoomToPoint(point: PointerPosition, nextZoom: number): void {
    const clampedZoom = this.clampZoom(nextZoom);
    const viewport = this.getViewportTransform();
    const sceneX = (point.x - viewport[4]) / this.zoom;
    const sceneY = (point.y - viewport[5]) / this.zoom;
    const nextViewport = this.clampViewport([
      clampedZoom,
      0,
      0,
      clampedZoom,
      point.x - sceneX * clampedZoom,
      point.y - sceneY * clampedZoom,
    ]);

    this.zoom = clampedZoom;
    this.applyViewport(nextViewport);
  }

  private applyViewport(viewport: ViewportTransform): void {
    this.canvas.setViewportTransform(viewport);
    this.baseCanvasElement.style.transformOrigin = '0 0';
    this.baseCanvasElement.style.transform = `matrix(${viewport[0]}, ${viewport[1]}, ${viewport[2]}, ${viewport[3]}, ${viewport[4]}, ${viewport[5]})`;
    this.updateZoomControlPositions();
    this.canvas.requestRenderAll();
    this.notifyZoomChange(viewport[0]);
  }

  private notifyZoomChange(zoom: number): void {
    if (zoom === this.notifiedZoom) {
      return;
    }

    this.notifiedZoom = zoom;
    this.onZoomChange?.(zoom);
  }

  private clampViewport(viewport: ViewportTransform): ViewportTransform {
    const zoom = viewport[0];
    const scaledWidth = this.mapWidth * zoom;
    const scaledHeight = this.mapHeight * zoom;
    const minX = Math.min(0, this.viewportWidth - scaledWidth);
    const minY = Math.min(0, this.viewportHeight - scaledHeight);

    return [
      zoom,
      0,
      0,
      zoom,
      this.clamp(viewport[4], minX, 0),
      this.clamp(viewport[5], minY, 0),
    ];
  }

  private updateZoomControlPositions(): void {
    const viewport = this.getViewportTransform();

    this.zoomControls.forEach((control, index) => {
      const screenX = this.viewportWidth - ZOOM_CONTROL_MARGIN - ZOOM_CONTROL_SIZE / 2;
      const screenY = ZOOM_CONTROL_MARGIN + ZOOM_CONTROL_SIZE / 2 + index * (ZOOM_CONTROL_SIZE + ZOOM_CONTROL_GAP);

      control.set({
        left: (screenX - viewport[4]) / this.zoom,
        top: (screenY - viewport[5]) / this.zoom,
        scaleX: 1 / this.zoom,
        scaleY: 1 / this.zoom,
      });
      control.setCoords();
    });
  }

  private createZoomControls(): Group[] {
    return [
      this.createZoomControl('zoom-in', '+', 0),
      this.createZoomControl('zoom-out', '-', 1),
    ];
  }

  private createZoomControl(action: ZoomControlAction, label: string, index: number): Group {
    const background = new Rect({
      width: ZOOM_CONTROL_SIZE,
      height: ZOOM_CONTROL_SIZE,
      rx: 6,
      ry: 6,
      fill: 'rgba(255, 255, 255, 0.94)',
      stroke: 'rgba(28, 31, 35, 0.28)',
      strokeWidth: 1,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });
    const symbol = new Text(label, {
      fontSize: 22,
      fontFamily: 'Arial, sans-serif',
      fontWeight: '700',
      fill: '#24313a',
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });
    const control = new Group([background, symbol], {
      left: this.viewportWidth - ZOOM_CONTROL_MARGIN - ZOOM_CONTROL_SIZE / 2,
      top: ZOOM_CONTROL_MARGIN + ZOOM_CONTROL_SIZE / 2 + index * (ZOOM_CONTROL_SIZE + ZOOM_CONTROL_GAP),
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: true,
      hoverCursor: 'pointer',
      objectCaching: false,
    });

    control.set('cameraControl', action);
    control.set('sortBottomY', Number.POSITIVE_INFINITY);
    control.set('entityLayerRank', Number.POSITIVE_INFINITY);
    return control;
  }

  private getZoomControlAction(target: unknown): ZoomControlAction | null {
    const maybeObject = target as FabricObject | undefined;
    const action = maybeObject?.get?.('cameraControl');

    return action === 'zoom-in' || action === 'zoom-out' ? action : null;
  }

  private getViewportTransform(): ViewportTransform {
    const viewport = this.canvas.viewportTransform;
    return [
      viewport[0],
      viewport[1],
      viewport[2],
      viewport[3],
      viewport[4],
      viewport[5],
    ];
  }

  private getViewportPointer(event: MouseEvent | TouchEvent | PointerEvent | WheelEvent): PointerPosition {
    if ('touches' in event) {
      const touch = event.touches[0] ?? event.changedTouches[0];

      return this.normalizeCanvasPoint({ x: touch.clientX, y: touch.clientY });
    }

    return this.normalizeCanvasPoint({ x: event.clientX, y: event.clientY });
  }

  private getTouchPair(event: TouchEvent): [Touch, Touch] | null {
    const firstTouch = event.touches[0];
    const secondTouch = event.touches[1];

    if (!firstTouch || !secondTouch) {
      return null;
    }

    return [firstTouch, secondTouch];
  }

  private getTouchCenter([firstTouch, secondTouch]: [Touch, Touch]): PointerPosition {
    return this.normalizeCanvasPoint({
      x: (firstTouch.clientX + secondTouch.clientX) / 2,
      y: (firstTouch.clientY + secondTouch.clientY) / 2,
    });
  }

  private getTouchDistance([firstTouch, secondTouch]: [Touch, Touch]): number {
    const deltaX = firstTouch.clientX - secondTouch.clientX;
    const deltaY = firstTouch.clientY - secondTouch.clientY;

    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  }

  private normalizeCanvasPoint(point: PointerPosition): PointerPosition {
    const rect = this.canvas.upperCanvasEl.getBoundingClientRect();

    return {
      x: point.x - rect.left,
      y: point.y - rect.top,
    };
  }

  private clampZoom(zoom: number): number {
    return this.clamp(zoom, this.minZoom, this.maxZoom);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}
