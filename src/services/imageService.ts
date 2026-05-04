import { FabricImage, FabricObject } from 'fabric';
import { SCALE_X, SCALE_Y } from '~/constants/canvas';
import { imagesPath, preloadImagesPath, type PreloadImage, type Image, type GifImage, type ImagePathMap } from '~/constants/paths';
import { fabricGif } from '~/utils/fabricSprite/fabricGif';

export type FabricImages = { [key in Image]: FabricObject };

export type PreloadFabricImages = { [key in PreloadImage]: FabricObject };

export class ImageService {
  static instance: ImageService;
  private preloadFabricImages: PreloadFabricImages = {} as PreloadFabricImages;
  private fabricImages: FabricImages = {} as FabricImages;

  static getInstance() {
    if (!this.instance) {
      this.instance = new ImageService();
    }

    return this.instance;
  }

  async loadPreloadImages() {
    const images = this.createFabricImagesMap<PreloadImage>(preloadImagesPath);
    const keys = Object.keys(images) as PreloadImage[];

    for (const key of keys) {
      this.preloadFabricImages[key] = await images[key];
    }
  }

  async loadImages(onLoadCallback?: (percent: number) => Promise<void>) {
    const images = this.createFabricImagesMap<Image>(imagesPath);
    const keys = Object.keys(images) as Image[];
    const itemsCount = keys.length;
    let loadedItemsCount = 0;

    for (const key of keys) {
      this.fabricImages[key] = await images[key];

      const percent = (loadedItemsCount / itemsCount) * 100;
      loadedItemsCount++;

      if (onLoadCallback) {
        await onLoadCallback(percent);
      }
    }
  }

  getPreloadImages() {
    return this.preloadFabricImages;
  }

  getImages() {
    return this.fabricImages;
  }

  private async imgLoader(url: string): Promise<FabricObject> {
    const img = await FabricImage.fromURL(url);
    const imgShape = img.set({
      selectable: false,
      scaleX: SCALE_X,
      scaleY: SCALE_Y,
    });
    return imgShape;
  }

  async gifImgLoader(url: string, key: GifImage): Promise<FabricObject> {
    const size = {
      CONGRATS: { width: 350, height: 350, duration: 2560, loop: false },
      BET_TIMER_BG: { width: 334, height: 351, duration: 2560, loop: true },
    };
    const imgShape = (await fabricGif(
      url,
      size[key].width,
      size[key].height,
      size[key].duration,
      size[key].loop
    )) as FabricObject;
    imgShape.set({
      selectable: false,
    });

    return imgShape;
  }

  private createFabricImagesMap<T extends string>(paths: ImagePathMap<T>) {
    const map = {} as { [key in T]: Promise<FabricObject> };
    for (const [key, url] of Object.entries(paths)) {
      if ((url as string).includes('.gif')) {
        map[key as T] = this.gifImgLoader(url as string, key as GifImage);
      } else {
        map[key as T] = this.imgLoader(url as string);
      }
    }

    return map;
  }
}

export const imageService = ImageService.getInstance();
