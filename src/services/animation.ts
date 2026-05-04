import { FabricObject } from 'fabric';
import { CanvasTag, canvasService } from '~/services/canvasCtxService';

export class Animation {
  static async easeInOut(
    shape: FabricObject,
    direction: { top?: number | string; left?: number | string },
    { duration, shouldRerender = true }: { duration: number; shouldRerender?: boolean },
    canvasTag?: CanvasTag
  ) {
    return new Promise<void>(resolve => {
      const canvas = canvasService.getCanvasContext(canvasTag)!;
      const easeInOutProperties = {
        top: shape.top!,
        left: shape.left!,
        ...direction,
      };

      shape.animate(easeInOutProperties, {
        onChange: shouldRerender ? canvas.renderAll.bind(canvas) : canvas.requestRenderAll.bind(canvas),
        duration: duration,
        onComplete: () => {
          resolve();
        },
      });
    });
  }

  static async fadeInOut(
    shape: FabricObject,
    {
      startValue,
      endValue,
      duration,
      shouldRerender = true,
    }: { startValue: number; endValue: number; duration: number; shouldRerender?: boolean },
    canvasTag?: CanvasTag
  ) {
    return new Promise<void>(resolve => {
      const canvas = canvasService.getCanvasContext(canvasTag)!;
      shape.animate('opacity', endValue, {
        from: startValue,
        onChange: shouldRerender ? canvas.renderAll.bind(canvas) : canvas.requestRenderAll.bind(canvas),
        duration: duration,
        onComplete: () => {
          resolve();
        },
      });
    });
  }

  static async zoomInOut(
    shape: FabricObject,
    {
      startValue,
      scale,
      duration,
      shouldRerender = true,
    }: { startValue: number; scale: number; duration: number; shouldRerender?: boolean },
    canvasTag?: CanvasTag
  ) {
    return new Promise<void>(resolve => {
      const canvas = canvasService.getCanvasContext(canvasTag)!;
      shape.animate(
        { scaleX: scale, scaleY: scale },
        {
          from: startValue,
          onChange: shouldRerender ? canvas.renderAll.bind(canvas) : canvas.requestRenderAll.bind(canvas),
          duration: duration,
          onComplete: () => {
            resolve();
          },
        }
      );
    });
  }
}
