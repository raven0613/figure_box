import { StaticCanvas } from 'fabric';

import type { AvatarState } from '../avatarCanvas';
import { createMiniLayerImage } from './miniAvatarAssets';
import { createMiniFrontIdleLayers } from './miniAvatarLayerRenderer';
import {
  MINI_CANVAS_HEIGHT,
  MINI_CANVAS_WIDTH,
} from './miniAvatarRig';
import type { MiniLayer, MiniSpriteSheet } from './miniAvatarTypes';

export async function bakeMiniFrontIdleSpriteSheet(state: AvatarState): Promise<MiniSpriteSheet> {
  const layers = await createMiniFrontIdleLayers(state);
  const dataUrl = await renderMiniLayersToDataUrl(layers);

  return {
    dataUrl,
    frameWidth: MINI_CANVAS_WIDTH,
    frameHeight: MINI_CANVAS_HEIGHT,
    columns: 1,
    rows: 1,
    frameCount: 1,
  };
}

async function renderMiniLayersToDataUrl(layers: MiniLayer[]): Promise<string> {
  const exportCanvas = new StaticCanvas(undefined, {
    width: MINI_CANVAS_WIDTH,
    height: MINI_CANVAS_HEIGHT,
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
