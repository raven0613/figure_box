import { FabricText, Line, Rect } from 'fabric';
import { BaseWidget } from './base';
import { canvasService } from '~/services/canvasCtxService';
import { canvasSize } from '~/constants/canvas';

const STROKE_STYLE = 'rgba(256,256,256,.2)';

export class DrawHelper extends BaseWidget {
  constructor() {
    const shape = new Rect({
      top: 0,
      left: 0,
      width: canvasSize.WIDTH,
      height: canvasSize.HEIGHT,
      fill: 'transparent',
      selectable: false,
    });

    super({ x: 0, y: 0 }, shape);
  }

  draw(): this {
    const canvas = canvasService.getCanvasContext();
    canvas?.add(this.shape);
    canvas?.sendToBack(this.shape);

    if (import.meta.env.VITE_CANVAS_LINE_HELPER === 'enable') {
      this.addLine();
    }

    if (import.meta.env.VITE_CANVAS_POSITION_HELPER === 'enable') {
      this.addCurrentPoint();
    }

    return this;
  }

  private addLine(): void {
    const canvas = canvasService.getCanvasContext();
    for (let index = 1; index < canvasSize.WIDTH / 50; index++) {
      const verticalLine = new Line([index * 50, 0, index * 50, canvasSize.WIDTH], {
        stroke: STROKE_STYLE,
        strokeWidth: 1,
      });

      const textX = new FabricText(`${index * 50}`, {
        fill: 'white',
        fontSize: 12,
        top: 2,
        left: index * 50,
      });

      const horizontalLine = new Line([0, index * 50, canvasSize.WIDTH, index * 50], {
        stroke: STROKE_STYLE,
        strokeWidth: 1,
      });

      const textY = new FabricText(`${index * 50}`, {
        fill: 'white',
        fontSize: 12,
        top: index * 50,
        left: 2,
      });

      canvas!.add(verticalLine, textX, horizontalLine, textY);
    }
  }

  private addCurrentPoint(): void {
    const canvas = canvasService.getCanvasContext();
    let previousCurrentPoint: FabricText;

    canvas!.on('mouse:move', target => {
      target.e.stopPropagation();

      const currentX = target.e.offsetX;
      const currentY = target.e.offsetY;
      const positionX = currentX > canvasSize.WIDTH / 2 ? -60 : 10;

      if (previousCurrentPoint) {
        previousCurrentPoint.set({ text: `(${currentX}, ${currentY})`, left: currentX + positionX, top: currentY });
        canvas?.renderAll();
      } else {
        previousCurrentPoint = new FabricText(`(${currentX}, ${currentY})`, {
          fill: 'white',
          fontSize: 12,
          left: currentX + positionX,
          top: currentY,
        });

        canvas?.add(previousCurrentPoint);
      }
    });
  }
}
