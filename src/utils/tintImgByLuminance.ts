export interface TintImgByLuminanceOptions {
  baseLuminance?: number;
  fallbackColor?: string;
}

const DEFAULT_BASE_LUMINANCE = 128;
const DEFAULT_FALLBACK_COLOR = '#ffffff';

export function tintImgByLuminance(
  sourceImage: HTMLImageElement,
  color: string,
  options: TintImgByLuminanceOptions = {},
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = sourceImage.naturalWidth;
  canvas.height = sourceImage.naturalHeight;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Unable to create image tint canvas context.');
  }

  context.imageSmoothingEnabled = false;
  context.drawImage(sourceImage, 0, 0);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const targetColor = parseHexColor(color, options.fallbackColor ?? DEFAULT_FALLBACK_COLOR);
  const baseLuminance = Math.max(options.baseLuminance ?? DEFAULT_BASE_LUMINANCE, 1);

  for (let index = 0; index < imageData.data.length; index += 4) {
    const alpha = imageData.data[index + 3];

    if (alpha === 0) {
      continue;
    }

    const red = imageData.data[index];
    const green = imageData.data[index + 1];
    const blue = imageData.data[index + 2];
    const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;
    const shade = luminance / baseLuminance;

    imageData.data[index] = clampColor(targetColor.red * shade);
    imageData.data[index + 1] = clampColor(targetColor.green * shade);
    imageData.data[index + 2] = clampColor(targetColor.blue * shade);
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}

function parseHexColor(color: string, fallbackColor: string): { red: number; green: number; blue: number } {
  const normalizedColor = color.replace('#', '');

  if (!/^[0-9a-fA-F]{6}$/.test(normalizedColor)) {
    return parseHexColor(fallbackColor, DEFAULT_FALLBACK_COLOR);
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
