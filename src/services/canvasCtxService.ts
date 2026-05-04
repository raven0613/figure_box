import { Canvas } from 'fabric';
import type { FabricImages, PreloadFabricImages } from './imageService';

const APP_CONTAINER_ID = '#app-container';

export enum CanvasTag {
  STATIC = 'static',
  PLAYGROUND = 'playground',
  INTERACTIVE = 'interactive',
}

export class CanvasContainer {
  private context: Canvas;

  constructor(canvas: Canvas) {
    this.context = canvas;
  }

  getContext() {
    return this.context;
  }
}

export type FabricImagesType = FabricImages & PreloadFabricImages;

class CanvasCtxService {
  static instance: CanvasCtxService;
  private fabricImages?: FabricImagesType;
  private _contextByTag: { [tag: string]: CanvasContainer } = {};

  static getInstance() {
    if (!this.instance) {
      this.instance = new CanvasCtxService();
    }
    return this.instance;
  }

  setCanvasContext(tag: CanvasTag, canvas: CanvasContainer) {
    if (this._contextByTag[tag]) {
      throw Error(`The tag: ${tag} is already exist`);
    }

    this._contextByTag[tag] = canvas;

    return this;
  }

  getCanvasContext(tag: CanvasTag = CanvasTag.STATIC) {
    return this._contextByTag[tag].getContext();
  }

  setFabricImages(fabricImages: FabricImages & PreloadFabricImages) {
    this.fabricImages = fabricImages;
  }

  getFabricImages() {
    return this.fabricImages;
  }

  resizeCanvas() {
    const appContainerEl = this.getElement(APP_CONTAINER_ID);
    const canvasContainers = this.getAllCanvas();

    if (!appContainerEl || canvasContainers.length === 0) {
      return;
    }

    const containerWidth = appContainerEl?.clientWidth;

    canvasContainers.forEach(container => {
      const canvas = container.getContext();
      const scale = containerWidth / canvas.getWidth();
      const zoom = canvas?.getZoom() * scale;
      canvas.setDimensions({ width: containerWidth, height: containerWidth });
      canvas.setViewportTransform([zoom, 0, 0, zoom, 0, 0]);
      canvas.requestRenderAll();
    });
  }

  private getAllCanvas() {
    return Object.values(this._contextByTag);
  }

  private getElement(query: string) {
    const element = document.querySelector(query) as HTMLDivElement;

    if (!element) {
      console.error(`The query: ${query} is not found in document!!!`);
      return;
    } else {
      return element;
    }
  }
}

export const canvasService = CanvasCtxService.getInstance();
