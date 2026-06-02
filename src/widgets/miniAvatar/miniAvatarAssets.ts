import { FabricImage } from 'fabric';

import {
  MINI_BASE_TINT_LUMINANCE,
  MINI_PIXEL_SCALE,
} from './miniAvatarRig';
import type { MiniImageContentBounds, MiniLayer } from './miniAvatarTypes';

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

async function tintMiniImageByLuminance(imageUrl: string, color: string): Promise<string> {
  const cacheKey = `${imageUrl}|${color}`;
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
  const targetColor = parseMiniHexColor(color);
  const shouldMakeTransparent = color === 'transparent';

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

    imageData.data[index] = clampMiniColor(targetColor.red * shade);
    imageData.data[index + 1] = clampMiniColor(targetColor.green * shade);
    imageData.data[index + 2] = clampMiniColor(targetColor.blue * shade);
  }

  context.putImageData(imageData, 0, 0);

  const tintedUrl = canvas.toDataURL('image/png');
  miniTintCache.set(cacheKey, tintedUrl);
  return tintedUrl;
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
