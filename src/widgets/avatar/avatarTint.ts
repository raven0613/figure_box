import type {
  AvatarColorGradient,
  AvatarGradientCoordinateSpace,
  AvatarPartState,
  AvatarTintSource,
} from './avatarTypes';

interface AvatarImageContentBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface AvatarTintCoordinateOptions {
  coordinateSpace: AvatarGradientCoordinateSpace;
  anchorPoint: {
    x: number;
    y: number;
  };
  pixelScaleX: number;
  pixelScaleY: number;
}

const DEFAULT_CANVAS_WIDTH = 520;
const DEFAULT_CANVAS_HEIGHT = 560;
const DEFAULT_SCALE = 1;
const BASE_TINT_LUMINANCE = 128;
const BLACK_MASK_MAX_LUMINANCE = 8;
const LINE_LAYER_FILL_LUMINANCE_THRESHOLD = 180;
const GRADIENT_EDGE_COLOR_STOP = 0.05;
const SHARED_HAIR_GRADIENT_BOUNDS: AvatarImageContentBounds = {
  left: 0,
  right: DEFAULT_CANVAS_WIDTH,
  top: 0,
  bottom: DEFAULT_CANVAS_HEIGHT,
};

const tintCache = new Map<string, string>();

export async function tintImageByLuminance(
  imageUrl: string,
  tintSource: AvatarTintSource,
  tint: 'color' | 'line' | 'skin',
  coordinateOptions: AvatarTintCoordinateOptions,
  shouldNormalizeToSourceBrightness = false,
  shouldDropLightPixels = false,
): Promise<string> {
  const cacheKey = [
    imageUrl,
    getAvatarTintCacheKey(tintSource),
    tint,
    coordinateOptions.coordinateSpace,
    Math.round(coordinateOptions.anchorPoint.x * 100) / 100,
    Math.round(coordinateOptions.anchorPoint.y * 100) / 100,
    Math.round(coordinateOptions.pixelScaleX * 100) / 100,
    Math.round(coordinateOptions.pixelScaleY * 100) / 100,
    shouldNormalizeToSourceBrightness,
    shouldDropLightPixels,
  ].join('|');
  const cachedUrl = tintCache.get(cacheKey);

  if (cachedUrl) {
    return cachedUrl;
  }

  const sourceImage = await loadImageElement(imageUrl);
  const canvas = document.createElement('canvas');
  canvas.width = sourceImage.naturalWidth;
  canvas.height = sourceImage.naturalHeight;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Unable to create avatar tint canvas context.');
  }

  context.imageSmoothingEnabled = false;
  context.drawImage(sourceImage, 0, 0);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const maxLuminance = getMaxLuminance(imageData);
  const contentBounds = getImageContentBounds(imageData);
  const shouldUseAlphaMask = tint === 'skin' || (tint === 'line' && maxLuminance <= BLACK_MASK_MAX_LUMINANCE);

  for (let index = 0; index < imageData.data.length; index += 4) {
    const alpha = imageData.data[index + 3];

    if (alpha === 0) {
      continue;
    }

    const red = imageData.data[index];
    const green = imageData.data[index + 1];
    const blue = imageData.data[index + 2];
    const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;

    if (shouldDropLightPixels && luminance > LINE_LAYER_FILL_LUMINANCE_THRESHOLD) {
      imageData.data[index + 3] = 0;
      continue;
    }

    const baseLuminance = shouldNormalizeToSourceBrightness
      ? Math.max(maxLuminance, 1)
      : BASE_TINT_LUMINANCE;
    const shade = shouldUseAlphaMask ? alpha / 255 : luminance / baseLuminance;
    const pixelIndex = index / 4;
    const x = pixelIndex % canvas.width;
    const y = Math.floor(pixelIndex / canvas.width);
    const tintSample = getAvatarTintSamplePoint(x, y, canvas.width, canvas.height, contentBounds, coordinateOptions);
    const targetColor = getAvatarTintPixelColor(tintSource, tintSample.x, tintSample.y, tintSample.bounds);

    imageData.data[index] = clampColor(targetColor.red * shade);
    imageData.data[index + 1] = clampColor(targetColor.green * shade);
    imageData.data[index + 2] = clampColor(targetColor.blue * shade);
  }

  context.putImageData(imageData, 0, 0);

  const tintedUrl = canvas.toDataURL('image/png');
  tintCache.set(cacheKey, tintedUrl);
  return tintedUrl;
}

export function getAvatarTintCacheKey(tintSource: AvatarTintSource | undefined): string {
  return typeof tintSource === 'string' || tintSource === undefined
    ? tintSource ?? ''
    : JSON.stringify(tintSource);
}

export function getSharedHairTintTransformKey(state: AvatarPartState): string {
  return [
    state.offsetX ?? 0,
    state.offsetY ?? 0,
    state.scale ?? DEFAULT_SCALE,
    state.flipX === true ? '1' : '0',
    state.leftVisible === false ? '0' : '1',
    state.rightVisible === false ? '0' : '1',
  ].join('|');
}

function getAvatarTintSamplePoint(
  x: number,
  y: number,
  imageWidth: number,
  imageHeight: number,
  localBounds: AvatarImageContentBounds,
  coordinateOptions: AvatarTintCoordinateOptions,
): { x: number; y: number; bounds: AvatarImageContentBounds } {
  if (coordinateOptions.coordinateSpace !== 'sharedHair') {
    return { x, y, bounds: localBounds };
  }

  return {
    x: coordinateOptions.anchorPoint.x + (x - imageWidth / 2) * coordinateOptions.pixelScaleX,
    y: coordinateOptions.anchorPoint.y + (y - imageHeight / 2) * coordinateOptions.pixelScaleY,
    bounds: SHARED_HAIR_GRADIENT_BOUNDS,
  };
}

function getAvatarTintPixelColor(
  tintSource: AvatarTintSource,
  x: number,
  y: number,
  bounds: AvatarImageContentBounds,
): { red: number; green: number; blue: number } {
  if (typeof tintSource === 'string') {
    return parseHexColor(tintSource);
  }

  const fromColor = parseHexColor(tintSource.fromColor);
  const toColor = parseHexColor(tintSource.toColor);
  const progress = tintSource.type === 'radial'
    ? getRadialGradientProgress(tintSource, x, y, bounds)
    : getLinearGradientProgress(tintSource, x, y, bounds);

  return mixAvatarColors(fromColor, toColor, progress);
}

function getLinearGradientProgress(
  gradient: AvatarColorGradient,
  x: number,
  y: number,
  bounds: AvatarImageContentBounds,
): number {
  const radians = gradient.angle * Math.PI / 180;
  const directionX = Math.sin(radians);
  const directionY = Math.cos(radians);
  const projection = x * directionX + y * directionY;
  const projectionBounds = getLinearProjectionBounds(bounds, directionX, directionY);
  const rawProgress = (projection - projectionBounds.min) / Math.max(projectionBounds.max - projectionBounds.min, 1);
  const positionShift = 0.5 - gradient.position / 100;

  return applyGradientEdgeColorStops(clampUnit(rawProgress + positionShift));
}

function getRadialGradientProgress(
  gradient: AvatarColorGradient,
  x: number,
  y: number,
  bounds: AvatarImageContentBounds,
): number {
  const width = Math.max(bounds.right - bounds.left, 1);
  const height = Math.max(bounds.bottom - bounds.top, 1);
  const centerX = bounds.left + (gradient.centerX + 100) / 200 * width;
  const centerY = bounds.top + (gradient.centerY + 100) / 200 * height;
  const distanceX = x - centerX;
  const distanceY = y - centerY;
  const maxDistance = getMaxDistanceToBoundsCorner(centerX, centerY, bounds);
  const centerHold = gradient.position / 100 * 0.9;
  const normalizedDistance = Math.hypot(distanceX, distanceY) / maxDistance;

  if (normalizedDistance <= centerHold) {
    return 0;
  }

  return applyGradientEdgeColorStops(clampUnit((normalizedDistance - centerHold) / Math.max(1 - centerHold, 0.01)));
}

function mixAvatarColors(
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

function getImageContentBounds(imageData: ImageData): AvatarImageContentBounds {
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

function getLinearProjectionBounds(
  bounds: AvatarImageContentBounds,
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

function getMaxDistanceToBoundsCorner(centerX: number, centerY: number, bounds: AvatarImageContentBounds): number {
  return Math.max(
    1,
    Math.hypot(bounds.left - centerX, bounds.top - centerY),
    Math.hypot(bounds.right - centerX, bounds.top - centerY),
    Math.hypot(bounds.left - centerX, bounds.bottom - centerY),
    Math.hypot(bounds.right - centerX, bounds.bottom - centerY),
  );
}

function clampUnit(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function applyGradientEdgeColorStops(progress: number): number {
  if (progress <= GRADIENT_EDGE_COLOR_STOP) {
    return 0;
  }

  if (progress >= 1 - GRADIENT_EDGE_COLOR_STOP) {
    return 1;
  }

  return (progress - GRADIENT_EDGE_COLOR_STOP) / (1 - GRADIENT_EDGE_COLOR_STOP * 2);
}

function getMaxLuminance(imageData: ImageData): number {
  let maxLuminance = 0;

  for (let index = 0; index < imageData.data.length; index += 4) {
    const alpha = imageData.data[index + 3];

    if (alpha === 0) {
      continue;
    }

    const red = imageData.data[index];
    const green = imageData.data[index + 1];
    const blue = imageData.data[index + 2];
    const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;
    maxLuminance = Math.max(maxLuminance, luminance);
  }

  return maxLuminance;
}

function loadImageElement(imageUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load avatar image: ${imageUrl}`));
    image.src = imageUrl;
  });
}

function parseHexColor(color: string): { red: number; green: number; blue: number } {
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

function clampColor(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
