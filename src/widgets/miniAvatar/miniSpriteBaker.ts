import { StaticCanvas } from 'fabric';

import type { AvatarState } from '../avatarCanvas';
import {
  getMiniAnimationFrameCount,
  getMiniAnimationFrameDurationMs,
  sampleMiniAnimation,
} from './miniAvatarAnimation';
import { MINI_WAVE_BLINK_ANIMATION } from './miniAvatarAnimationDefinitions';
import { createMiniLayerImage } from './miniAvatarAssets';
import { createMiniFrontIdleLayers } from './miniAvatarLayerRenderer';
import {
  MINI_CANVAS_HEIGHT,
  MINI_CANVAS_WIDTH,
} from './miniAvatarRig';
import type { MiniAnimation, MiniLayer, MiniSpriteSheet } from './miniAvatarTypes';

export async function bakeMiniFrontIdleSpriteSheet(state: AvatarState): Promise<MiniSpriteSheet> {
  const layers = await createMiniFrontIdleLayers(state);
  const dataUrl = await renderMiniLayersToDataUrl(layers);

  return {
    dataUrl,
    frameWidth: MINI_CANVAS_WIDTH,
    frameHeight: MINI_CANVAS_HEIGHT,
    sheetWidth: MINI_CANVAS_WIDTH,
    sheetHeight: MINI_CANVAS_HEIGHT,
    columns: 1,
    rows: 1,
    frameCount: 1,
  };
}

export async function bakeMiniAnimationSpriteSheet(
  state: AvatarState,
  animation: MiniAnimation = MINI_WAVE_BLINK_ANIMATION,
): Promise<MiniSpriteSheet> {
  const frameCount = getMiniAnimationFrameCount(animation);
  const columns = Math.min(animation.columns, frameCount);
  const rows = Math.ceil(frameCount / columns);
  const sheetWidth = columns * MINI_CANVAS_WIDTH;
  const sheetHeight = rows * MINI_CANVAS_HEIGHT;
  const frameDurationMs = getMiniAnimationFrameDurationMs(animation);
  const frameLayers = await Promise.all(
    Array.from({ length: frameCount }, async (_, frameIndex) => {
      const pose = sampleMiniAnimation(animation, frameIndex * frameDurationMs);
      const layers = await createMiniFrontIdleLayers(state, pose);
      const column = frameIndex % columns;
      const row = Math.floor(frameIndex / columns);

      return layers.map(layer => ({
        ...layer,
        x: layer.x + column * MINI_CANVAS_WIDTH,
        y: layer.y + row * MINI_CANVAS_HEIGHT,
      }));
    }),
  );
  const dataUrl = await renderMiniLayersToDataUrl(frameLayers.flat(), sheetWidth, sheetHeight);

  return {
    dataUrl,
    frameWidth: MINI_CANVAS_WIDTH,
    frameHeight: MINI_CANVAS_HEIGHT,
    sheetWidth,
    sheetHeight,
    columns,
    rows,
    frameCount,
  };
}

async function renderMiniLayersToDataUrl(
  layers: MiniLayer[],
  width = MINI_CANVAS_WIDTH,
  height = MINI_CANVAS_HEIGHT,
): Promise<string> {
  const exportCanvas = new StaticCanvas(undefined, {
    width,
    height,
    imageSmoothingEnabled: false,
    renderOnAddRemove: false,
  });
  const images = await Promise.all(
    layers
      .sort((first, second) => first.zIndex - second.zIndex)
      .map(layer => createMiniLayerImage(layer)),
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
