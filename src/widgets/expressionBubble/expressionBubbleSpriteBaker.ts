import { StaticCanvas } from 'fabric';
import {
  getExpressionBubbleAnimationFrameCount,
  getExpressionBubbleAnimationFrameDurationMs,
  sampleExpressionBubbleAnimation,
} from './expressionBubbleAnimation';
import { createExpressionBubbleLayerImages } from './expressionBubbleAssets';
import { createExpressionBubbleLayers } from './expressionBubbleLayerRenderer';
import {
  EXPRESSION_BUBBLE_CANVAS_HEIGHT,
  EXPRESSION_BUBBLE_CANVAS_WIDTH,
} from './expressionBubbleRig';
import type {
  ExpressionBubbleAnimation,
  ExpressionBubbleLayer,
  ExpressionBubbleSpriteSheet,
} from './expressionBubbleTypes';

export async function bakeExpressionBubbleSpriteSheet(
  animation: ExpressionBubbleAnimation,
): Promise<ExpressionBubbleSpriteSheet> {
  const frameCount = getExpressionBubbleAnimationFrameCount(animation);
  const columns = Math.min(animation.columns, frameCount);
  const rows = Math.ceil(frameCount / columns);
  const sheetWidth = columns * EXPRESSION_BUBBLE_CANVAS_WIDTH;
  const sheetHeight = rows * EXPRESSION_BUBBLE_CANVAS_HEIGHT;
  const frameDurationMs = getExpressionBubbleAnimationFrameDurationMs(animation);
  const frameLayers = Array.from({ length: frameCount }, (_, frameIndex) => {
    const pose = sampleExpressionBubbleAnimation(animation, frameIndex * frameDurationMs);
    const layers = createExpressionBubbleLayers(animation.bubbleId, pose);
    const column = frameIndex % columns;
    const row = Math.floor(frameIndex / columns);

    return layers.map(layer => ({
      ...layer,
      x: layer.x + column * EXPRESSION_BUBBLE_CANVAS_WIDTH,
      y: layer.y + row * EXPRESSION_BUBBLE_CANVAS_HEIGHT,
    }));
  });
  const dataUrl = await renderExpressionBubbleLayersToDataUrl(
    frameLayers.flat(),
    sheetWidth,
    sheetHeight,
  );

  return {
    dataUrl,
    frameWidth: EXPRESSION_BUBBLE_CANVAS_WIDTH,
    frameHeight: EXPRESSION_BUBBLE_CANVAS_HEIGHT,
    sheetWidth,
    sheetHeight,
    columns,
    rows,
    frameCount,
  };
}

async function renderExpressionBubbleLayersToDataUrl(
  layers: ExpressionBubbleLayer[],
  width: number,
  height: number,
): Promise<string> {
  const exportCanvas = new StaticCanvas(undefined, {
    width,
    height,
    imageSmoothingEnabled: false,
    renderOnAddRemove: false,
  });
  const images = await createExpressionBubbleLayerImages(
    [...layers].sort((first, second) => first.zIndex - second.zIndex),
  );

  exportCanvas.add(...images);
  exportCanvas.renderAll();
  const dataUrl = exportCanvas.toDataURL({
    format: 'png',
    enableRetinaScaling: false,
    multiplier: 1,
  });
  void exportCanvas.dispose();
  return dataUrl;
}
