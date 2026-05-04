import { FabricImage } from 'fabric';
import { gifToSprite } from './gifToSprite';

const [PLAY, PAUSE, STOP] = [0, 1, 2];

interface GifImage extends FabricImage {
  play: () => void;
  pause: () => void;
  stop: () => void;
  restart: () => void;
  getStatus: () => string;
}

export const fabricGif = async (gif: string | File, maxWidth?: number, maxHeight?: number, maxDuration?: number, loop = true) => {
  const { error, dataUrl, delay, frameWidth, framesLength } = await gifToSprite(gif, maxWidth, maxHeight, maxDuration);

  if (error) return { error };

  const img = await FabricImage.fromURL(dataUrl!) as GifImage;
  const sprite = img.getElement() as HTMLImageElement;
  let framesIndex = 0;
  let start = performance.now();
  let status: number;

  img.width = frameWidth;
  img.height = sprite.naturalHeight;
  img.type = 'image';

  img.top = 200;
  img.left = 200;

  img._render = function (this: FabricImage, ctx: CanvasRenderingContext2D) {
    if (status === PAUSE || (status === STOP && framesIndex === 0)) return;
    const now = performance.now();
    const delta = now - start;
    if (delta > delay) {
      start = now;
      framesIndex++;
    }
    if (framesIndex === framesLength) {
      if (loop) {
        framesIndex = 0;
      } else {
        framesIndex = framesLength - 1;
        status = STOP;
        this.dirty = false;
        return;
      }
    }
    if (status === STOP) framesIndex = 0;
    ctx.drawImage(
      sprite,
      frameWidth * framesIndex,
      0,
      frameWidth,
      sprite.height,
      -this.width! / 2,
      -this.height! / 2,
      frameWidth,
      sprite.height
    );
  };

  img.play = function (this: FabricImage) {
    status = PLAY;
    this.dirty = true;
  };
  img.pause = function (this: FabricImage) {
    status = PAUSE;
    this.dirty = false;
  };
  img.stop = function (this: FabricImage) {
    status = STOP;
    this.dirty = false;
  };
  img.restart = function (this: FabricImage) {
    framesIndex = 0;
    start = performance.now();
    status = PLAY;
    this.dirty = true;
  };
  img.getStatus = () => ['Playing', 'Paused', 'Stopped'][status];

  img.play();
  return img;
};
