import { FabricImage } from 'fabric';

import {
  MINI_BASE_TINT_LUMINANCE,
  MINI_CANVAS_HEIGHT,
  MINI_CANVAS_WIDTH,
  MINI_PIXEL_SCALE,
} from './miniAvatarRig';
import type { AvatarColorGradient, AvatarGradientCoordinateSpace, AvatarTintSource } from '../avatarCanvas';
import type { MiniImageContentBounds, MiniLayer } from './miniAvatarTypes';

interface MiniImagePixelBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface MiniCompositeImageLayer {
  image: HTMLImageElement;
  layer: MiniLayer;
}

const MINI_GRADIENT_EDGE_COLOR_STOP = 0.05;
const MINI_TRANSFORM_EPSILON = 0.0001;
const MINI_TRANSFORM_SUPERSAMPLE = 2;
const MINI_SHARED_HAIR_GRADIENT_BOUNDS: MiniImagePixelBounds = {
  left: -90,
  right: MINI_CANVAS_WIDTH - 90,
  top: -60,
  bottom: MINI_CANVAS_HEIGHT - 60,
}; // 共用漸層：寬高跟胸像的漸層差不多
const miniTintCache = new Map<string, string>();
const miniContentBoundsCache = new Map<string, Promise<MiniImageContentBounds>>();
const miniCompositeLayerCache = new Map<string, Promise<string>>();

const miniAvatarAssetUrls = import.meta.glob<string>('../../assets/avatar_system/mini/**/*.png', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

export async function createMiniLayerImage(layer: MiniLayer): Promise<FabricImage> {
  if (isMiniCompositeLayer(layer)) {
    return createMiniCompositeLayerImage(layer.compositeLayers, layer);
  }

  const assetUrl = getMiniAvatarAssetUrl(layer.folder, layer.file);
  const imageUrl = layer.color
    ? await tintMiniImageByLuminance(assetUrl, layer.color, {
      anchorPoint: layer.colorAnchor ?? { x: layer.x, y: layer.y },
      coordinateSpace: layer.colorGradientSpace ?? 'local',
      pixelScale: MINI_PIXEL_SCALE * (layer.scale ?? 1),
    })
    : assetUrl;
  const image = await FabricImage.fromURL(imageUrl);
  image.set({
    left: layer.x,
    top: layer.y,
    angle: layer.angle ?? 0,
    flipX: layer.flipX === true,
    scaleX: MINI_PIXEL_SCALE * (layer.scale ?? 1),
    scaleY: MINI_PIXEL_SCALE * (layer.scale ?? 1),
    originX: 'center',
    originY: 'center',
    selectable: false,
    evented: false,
    objectCaching: false,
    imageSmoothing: false,
  });
  return image;
}

export async function createMiniLayerImages(sortedLayers: MiniLayer[]): Promise<FabricImage[]> {
  const layerGroups = groupPrecomposableMiniLayers(sortedLayers);

  return Promise.all(layerGroups.map(layerGroup => (
    shouldPrecomposeMiniLayer(layerGroup[0])
      ? createMiniCompositeLayerImage(createLocalCompositeLayers(layerGroup[0], layerGroup), layerGroup[0])
      : createMiniLayerImage(layerGroup[0])
  )));
}

export function hasMiniAvatarAsset(folder: string, file: string): boolean {
  return miniAvatarAssetUrls[getMiniAvatarAssetPath(folder, file)] !== undefined;
}

export function getMiniAvatarAssetUrl(folder: string, file: string): string {
  const assetPath = getMiniAvatarAssetPath(folder, file);
  const url = miniAvatarAssetUrls[assetPath];

  if (!url) {
    throw new Error(`Mini avatar asset not found: ${assetPath}`);
  }

  return url;
}

export async function getCombinedMiniContentBounds(
  folder: string,
  files: string[],
): Promise<MiniImageContentBounds> {
  const bounds = await Promise.all(
    files
      .filter(file => hasMiniAvatarAsset(folder, file))
      .map(file => getMiniImageContentBounds(folder, file)),
  );

  if (bounds.length === 0) {
    return { width: 0, height: 0, top: 0, bottom: 0 };
  }

  return bounds.reduce((combinedBounds, currentBounds) => ({
    width: Math.max(combinedBounds.width, currentBounds.width),
    height: Math.max(combinedBounds.height, currentBounds.height),
    top: Math.min(combinedBounds.top, currentBounds.top),
    bottom: Math.max(combinedBounds.bottom, currentBounds.bottom),
  }));
}

export function getFirstAvailableMiniOptionId(folder: string): string | null {
  const optionIds = Object.keys(miniAvatarAssetUrls)
    .map(assetPath => assetPath.match(new RegExp(`^\\.\\./\\.\\./assets/avatar_system/mini/${folder}/(\\d+)(?:_(?:color|line))?\\.png$`)))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map(match => match[1])
    .sort();

  return optionIds[0] ?? null;
}

export function resolveMiniDirectoryOptionId(folder: string, requestedOptionId: number): string | null {
  const requestedId = formatMiniOptionId(requestedOptionId);

  if (hasMiniDirectoryOption(folder, requestedId)) {
    return requestedId;
  }

  return getFirstAvailableMiniDirectoryOptionId(folder);
}

export function formatMiniOptionId(optionId: number): string {
  return String(optionId).padStart(2, '0');
}

export function getMiniBoundsBottomOffset(bounds: MiniImageContentBounds): number {
  return (bounds.bottom + 1 - bounds.height / 2) * MINI_PIXEL_SCALE;
}

function getMiniAvatarAssetPath(folder: string, file: string): string {
  return `../../assets/avatar_system/mini/${folder}/${file}`;
}

function groupPrecomposableMiniLayers(layers: MiniLayer[]): MiniLayer[][] {
  const layerGroups: MiniLayer[][] = [];
  let currentGroup: MiniLayer[] = [];
  let currentTransformKey: string | null = null;

  for (const layer of layers) {
    const transformKey = shouldPrecomposeMiniLayer(layer)
      ? getMiniLayerTransformKey(layer)
      : null;

    if (transformKey === null || transformKey !== currentTransformKey) {
      flushMiniLayerGroup(layerGroups, currentGroup);
      currentGroup = [layer];
      currentTransformKey = transformKey;
      continue;
    }

    currentGroup = [...currentGroup, layer];
  }

  flushMiniLayerGroup(layerGroups, currentGroup);
  return layerGroups;
}

function flushMiniLayerGroup(layerGroups: MiniLayer[][], layerGroup: MiniLayer[]): void {
  if (layerGroup.length === 0) {
    return;
  }

  layerGroups.push(layerGroup);
}

function shouldPrecomposeMiniLayer(layer: MiniLayer): boolean {
  return !isMiniCompositeLayer(layer)
    && (Math.abs(layer.angle ?? 0) > MINI_TRANSFORM_EPSILON
      || Math.abs((layer.scale ?? 1) - 1) > MINI_TRANSFORM_EPSILON);
}

function getMiniLayerTransformKey(layer: MiniLayer): string {
  return [
    roundMiniTransformValue(layer.angle ?? 0),
    roundMiniTransformValue(layer.scale ?? 1),
    layer.flipX === true ? '1' : '0',
  ].join('|');
}

function roundMiniTransformValue(value: number): string {
  return value.toFixed(4);
}

async function createMiniCompositeLayerImage(layers: MiniLayer[], transformLayer: MiniLayer): Promise<FabricImage> {
  const imageUrl = await getMiniCompositeLayerUrl(layers);
  const image = await FabricImage.fromURL(imageUrl);

  image.set({
    left: transformLayer.x,
    top: transformLayer.y,
    angle: transformLayer.angle ?? 0,
    flipX: transformLayer.flipX === true,
    scaleX: MINI_PIXEL_SCALE * (transformLayer.scale ?? 1) / MINI_TRANSFORM_SUPERSAMPLE,
    scaleY: MINI_PIXEL_SCALE * (transformLayer.scale ?? 1) / MINI_TRANSFORM_SUPERSAMPLE,
    originX: 'center',
    originY: 'center',
    selectable: false,
    evented: false,
    objectCaching: false,
    imageSmoothing: true,
  });

  return image;
}

function getMiniCompositeLayerUrl(layers: MiniLayer[]): Promise<string> {
  const cacheKey = getMiniCompositeLayerCacheKey(layers);
  const cachedCompositeUrl = miniCompositeLayerCache.get(cacheKey);

  if (cachedCompositeUrl) {
    return cachedCompositeUrl;
  }

  const compositeUrlPromise = renderMiniCompositeLayerUrl(layers);
  miniCompositeLayerCache.set(cacheKey, compositeUrlPromise);
  return compositeUrlPromise;
}

function getMiniCompositeLayerCacheKey(layers: MiniLayer[]): string {
  return [
    `supersample:${MINI_TRANSFORM_SUPERSAMPLE}`,
    ...layers.map(layer => [
      layer.folder,
      layer.file,
      roundMiniTransformValue(layer.x),
      roundMiniTransformValue(layer.y),
      roundMiniTransformValue(layer.angle ?? 0),
      roundMiniTransformValue(layer.scale ?? 1),
      layer.flipX === true ? '1' : '0',
      roundMiniTransformValue(layer.zIndex),
      serializeMiniTintSource(layer.color),
      layer.colorGradientSpace ?? 'local',
      layer.colorAnchor ? `${roundMiniTransformValue(layer.colorAnchor.x)},${roundMiniTransformValue(layer.colorAnchor.y)}` : '',
    ].join(':')),
  ].join('|');
}

function serializeMiniTintSource(color: AvatarTintSource | undefined): string {
  return color === undefined
    ? ''
    : JSON.stringify(color);
}

async function renderMiniCompositeLayerUrl(layers: MiniLayer[]): Promise<string> {
  const imageLayers = await Promise.all(layers
    .filter(layer => !isMiniCompositeLayer(layer))
    .sort((first, second) => first.zIndex - second.zIndex)
    .map(async layer => ({
      image: await loadMiniLayerImageElement(layer),
      layer,
    })));
  const bounds = getMiniCompositeSourceBounds(imageLayers);
  const width = Math.max(Math.ceil(bounds.width), 1);
  const height = Math.max(Math.ceil(bounds.height), 1);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Unable to create mini avatar composite canvas context.');
  }

  context.imageSmoothingEnabled = false;

  imageLayers.forEach(({ image, layer }) => {
    const scaledWidth = image.naturalWidth * MINI_TRANSFORM_SUPERSAMPLE * (layer.scale ?? 1);
    const scaledHeight = image.naturalHeight * MINI_TRANSFORM_SUPERSAMPLE * (layer.scale ?? 1);
    const sourceOffset = getMiniCompositeSourceOffset(layer);

    context.save();
    context.translate(width / 2 + sourceOffset.x, height / 2 + sourceOffset.y);
    context.rotate((layer.angle ?? 0) * Math.PI / 180);
    context.scale(layer.flipX === true ? -1 : 1, 1);
    context.drawImage(
      image,
      -scaledWidth / 2,
      -scaledHeight / 2,
      scaledWidth,
      scaledHeight,
    );
    context.restore();
  });

  return canvas.toDataURL('image/png');
}

async function loadMiniLayerImageElement(layer: MiniLayer): Promise<HTMLImageElement> {
  const assetUrl = getMiniAvatarAssetUrl(layer.folder, layer.file);
  const imageUrl = layer.color
    ? await tintMiniImageByLuminance(assetUrl, layer.color, {
      anchorPoint: layer.colorAnchor ?? { x: layer.x, y: layer.y },
      coordinateSpace: layer.colorGradientSpace ?? 'local',
      pixelScale: MINI_PIXEL_SCALE * (layer.scale ?? 1),
    })
    : assetUrl;

  return loadMiniImageElement(imageUrl);
}

function createLocalCompositeLayers(originLayer: MiniLayer, layers: MiniLayer[]): MiniLayer[] {
  return layers.map(layer => {
    const worldOffset = {
      x: layer.x - originLayer.x,
      y: layer.y - originLayer.y,
    };
    const unrotatedOffset = rotateMiniPoint(worldOffset, -(originLayer.angle ?? 0));
    const unflippedOffset = {
      x: originLayer.flipX === true ? -unrotatedOffset.x : unrotatedOffset.x,
      y: unrotatedOffset.y,
    };
    const originScale = originLayer.scale ?? 1;

    return {
      ...layer,
      x: unflippedOffset.x / originScale,
      y: unflippedOffset.y / originScale,
      angle: (layer.angle ?? 0) - (originLayer.angle ?? 0),
      scale: (layer.scale ?? 1) / originScale,
      flipX: originLayer.flipX === true ? layer.flipX !== true : layer.flipX,
    };
  });
}

function getMiniCompositeSourceOffset(layer: MiniLayer): { x: number; y: number } {
  return {
    x: layer.x * MINI_TRANSFORM_SUPERSAMPLE / MINI_PIXEL_SCALE,
    y: layer.y * MINI_TRANSFORM_SUPERSAMPLE / MINI_PIXEL_SCALE,
  };
}

function getMiniCompositeSourceBounds(imageLayers: MiniCompositeImageLayer[]): { width: number; height: number } {
  const bounds = imageLayers.reduce(
    (currentBounds, { image, layer }) => {
      const layerBounds = getMiniCompositeImageLayerBounds(image, layer);

      return {
        left: Math.min(currentBounds.left, layerBounds.left),
        right: Math.max(currentBounds.right, layerBounds.right),
        top: Math.min(currentBounds.top, layerBounds.top),
        bottom: Math.max(currentBounds.bottom, layerBounds.bottom),
      };
    },
    {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    },
  );

  const halfWidth = Math.max(Math.abs(bounds.left), Math.abs(bounds.right));
  const halfHeight = Math.max(Math.abs(bounds.top), Math.abs(bounds.bottom));

  return {
    width: Math.ceil(halfWidth * 2),
    height: Math.ceil(halfHeight * 2),
  };
}

function getMiniCompositeImageLayerBounds(image: HTMLImageElement, layer: MiniLayer): MiniImagePixelBounds {
  const sourceOffset = getMiniCompositeSourceOffset(layer);
  const scaledWidth = image.naturalWidth * MINI_TRANSFORM_SUPERSAMPLE * (layer.scale ?? 1);
  const scaledHeight = image.naturalHeight * MINI_TRANSFORM_SUPERSAMPLE * (layer.scale ?? 1);
  const halfWidth = scaledWidth / 2;
  const halfHeight = scaledHeight / 2;
  const corners = [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight },
  ].map(point => rotateMiniPoint(point, layer.angle ?? 0));

  return corners.reduce<MiniImagePixelBounds>(
    (bounds, point) => ({
      left: Math.min(bounds.left, sourceOffset.x + point.x),
      right: Math.max(bounds.right, sourceOffset.x + point.x),
      top: Math.min(bounds.top, sourceOffset.y + point.y),
      bottom: Math.max(bounds.bottom, sourceOffset.y + point.y),
    }),
    {
      left: sourceOffset.x,
      right: sourceOffset.x,
      top: sourceOffset.y,
      bottom: sourceOffset.y,
    },
  );
}

function isMiniCompositeLayer(layer: MiniLayer): layer is MiniLayer & { compositeLayers: MiniLayer[] } {
  return layer.compositeLayers !== undefined;
}

function rotateMiniPoint(point: { x: number; y: number }, angle: number): { x: number; y: number } {
  if (angle === 0) {
    return point;
  }

  const radians = angle * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

function getMiniImageContentBounds(folder: string, file: string): Promise<MiniImageContentBounds> {
  const assetUrl = getMiniAvatarAssetUrl(folder, file);
  const cachedBounds = miniContentBoundsCache.get(assetUrl);

  if (cachedBounds) {
    return cachedBounds;
  }

  const boundsPromise = loadMiniImageElement(assetUrl).then(image => readMiniImageContentBounds(image));
  miniContentBoundsCache.set(assetUrl, boundsPromise);
  return boundsPromise;
}

function readMiniImageContentBounds(image: HTMLImageElement): MiniImageContentBounds {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Unable to create mini avatar bounds canvas context.');
  }

  context.imageSmoothingEnabled = false;
  context.drawImage(image, 0, 0);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  let top = canvas.height;
  let bottom = -1;

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const alpha = imageData.data[(y * canvas.width + x) * 4 + 3];

      if (alpha === 0) {
        continue;
      }

      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }

  if (bottom === -1) {
    return { width: canvas.width, height: canvas.height, top: 0, bottom: 0 };
  }

  return { width: canvas.width, height: canvas.height, top, bottom };
}

function hasMiniDirectoryOption(folder: string, optionId: string): boolean {
  return Object.keys(miniAvatarAssetUrls).some(assetPath => (
    assetPath.startsWith(`../../assets/avatar_system/mini/${folder}/${optionId}/`)
  ));
}

function getFirstAvailableMiniDirectoryOptionId(folder: string): string | null {
  const optionIds = Object.keys(miniAvatarAssetUrls)
    .map(assetPath => assetPath.match(new RegExp(`^\\.\\./\\.\\./assets/avatar_system/mini/${folder}/(\\d+)/`)))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map(match => match[1])
    .sort();

  return optionIds[0] ?? null;
}

interface MiniTintCoordinateOptions {
  coordinateSpace: AvatarGradientCoordinateSpace;
  anchorPoint: { x: number; y: number };
  pixelScale: number;
}

async function tintMiniImageByLuminance(
  imageUrl: string,
  tintSource: AvatarTintSource,
  coordinateOptions: MiniTintCoordinateOptions,
): Promise<string> {
  const cacheKey = [
    imageUrl,
    getMiniTintCacheKey(tintSource),
    coordinateOptions.coordinateSpace,
    Math.round(coordinateOptions.anchorPoint.x * 100) / 100,
    Math.round(coordinateOptions.anchorPoint.y * 100) / 100,
    Math.round(coordinateOptions.pixelScale * 100) / 100,
  ].join('|');
  const cachedUrl = miniTintCache.get(cacheKey);

  if (cachedUrl) {
    return cachedUrl;
  }

  const sourceImage = await loadMiniImageElement(imageUrl);
  const canvas = document.createElement('canvas');
  canvas.width = sourceImage.naturalWidth;
  canvas.height = sourceImage.naturalHeight;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Unable to create mini avatar tint canvas context.');
  }

  context.imageSmoothingEnabled = false;
  context.drawImage(sourceImage, 0, 0);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const shouldMakeTransparent = tintSource === 'transparent';
  const contentBounds = getMiniImagePixelBounds(imageData);

  for (let index = 0; index < imageData.data.length; index += 4) {
    const alpha = imageData.data[index + 3];

    if (alpha === 0) {
      continue;
    }

    if (shouldMakeTransparent) {
      imageData.data[index + 3] = 0;
      continue;
    }

    const red = imageData.data[index];
    const green = imageData.data[index + 1];
    const blue = imageData.data[index + 2];
    const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;
    const shade = luminance / MINI_BASE_TINT_LUMINANCE;
    const pixelIndex = index / 4;
    const x = pixelIndex % canvas.width;
    const y = Math.floor(pixelIndex / canvas.width);
    const tintSample = getMiniTintSamplePoint(x, y, canvas.width, canvas.height, contentBounds, coordinateOptions);
    const targetColor = getMiniTintPixelColor(tintSource, tintSample.x, tintSample.y, tintSample.bounds);

    imageData.data[index] = clampMiniColor(targetColor.red * shade);
    imageData.data[index + 1] = clampMiniColor(targetColor.green * shade);
    imageData.data[index + 2] = clampMiniColor(targetColor.blue * shade);
  }

  context.putImageData(imageData, 0, 0);

  const tintedUrl = canvas.toDataURL('image/png');
  miniTintCache.set(cacheKey, tintedUrl);
  return tintedUrl;
}

function getMiniTintSamplePoint(
  x: number,
  y: number,
  imageWidth: number,
  imageHeight: number,
  localBounds: MiniImagePixelBounds,
  coordinateOptions: MiniTintCoordinateOptions,
): { x: number; y: number; bounds: MiniImagePixelBounds } {
  if (coordinateOptions.coordinateSpace !== 'sharedHair') {
    return { x, y, bounds: localBounds };
  }

  return {
    x: coordinateOptions.anchorPoint.x + (x - imageWidth / 2) * coordinateOptions.pixelScale,
    y: coordinateOptions.anchorPoint.y + (y - imageHeight / 2) * coordinateOptions.pixelScale,
    bounds: MINI_SHARED_HAIR_GRADIENT_BOUNDS,
  };
}

function getMiniTintPixelColor(
  tintSource: AvatarTintSource,
  x: number,
  y: number,
  bounds: MiniImagePixelBounds,
): { red: number; green: number; blue: number } {
  if (typeof tintSource === 'string') {
    return parseMiniHexColor(tintSource);
  }

  const fromColor = parseMiniHexColor(tintSource.fromColor);
  const toColor = parseMiniHexColor(tintSource.toColor);
  const progress = tintSource.type === 'radial'
    ? getMiniRadialGradientProgress(tintSource, x, y, bounds)
    : getMiniLinearGradientProgress(tintSource, x, y, bounds);

  return mixMiniColors(fromColor, toColor, progress);
}

function getMiniLinearGradientProgress(
  gradient: AvatarColorGradient,
  x: number,
  y: number,
  bounds: MiniImagePixelBounds,
): number {
  const radians = gradient.angle * Math.PI / 180;
  const directionX = Math.sin(radians);
  const directionY = Math.cos(radians);
  const projection = x * directionX + y * directionY;
  const projectionBounds = getMiniLinearProjectionBounds(bounds, directionX, directionY);
  const rawProgress = (projection - projectionBounds.min) / Math.max(projectionBounds.max - projectionBounds.min, 1);
  const positionShift = 0.5 - gradient.position / 100;

  return applyMiniGradientEdgeColorStops(clampMiniUnit(rawProgress + positionShift));
}

function getMiniRadialGradientProgress(
  gradient: AvatarColorGradient,
  x: number,
  y: number,
  bounds: MiniImagePixelBounds,
): number {
  const width = Math.max(bounds.right - bounds.left, 1);
  const height = Math.max(bounds.bottom - bounds.top, 1);
  const centerX = bounds.left + (gradient.centerX + 100) / 200 * width;
  const centerY = bounds.top + (gradient.centerY + 100) / 200 * height;
  const normalizedDistance = Math.hypot(x - centerX, y - centerY) / getMiniMaxDistanceToBoundsCorner(centerX, centerY, bounds);
  const centerHold = gradient.position / 100 * 0.9;

  if (normalizedDistance <= centerHold) {
    return 0;
  }

  return applyMiniGradientEdgeColorStops(clampMiniUnit((normalizedDistance - centerHold) / Math.max(1 - centerHold, 0.01)));
}

function mixMiniColors(
  fromColor: { red: number; green: number; blue: number },
  toColor: { red: number; green: number; blue: number },
  progress: number,
): { red: number; green: number; blue: number } {
  return {
    red: fromColor.red + (toColor.red - fromColor.red) * progress,
    green: fromColor.green + (toColor.green - fromColor.green) * progress,
    blue: fromColor.blue + (toColor.blue - fromColor.blue) * progress,
  };
}

function getMiniImagePixelBounds(imageData: ImageData): MiniImagePixelBounds {
  let left = imageData.width;
  let right = 0;
  let top = imageData.height;
  let bottom = 0;

  for (let y = 0; y < imageData.height; y += 1) {
    for (let x = 0; x < imageData.width; x += 1) {
      const alpha = imageData.data[(y * imageData.width + x) * 4 + 3];

      if (alpha === 0) {
        continue;
      }

      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }

  if (left > right || top > bottom) {
    return {
      left: 0,
      right: Math.max(imageData.width - 1, 0),
      top: 0,
      bottom: Math.max(imageData.height - 1, 0),
    };
  }

  return { left, right, top, bottom };
}

function getMiniLinearProjectionBounds(
  bounds: MiniImagePixelBounds,
  directionX: number,
  directionY: number,
): { min: number; max: number } {
  const projections = [
    bounds.left * directionX + bounds.top * directionY,
    bounds.right * directionX + bounds.top * directionY,
    bounds.left * directionX + bounds.bottom * directionY,
    bounds.right * directionX + bounds.bottom * directionY,
  ];

  return {
    min: Math.min(...projections),
    max: Math.max(...projections),
  };
}

function getMiniMaxDistanceToBoundsCorner(centerX: number, centerY: number, bounds: MiniImagePixelBounds): number {
  return Math.max(
    1,
    Math.hypot(bounds.left - centerX, bounds.top - centerY),
    Math.hypot(bounds.right - centerX, bounds.top - centerY),
    Math.hypot(bounds.left - centerX, bounds.bottom - centerY),
    Math.hypot(bounds.right - centerX, bounds.bottom - centerY),
  );
}

function getMiniTintCacheKey(tintSource: AvatarTintSource): string {
  return typeof tintSource === 'string' ? tintSource : JSON.stringify(tintSource);
}

function clampMiniUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function applyMiniGradientEdgeColorStops(progress: number): number {
  if (progress <= MINI_GRADIENT_EDGE_COLOR_STOP) {
    return 0;
  }

  if (progress >= 1 - MINI_GRADIENT_EDGE_COLOR_STOP) {
    return 1;
  }

  return (progress - MINI_GRADIENT_EDGE_COLOR_STOP) / (1 - MINI_GRADIENT_EDGE_COLOR_STOP * 2);
}

function loadMiniImageElement(imageUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load mini avatar image: ${imageUrl}`));
    image.src = imageUrl;
  });
}

function parseMiniHexColor(color: string): { red: number; green: number; blue: number } {
  const normalizedColor = color.replace('#', '');

  if (!/^[0-9a-fA-F]{6}$/.test(normalizedColor)) {
    return { red: 38, green: 38, blue: 38 };
  }

  return {
    red: Number.parseInt(normalizedColor.slice(0, 2), 16),
    green: Number.parseInt(normalizedColor.slice(2, 4), 16),
    blue: Number.parseInt(normalizedColor.slice(4, 6), 16),
  };
}

function clampMiniColor(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
