import { Canvas, Circle, FabricImage, FabricObject, Line, Path, PencilBrush, Point } from 'fabric';

export type DrawingTool = 'pencil' | 'eraser' | 'fill' | 'line' | 'circle';

export type PathCommand =
  | ['M', number, number]
  | ['L', number, number]
  | ['Q', number, number, number, number]
  | ['C', number, number, number, number, number, number]
  | ['Z'];

export interface DrawingPoint {
  x: number;
  y: number;
}

export interface DrawingStrokeActionData {
  type: 'stroke';
  tool: 'pencil' | 'eraser' | 'line' | 'circle';
  color: string;
  width: number;
  path: PathCommand[];
  points: DrawingPoint[];
}

export interface DrawingFillActionData {
  type: 'fill';
  color: string;
  width: number;
  height: number;
  imageDataUrl: string;
}

export type DrawingBoardActionData = DrawingStrokeActionData | DrawingFillActionData;

export interface DrawingBoardBrushOptions {
  color: string;
  width: number;
}

export interface DrawingBoardOptions {
  width?: number;
  height?: number;
  backgroundColor?: string;
  brush?: Partial<DrawingBoardBrushOptions>;
  eraserWidth?: number;
  pointMergeDistance?: number;
  initialData?: DrawingBoardActionData[];
  onChange?: (data: DrawingBoardActionData[]) => void;
  onHistoryChange?: (history: { canUndo: boolean; canRedo: boolean }) => void;
}

type StrokeCreatedHandler = (action: DrawingStrokeActionData, object: FabricObject) => void;
type PointerEventPayload = { scenePoint: Point };
type ShapeDraft = { object: FabricObject; start: Point };
type DrawingBoardAction = { data: DrawingBoardActionData; object: FabricObject };
type ImageActionOptions = {
  color: string;
  width: number;
  height: number;
  imageDataUrl: string;
};

const DEFAULT_BOARD_SIZE = 400;
const DEFAULT_BRUSH_COLOR = '#000000';
const DEFAULT_BRUSH_WIDTH = 1;
const DEFAULT_ERASER_WIDTH = 5;
const DEFAULT_POINT_MERGE_DISTANCE = 2.5;
const DEFAULT_BACKGROUND_COLOR = '#ffffff';
const FILL_BOUNDARY_ALPHA = 16;
const FILL_BOUNDARY_PADDING = 8;
const MAX_FILL_AREA_RATIO = 0.82;
const FILL_START_SEARCH_RADIUS = 6;
const CLOSE_PATH_DISTANCE = 16;
const COORDINATE_PRECISION = 2;

class DrawingActionNormalizer {
  normalize<T extends DrawingBoardActionData>(data: T): T {
    if (data.type === 'fill') {
      return {
        ...data,
        width: this.round(data.width),
        height: this.round(data.height),
      } as T;
    }

    return {
      ...data,
      width: this.round(data.width),
      path: data.path.map(command => this.roundPathCommand(command)),
      points: data.tool === 'line' || data.tool === 'circle'
        ? data.points.map(point => ({
            x: this.round(point.x),
            y: this.round(point.y),
          }))
        : [],
    } as T;
  }

  private roundPathCommand(command: PathCommand): PathCommand {
    return command.map((value, index) => (index === 0 ? value : this.round(value as number))) as PathCommand;
  }

  private round(value: number): number {
    return Number(value.toFixed(COORDINATE_PRECISION));
  }
}

class DrawingPointSimplifier {
  constructor(private readonly minDistance: number) {}

  simplify(points: Point[]): Point[] {
    if (points.length <= 2) {
      return points;
    }

    const minDistanceSquared = this.minDistance * this.minDistance;
    const simplifiedPoints = [points[0]];
    let lastPoint = points[0];

    for (let index = 1; index < points.length - 1; index++) {
      const point = points[index];
      const distanceSquared = (point.x - lastPoint.x) ** 2 + (point.y - lastPoint.y) ** 2;

      if (distanceSquared >= minDistanceSquared) {
        simplifiedPoints.push(point);
        lastPoint = point;
      }
    }

    simplifiedPoints.push(points[points.length - 1]);
    return simplifiedPoints;
  }
}

class DrawingPathFactory {
  create(action: DrawingStrokeActionData): Path {
    return new Path(action.path, {
      fill: null,
      stroke: action.tool === 'eraser' ? '#000000' : action.color,
      strokeWidth: action.width,
      strokeLineCap: 'round',
      strokeLineJoin: 'round',
      selectable: false,
      evented: false,
      globalCompositeOperation: action.tool === 'eraser' ? 'destination-out' : 'source-over',
    });
  }
}

class DrawingBrush extends PencilBrush {
  private tool: 'pencil' | 'eraser' = 'pencil';
  private readonly pointSimplifier: DrawingPointSimplifier;
  private readonly onStrokeCreated: StrokeCreatedHandler;
  private readonly pathFactory: DrawingPathFactory;

  constructor(canvas: Canvas, options: {
    pointSimplifier: DrawingPointSimplifier;
    pathFactory: DrawingPathFactory;
    onStrokeCreated: StrokeCreatedHandler;
  }) {
    super(canvas);
    this.pointSimplifier = options.pointSimplifier;
    this.pathFactory = options.pathFactory;
    this.onStrokeCreated = options.onStrokeCreated;
    this.strokeLineCap = 'round';
    this.strokeLineJoin = 'round';
  }

  setTool(tool: 'pencil' | 'eraser'): void {
    this.tool = tool;
  }

  needsFullRender(): boolean {
    return this.tool === 'eraser' || super.needsFullRender();
  }

  _render(context: CanvasRenderingContext2D = this.canvas.contextTop): void {
    if (this.tool !== 'eraser') {
      super._render(context);
      return;
    }

    const mainContext = this.canvas.getContext();
    mainContext.save();
    mainContext.globalCompositeOperation = 'destination-out';
    super._render(mainContext);
    mainContext.restore();
  }

  _finalizeAndAddPath(): void {
    const context = this.canvas.contextTop;
    context.closePath();

    const points = this.pointSimplifier.simplify(this._points);
    const pathData = this.convertPointsToSVGPath(points) as PathCommand[];
    this.closePathDataWhenNeeded(points, pathData);

    if (this.isEmptyPath(pathData)) {
      this.canvas.clearContext(context);
      this.canvas.requestRenderAll();
      return;
    }

    const action: DrawingStrokeActionData = {
      type: 'stroke',
      tool: this.tool,
      color: this.color,
      width: this.width,
      path: pathData,
      points: points.map(point => ({ x: point.x, y: point.y })),
    };
    const path = this.pathFactory.create(action);

    this.canvas.clearContext(context);
    this.canvas.fire('before:path:created', { path });
    this.canvas.add(path);
    this.canvas.requestRenderAll();
    path.setCoords();
    this._resetShadow();
    this.canvas.fire('path:created', { path });
    this.onStrokeCreated(action, path);
  }

  private isEmptyPath(pathData: PathCommand[]): boolean {
    return pathData.length === 0 || pathData.every(command => command[0] === 'M');
  }

  private closePathDataWhenNeeded(points: Point[], pathData: PathCommand[]): void {
    if (points.length < 3 || pathData[pathData.length - 1]?.[0] === 'Z') {
      return;
    }

    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const closeDistance = Math.max(CLOSE_PATH_DISTANCE, this.width * 2);
    const distance = Math.hypot(firstPoint.x - lastPoint.x, firstPoint.y - lastPoint.y);

    if (distance <= closeDistance) {
      pathData.push(['Z']);
    }
  }
}

class FabricImageActionFactory {
  async create(options: ImageActionOptions): Promise<DrawingBoardAction> {
    const image = await FabricImage.fromURL(options.imageDataUrl);
    const imageWidth = image.width || options.width;
    const imageHeight = image.height || options.height;

    image.set({
      left: options.width / 2,
      top: options.height / 2,
      originX: 'center',
      originY: 'center',
      scaleX: options.width / imageWidth,
      scaleY: options.height / imageHeight,
      selectable: false,
      evented: false,
    });
    image.setCoords();

    return {
      object: image,
      data: {
        type: 'fill',
        color: options.color,
        width: options.width,
        height: options.height,
        imageDataUrl: options.imageDataUrl,
      },
    };
  }
}

class FloodFillService {
  async fill(
    canvas: Canvas,
    point: Point,
    color: string,
    actions: DrawingBoardActionData[],
    imageFactory: FabricImageActionFactory
  ): Promise<DrawingBoardAction | null> {
    const width = canvas.getWidth();
    const height = canvas.getHeight();
    const x = Math.floor(point.x);
    const y = Math.floor(point.y);

    if (x < 0 || x >= width || y < 0 || y >= height) {
      return null;
    }

    const boundaryImage = this.createBoundaryImage(width, height, actions);
    const fillColor = this.parseHexColor(color);
    const fillStart = this.findFillStart(boundaryImage.data, x, y, width, height);

    if (!fillColor || !fillStart) {
      return null;
    }

    const fillCanvas = document.createElement('canvas');
    fillCanvas.width = width;
    fillCanvas.height = height;
    const fillContext = fillCanvas.getContext('2d');

    if (!fillContext) {
      return null;
    }

    const fillImage = fillContext.createImageData(width, height);
    const visited = new Uint8Array(width * height);
    const queue: DrawingPoint[] = [fillStart];
    let pixelCount = 0;

    while (queue.length > 0) {
      const current = queue.pop();

      if (!current) {
        continue;
      }

      const index = current.y * width + current.x;

      if (visited[index]) {
        continue;
      }

      visited[index] = 1;

      if (this.isBoundary(boundaryImage.data, current.x, current.y, width)) {
        continue;
      }

      this.setPixel(fillImage.data, current.x, current.y, width, fillColor);
      pixelCount++;

      this.enqueueNeighbor(queue, current.x + 1, current.y, width, height);
      this.enqueueNeighbor(queue, current.x - 1, current.y, width, height);
      this.enqueueNeighbor(queue, current.x, current.y + 1, width, height);
      this.enqueueNeighbor(queue, current.x, current.y - 1, width, height);
    }

    if (pixelCount === 0 || pixelCount / (width * height) > MAX_FILL_AREA_RATIO) {
      return null;
    }

    fillContext.putImageData(fillImage, 0, 0);
    const imageDataUrl = fillCanvas.toDataURL('image/png');
    return imageFactory.create({ color, width, height, imageDataUrl });
  }

  private enqueueNeighbor(queue: DrawingPoint[], x: number, y: number, width: number, height: number): void {
    if (x >= 0 && x < width && y >= 0 && y < height) {
      queue.push({ x, y });
    }
  }

  private findFillStart(
    boundaryData: Uint8ClampedArray,
    x: number,
    y: number,
    width: number,
    height: number
  ): DrawingPoint | null {
    if (!this.isBoundary(boundaryData, x, y, width)) {
      return { x, y };
    }

    for (let radius = 1; radius <= FILL_START_SEARCH_RADIUS; radius++) {
      for (let offsetY = -radius; offsetY <= radius; offsetY++) {
        for (let offsetX = -radius; offsetX <= radius; offsetX++) {
          const currentX = x + offsetX;
          const currentY = y + offsetY;

          if (
            currentX >= 0 &&
            currentX < width &&
            currentY >= 0 &&
            currentY < height &&
            !this.isBoundary(boundaryData, currentX, currentY, width)
          ) {
            return { x: currentX, y: currentY };
          }
        }
      }
    }

    return null;
  }

  private createBoundaryImage(width: number, height: number, actions: DrawingBoardActionData[]): ImageData {
    const boundaryCanvas = document.createElement('canvas');
    boundaryCanvas.width = width;
    boundaryCanvas.height = height;
    const context = boundaryCanvas.getContext('2d');

    if (!context) {
      return new ImageData(width, height);
    }

    actions.forEach(action => {
      if (action.type !== 'stroke') {
        return;
      }

      context.save();
      context.globalCompositeOperation = action.tool === 'eraser' ? 'destination-out' : 'source-over';
      context.strokeStyle = '#000000';
      context.lineWidth = Math.max(action.width + FILL_BOUNDARY_PADDING, 6);
      context.lineCap = 'round';
      context.lineJoin = 'round';
      this.drawPath(context, action.path);
      context.stroke();
      context.restore();
    });

    return context.getImageData(0, 0, width, height);
  }

  private drawPath(context: CanvasRenderingContext2D, path: PathCommand[]): void {
    context.beginPath();
    path.forEach(command => {
      switch (command[0]) {
        case 'M':
          context.moveTo(command[1], command[2]);
          break;
        case 'L':
          context.lineTo(command[1], command[2]);
          break;
        case 'Q':
          context.quadraticCurveTo(command[1], command[2], command[3], command[4]);
          break;
        case 'C':
          context.bezierCurveTo(command[1], command[2], command[3], command[4], command[5], command[6]);
          break;
        case 'Z':
          context.closePath();
          break;
      }
    });
  }

  private parseHexColor(color: string): [number, number, number, number] | null {
    const hex = color.replace('#', '');

    if (!/^[\da-f]{6}$/i.test(hex)) {
      return null;
    }

    return [
      Number.parseInt(hex.slice(0, 2), 16),
      Number.parseInt(hex.slice(2, 4), 16),
      Number.parseInt(hex.slice(4, 6), 16),
      255,
    ];
  }

  private isBoundary(data: Uint8ClampedArray, x: number, y: number, width: number): boolean {
    const index = (y * width + x) * 4;
    return data[index + 3] > FILL_BOUNDARY_ALPHA;
  }

  private setPixel(
    data: Uint8ClampedArray,
    x: number,
    y: number,
    width: number,
    color: [number, number, number, number]
  ): void {
    const index = (y * width + x) * 4;
    data[index] = color[0];
    data[index + 1] = color[1];
    data[index + 2] = color[2];
    data[index + 3] = color[3];
  }

}

export class FabricDrawingBoard {
  private readonly canvas: Canvas;
  private readonly brush: DrawingBrush;
  private readonly pathFactory = new DrawingPathFactory();
  private readonly imageFactory = new FabricImageActionFactory();
  private readonly fillService = new FloodFillService();
  private readonly actionNormalizer = new DrawingActionNormalizer();
  private readonly baseActions: DrawingBoardAction[] = [];
  private readonly actions: DrawingBoardAction[] = [];
  private readonly redoStack: DrawingBoardAction[] = [];
  private readonly backgroundColor: string;
  private readonly onChange?: (data: DrawingBoardActionData[]) => void;
  private readonly onHistoryChange?: (history: { canUndo: boolean; canRedo: boolean }) => void;
  private tool: DrawingTool = 'pencil';
  private brushOptions: DrawingBoardBrushOptions;
  private eraserWidth: number;
  private shapeDraft: ShapeDraft | null = null;

  constructor(canvasElement: HTMLCanvasElement | string, options: DrawingBoardOptions = {}) {
    this.backgroundColor = options.backgroundColor ?? DEFAULT_BACKGROUND_COLOR;
    this.onChange = options.onChange;
    this.onHistoryChange = options.onHistoryChange;
    this.brushOptions = {
      color: options.brush?.color ?? DEFAULT_BRUSH_COLOR,
      width: options.brush?.width ?? DEFAULT_BRUSH_WIDTH,
    };
    this.eraserWidth = options.eraserWidth ?? DEFAULT_ERASER_WIDTH;

    this.canvas = new Canvas(canvasElement, {
      width: options.width ?? DEFAULT_BOARD_SIZE,
      height: options.height ?? DEFAULT_BOARD_SIZE,
      backgroundColor: this.backgroundColor,
      isDrawingMode: true,
      selection: false,
      allowTouchScrolling: false,
    });

    this.brush = new DrawingBrush(this.canvas, {
      pointSimplifier: new DrawingPointSimplifier(options.pointMergeDistance ?? DEFAULT_POINT_MERGE_DISTANCE),
      pathFactory: this.pathFactory,
      onStrokeCreated: (data, object) => this.commitAction({ data, object }),
    });
    this.canvas.freeDrawingBrush = this.brush;
    this.disableBrowserTouchGestures();
    this.bindCanvasEvents();
    this.applyCurrentTool();
    this.emitChanges();

    if (options.initialData) {
      void this.loadPathData(options.initialData);
    }
  }

  static mount(container: HTMLElement, options?: DrawingBoardOptions): FabricDrawingBoard {
    const canvasElement = document.createElement('canvas');
    container.appendChild(canvasElement);
    return new FabricDrawingBoard(canvasElement, options);
  }

  setTool(tool: DrawingTool): void {
    this.tool = tool;
    this.applyCurrentTool();
  }

  setBrushColor(color: string): void {
    this.brushOptions = { ...this.brushOptions, color };
    this.applyCurrentTool();
  }

  setBrushWidth(width: number): void {
    this.brushOptions = { ...this.brushOptions, width };
    this.applyCurrentTool();
  }

  setEraserWidth(width: number): void {
    this.eraserWidth = width;
    this.applyCurrentTool();
  }

  useBrush(): void {
    this.setTool('pencil');
  }

  useEraser(): void {
    this.setTool('eraser');
  }

  canUndo(): boolean {
    return this.actions.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): void {
    const action = this.actions.pop();

    if (!action) {
      return;
    }

    this.canvas.remove(action.object);
    this.redoStack.push(action);
    this.canvas.requestRenderAll();
    this.emitChanges();
  }

  redo(): void {
    const action = this.redoStack.pop();

    if (!action) {
      return;
    }

    this.canvas.add(action.object);
    this.actions.push(action);
    this.canvas.requestRenderAll();
    this.emitChanges();
  }

  getPathData(): DrawingBoardActionData[] {
    return [...this.baseActions, ...this.actions].map(action => this.cloneActionData(action.data));
  }

  getExportPathData(): DrawingBoardActionData[] {
    const pathData = this.getPathData();
    const hasEraser = pathData.some(action => action.type === 'stroke' && action.tool === 'eraser');

    if (!hasEraser) {
      return pathData;
    }

    return [this.createSnapshotActionData()];
  }

  async loadPathData(actions: DrawingBoardActionData[]): Promise<void> {
    this.clear();

    const restoredActions = await Promise.all(actions.map(action => this.createActionFromData(action)));
    restoredActions.forEach(action => {
      if (action) {
        this.canvas.add(action.object);
        this.baseActions.push(action);
      }
    });

    this.actions.length = 0;
    this.redoStack.length = 0;
    this.applyCurrentTool();
    this.canvas.requestRenderAll();
    this.emitChanges();
  }

  clear(): void {
    this.canvas.clear();
    this.canvas.backgroundColor = this.backgroundColor;
    this.baseActions.length = 0;
    this.actions.length = 0;
    this.redoStack.length = 0;
    this.shapeDraft = null;
    this.canvas.requestRenderAll();
    this.emitChanges();
  }

  getCanvas(): Canvas {
    return this.canvas;
  }

  destroy(): Promise<boolean> {
    return this.canvas.dispose();
  }

  private bindCanvasEvents(): void {
    this.canvas.on('mouse:down', event => this.handlePointerDown(event));
    this.canvas.on('mouse:move', event => this.handlePointerMove(event));
    this.canvas.on('mouse:up', () => this.handlePointerUp());
  }

  private handlePointerDown(event: PointerEventPayload): void {
    if (this.tool === 'fill') {
      this.fillClosedArea(event.scenePoint);
      return;
    }

    if (this.tool === 'line' || this.tool === 'circle') {
      this.startShape(event.scenePoint);
    }
  }

  private handlePointerMove(event: PointerEventPayload): void {
    if (!this.shapeDraft) {
      return;
    }

    if (this.tool === 'line') {
      this.updateLineDraft(this.shapeDraft.object as Line, event.scenePoint);
    }

    if (this.tool === 'circle') {
      this.updateCircleDraft(this.shapeDraft.object as Circle, this.shapeDraft.start, event.scenePoint);
    }

    this.canvas.requestRenderAll();
  }

  private handlePointerUp(): void {
    if (!this.shapeDraft) {
      return;
    }

    const object = this.shapeDraft.object;
    const data = this.createShapeActionData(object, this.tool);
    this.shapeDraft = null;

    if (!data) {
      this.canvas.remove(object);
      this.canvas.requestRenderAll();
      return;
    }

    this.commitAction({ data, object });
  }

  private startShape(pointer: Point): void {
    const object = this.tool === 'line' ? this.createLineDraft(pointer) : this.createCircleDraft(pointer);
    this.shapeDraft = { object, start: pointer };
    this.canvas.add(object);
  }

  private createLineDraft(pointer: Point): Line {
    return new Line([pointer.x, pointer.y, pointer.x, pointer.y], {
      stroke: this.brushOptions.color,
      strokeWidth: this.brushOptions.width,
      strokeLineCap: 'round',
      selectable: false,
      evented: false,
    });
  }

  private createCircleDraft(pointer: Point): Circle {
    return new Circle({
      left: pointer.x,
      top: pointer.y,
      radius: 0,
      fill: null,
      stroke: this.brushOptions.color,
      strokeWidth: this.brushOptions.width,
      selectable: false,
      evented: false,
    });
  }

  private updateLineDraft(line: Line, pointer: Point): void {
    line.set({ x2: pointer.x, y2: pointer.y });
  }

  private updateCircleDraft(circle: Circle, start: Point, pointer: Point): void {
    const radius = Math.hypot(pointer.x - start.x, pointer.y - start.y) / 2;
    circle.set({
      left: Math.min(start.x, pointer.x),
      top: Math.min(start.y, pointer.y),
      radius,
    });
  }

  private createShapeActionData(object: FabricObject, tool: DrawingTool): DrawingStrokeActionData | null {
    if (tool === 'line' && object instanceof Line) {
      const points = [
        { x: object.x1 ?? 0, y: object.y1 ?? 0 },
        { x: object.x2 ?? 0, y: object.y2 ?? 0 },
      ];

      if (points[0].x === points[1].x && points[0].y === points[1].y) {
        return null;
      }

      return {
        type: 'stroke',
        tool: 'line',
        color: this.brushOptions.color,
        width: this.brushOptions.width,
        path: [['M', points[0].x, points[0].y], ['L', points[1].x, points[1].y]],
        points,
      };
    }

    if (tool === 'circle' && object instanceof Circle) {
      const radius = object.radius ?? 0;

      if (radius <= 0) {
        return null;
      }

      const centerX = (object.left ?? 0) + radius;
      const centerY = (object.top ?? 0) + radius;
      const path = this.createCirclePathData(centerX, centerY, radius);

      return {
        type: 'stroke',
        tool: 'circle',
        color: this.brushOptions.color,
        width: this.brushOptions.width,
        path,
        points: [
          { x: centerX - radius, y: centerY - radius },
          { x: centerX + radius, y: centerY + radius },
        ],
      };
    }

    return null;
  }

  private createCirclePathData(centerX: number, centerY: number, radius: number): PathCommand[] {
    const control = radius * 0.5522847498;

    return [
      ['M', centerX, centerY - radius],
      ['C', centerX + control, centerY - radius, centerX + radius, centerY - control, centerX + radius, centerY],
      ['C', centerX + radius, centerY + control, centerX + control, centerY + radius, centerX, centerY + radius],
      ['C', centerX - control, centerY + radius, centerX - radius, centerY + control, centerX - radius, centerY],
      ['C', centerX - radius, centerY - control, centerX - control, centerY - radius, centerX, centerY - radius],
      ['Z'],
    ];
  }

  private async fillClosedArea(pointer: Point): Promise<void> {
    const action = await this.fillService.fill(
      this.canvas,
      pointer,
      this.brushOptions.color,
      this.getPathData(),
      this.imageFactory
    );

    if (!action) {
      return;
    }

    this.canvas.add(action.object);
    this.commitAction(action);
  }

  private commitAction(action: DrawingBoardAction): void {
    this.actions.push({
      data: this.actionNormalizer.normalize(action.data),
      object: action.object,
    });
    this.redoStack.length = 0;
    this.canvas.requestRenderAll();
    this.emitChanges();
  }

  private async createActionFromData(data: DrawingBoardActionData): Promise<DrawingBoardAction | null> {
    const normalizedData = this.actionNormalizer.normalize(data);

    if (normalizedData.type === 'stroke') {
      return { data: this.cloneActionData(normalizedData), object: this.createStrokeObject(normalizedData) };
    }

    return this.imageFactory.create(normalizedData);
  }

  private createSnapshotActionData(): DrawingFillActionData {
    this.canvas.renderAll();

    return {
      type: 'fill',
      color: 'snapshot',
      width: this.canvas.getWidth(),
      height: this.canvas.getHeight(),
      imageDataUrl: this.canvas.toDataURL({
        format: 'png',
        multiplier: 1,
        enableRetinaScaling: false,
      }),
    };
  }

  private createStrokeObject(data: DrawingStrokeActionData): FabricObject {
    if (data.tool === 'circle' && data.points.length >= 2) {
      const [startPoint, endPoint] = data.points;
      const left = Math.min(startPoint.x, endPoint.x);
      const top = Math.min(startPoint.y, endPoint.y);
      const radius = Math.abs(endPoint.x - startPoint.x) / 2;

      if (radius > 0) {
        return new Circle({
          left,
          top,
          radius,
          fill: null,
          stroke: data.color,
          strokeWidth: data.width,
          selectable: false,
          evented: false,
        });
      }
    }

    if (data.tool === 'line' && data.points.length >= 2) {
      const [startPoint, endPoint] = data.points;
      return new Line([startPoint.x, startPoint.y, endPoint.x, endPoint.y], {
        stroke: data.color,
        strokeWidth: data.width,
        strokeLineCap: 'round',
        selectable: false,
        evented: false,
      });
    }

    return this.pathFactory.create(data);
  }

  private cloneActionData<T extends DrawingBoardActionData>(data: T): T {
    if (data.type === 'fill') {
      return { ...data };
    }

    return {
      ...data,
      path: data.path.map(command => [...command]) as PathCommand[],
      points: data.points.map(point => ({ ...point })),
    } as T;
  }

  private emitChanges(): void {
    this.onChange?.(this.getPathData());
    this.onHistoryChange?.({ canUndo: this.canUndo(), canRedo: this.canRedo() });
  }

  private applyCurrentTool(): void {
    this.canvas.isDrawingMode = this.tool === 'pencil' || this.tool === 'eraser';
    this.brush.setTool(this.tool === 'eraser' ? 'eraser' : 'pencil');
    this.brush.color = this.tool === 'eraser' ? this.backgroundColor : this.brushOptions.color;
    this.brush.width = this.tool === 'eraser' ? this.eraserWidth : this.brushOptions.width;
    this.canvas.defaultCursor = 'crosshair';
    this.canvas.hoverCursor = 'crosshair';
  }

  private disableBrowserTouchGestures(): void {
    this.canvas.lowerCanvasEl.style.touchAction = 'none';
    this.canvas.upperCanvasEl.style.touchAction = 'none';
    this.canvas.wrapperEl.style.touchAction = 'none';
  }
}
