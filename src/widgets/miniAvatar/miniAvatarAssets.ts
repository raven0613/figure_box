import { FabricImage } from 'fabric';

import {
  MINI_BASE_TINT_LUMINANCE,
  MINI_PIXEL_SCALE,
} from './miniAvatarRig';
import type { AvatarColorGradient, AvatarTintSource } from '../avatarCanvas';
import type { MiniImageContentBounds, MiniLayer } from './miniAvatarTypes';

interface MiniImagePixelBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const MINI_GRADIENT_EDGE_COLOR_STOP = 0.05;
const miniTintCache = new Map<string, string>();
const miniContentBoundsCache = new Map<string, Promise<MiniImageContentBounds>>();

const miniAvatarAssetUrls = import.meta.glob<string>('../../assets/avatar_system/mini/**/*.png', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

export async function createMiniLayerImage(layer: MiniLayer): Promise<FabricImage> {
  const assetUrl = getMiniAvatarAssetUrl(layer.folder, layer.file);
  const imageUrl = layer.color
    ? await tintMiniImageByLuminance(assetUrl, layer.color)
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

async function tintMiniImageByLuminance(imageUrl: string, tintSource: AvatarTintSource): Promise<string> {
  const cacheKey = `${imageUrl}|${getMiniTintCacheKey(tintSource)}`;
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
    const targetColor = getMiniTintPixelColor(tintSource, x, y, contentBounds);

    imageData.data[index] = clampMiniColor(targetColor.red * shade);
    imageData.data[index + 1] = clampMiniColor(targetColor.green * shade);
    imageData.data[index + 2] = clampMiniColor(targetColor.blue * shade);
  }

  context.putImageData(imageData, 0, 0);

  const tintedUrl = canvas.toDataURL('image/png');
  miniTintCache.set(cacheKey, tintedUrl);
  return tintedUrl;
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
