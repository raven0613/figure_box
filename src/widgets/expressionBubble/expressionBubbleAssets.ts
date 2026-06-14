import { FabricImage } from 'fabric';
import { tintImgByLuminance } from '~/utils/tintImgByLuminance';
import { EXPRESSION_BUBBLE_BASE_TINT_LUMINANCE } from './expressionBubbleRig';
import type { ExpressionBubbleLayer } from './expressionBubbleTypes';

const expressionBubbleAssetUrls = import.meta.glob<string>('../../assets/ui/bubble/**/*.png', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

const imageCache = new Map<string, Promise<HTMLImageElement>>();
const tintedAssetCache = new Map<string, Promise<string>>();

export function hasExpressionBubbleAsset(assetPath: string): boolean {
  return expressionBubbleAssetUrls[getExpressionBubbleAssetImportPath(assetPath)] !== undefined;
}

export function getExpressionBubbleAssetUrl(assetPath: string): string {
  const importPath = getExpressionBubbleAssetImportPath(assetPath);
  const url = expressionBubbleAssetUrls[importPath];

  if (!url) {
    throw new Error(`Expression bubble asset not found: ${importPath}`);
  }

  return url;
}

export async function createExpressionBubbleLayerImage(
  layer: ExpressionBubbleLayer,
): Promise<FabricImage> {
  const assetUrl = getExpressionBubbleAssetUrl(layer.assetPath);
  const imageUrl = layer.color
    ? await tintExpressionBubbleAsset(assetUrl, layer.color)
    : assetUrl;
  const image = await FabricImage.fromURL(imageUrl);
  const scale = layer.scale ?? 1;
  const left = alignImageCenterToPixelGrid(layer.x, image.width, scale);
  const top = alignImageCenterToPixelGrid(layer.y, image.height, scale);

  image.set({
    left,
    top,
    angle: layer.angle ?? 0,
    opacity: layer.opacity ?? 1,
    scaleX: scale,
    scaleY: scale,
    originX: 'center',
    originY: 'center',
    selectable: false,
    evented: false,
    objectCaching: false,
    imageSmoothing: false,
  });
  return image;
}

export function createExpressionBubbleLayerImages(
  sortedLayers: ExpressionBubbleLayer[],
): Promise<FabricImage[]> {
  return Promise.all(sortedLayers.map(createExpressionBubbleLayerImage));
}

function tintExpressionBubbleAsset(assetUrl: string, color: string): Promise<string> {
  const cacheKey = `${assetUrl}|${color}`;
  const cachedAsset = tintedAssetCache.get(cacheKey);

  if (cachedAsset) {
    return cachedAsset;
  }

  const tintedAsset = loadImage(assetUrl).then(image => (
    tintImgByLuminance(image, color, {
      baseLuminance: EXPRESSION_BUBBLE_BASE_TINT_LUMINANCE,
    }).toDataURL('image/png')
  ));
  tintedAssetCache.set(cacheKey, tintedAsset);
  return tintedAsset;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  const cachedImage = imageCache.get(url);

  if (cachedImage) {
    return cachedImage;
  }

  const imagePromise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load expression bubble asset: ${url}`));
    image.src = url;
  });
  imageCache.set(url, imagePromise);
  return imagePromise;
}

function alignImageCenterToPixelGrid(
  center: number,
  imageSize: number,
  scale: number,
): number {
  const scaledSize = imageSize * scale;

  if (!Number.isFinite(scaledSize) || scaledSize <= 0) {
    return center;
  }

  return Math.round(center - scaledSize / 2) + scaledSize / 2;
}

function getExpressionBubbleAssetImportPath(assetPath: string): string {
  return `../../assets/ui/bubble/${assetPath}`;
}
