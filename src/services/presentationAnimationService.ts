import type { Canvas, FabricObject } from 'fabric';

export interface AnimationHandle {
  cancel: () => void;
  finished: Promise<void>;
}

export interface HeldItemCelebrationAnimationInput {
  key: string;
  target: FabricObject;
  canvas: Canvas;
  radius: number;
  durationMs?: number;
  loopCount?: number;
}

export interface CharacterJumpAnimationInput {
  key: string;
  target: FabricObject;
  canvas: Canvas;
  jumpHeight: number;
  durationMs?: number;
  jumpCount?: number;
}

const DEFAULT_HELD_ITEM_CELEBRATION_DURATION_MS = 920;
const DEFAULT_HELD_ITEM_CELEBRATION_LOOP_COUNT = 2;
const DEFAULT_CHARACTER_JUMP_DURATION_MS = 760;
const DEFAULT_CHARACTER_JUMP_COUNT = 2;

interface ActiveAnimation {
  frameId: number;
  finish: () => void;
}

export class PresentationAnimationService {
  private readonly activeAnimationsByKey = new Map<string, ActiveAnimation>();

  playHeldItemCelebration(input: HeldItemCelebrationAnimationInput): AnimationHandle {
    const durationMs = input.durationMs ?? DEFAULT_HELD_ITEM_CELEBRATION_DURATION_MS;
    const loopCount = input.loopCount ?? DEFAULT_HELD_ITEM_CELEBRATION_LOOP_COUNT;
    const origin = {
      left: input.target.left ?? 0,
      top: input.target.top ?? 0,
      angle: input.target.angle ?? 0,
    };
    const startedAt = performance.now();

    this.cancel(input.key);

    let finishAnimation: () => void = () => {};
    const finished = new Promise<void>(resolve => {
      finishAnimation = resolve;
    });

    const animate = (timestamp: number) => {
      const elapsedRatio = Math.min(1, (timestamp - startedAt) / durationMs);
      const easedRadius = input.radius * (1 - easeOutCubic(elapsedRatio));
      const angle = elapsedRatio * Math.PI * 2 * loopCount;

      input.target.set({
        left: origin.left + Math.cos(angle) * easedRadius,
        top: origin.top + Math.sin(angle) * easedRadius,
        angle: origin.angle + elapsedRatio * 360 * loopCount,
        dirty: true,
      });
      input.target.setCoords();
      input.canvas.requestRenderAll();

      if (elapsedRatio < 1 && this.activeAnimationsByKey.has(input.key)) {
        this.setAnimationFrame(input.key, window.requestAnimationFrame(animate), finishAnimation);
        return;
      }

      this.resetCelebrationTarget(input.target, origin);
      this.activeAnimationsByKey.delete(input.key);
      input.canvas.requestRenderAll();
      finishAnimation();
    };

    this.setAnimationFrame(input.key, window.requestAnimationFrame(animate), finishAnimation);

    return {
      cancel: () => {
        this.cancel(input.key);
        this.resetCelebrationTarget(input.target, origin);
        input.canvas.requestRenderAll();
      },
      finished,
    };
  }

  playCharacterJump(input: CharacterJumpAnimationInput): AnimationHandle {
    const durationMs = input.durationMs ?? DEFAULT_CHARACTER_JUMP_DURATION_MS;
    const jumpCount = input.jumpCount ?? DEFAULT_CHARACTER_JUMP_COUNT;
    const origin = {
      top: input.target.top ?? 0,
      scaleX: input.target.scaleX ?? 1,
      scaleY: input.target.scaleY ?? 1,
    };
    const startedAt = performance.now();

    this.cancel(input.key);

    let finishAnimation: () => void = () => {};
    const finished = new Promise<void>(resolve => {
      finishAnimation = resolve;
    });

    const animate = (timestamp: number) => {
      const elapsedRatio = Math.min(1, (timestamp - startedAt) / durationMs);
      const jumpProgress = elapsedRatio * jumpCount;
      const jumpCycleProgress = elapsedRatio >= 1 ? 1 : jumpProgress % 1;
      const lift = Math.sin(jumpCycleProgress * Math.PI);
      const squash = Math.max(0, lift) * 0.045;

      input.target.set({
        top: origin.top - Math.max(0, lift) * input.jumpHeight,
        scaleX: origin.scaleX + squash,
        scaleY: origin.scaleY - squash,
        dirty: true,
      });
      input.target.setCoords();
      input.canvas.requestRenderAll();

      if (elapsedRatio < 1 && this.activeAnimationsByKey.has(input.key)) {
        this.setAnimationFrame(input.key, window.requestAnimationFrame(animate), finishAnimation);
        return;
      }

      this.resetJumpTarget(input.target, origin);
      this.activeAnimationsByKey.delete(input.key);
      input.canvas.requestRenderAll();
      finishAnimation();
    };

    this.setAnimationFrame(input.key, window.requestAnimationFrame(animate), finishAnimation);

    return {
      cancel: () => {
        this.cancel(input.key);
        this.resetJumpTarget(input.target, origin);
        input.canvas.requestRenderAll();
      },
      finished,
    };
  }

  cancel(key: string): void {
    const activeAnimation = this.activeAnimationsByKey.get(key);

    if (!activeAnimation) {
      return;
    }

    window.cancelAnimationFrame(activeAnimation.frameId);
    this.activeAnimationsByKey.delete(key);
    activeAnimation.finish();
  }

  cancelAll(): void {
    Array.from(this.activeAnimationsByKey.keys()).forEach(key => {
      this.cancel(key);
    });
  }

  private resetCelebrationTarget(
    target: FabricObject,
    origin: { left: number; top: number; angle: number },
  ): void {
    target.set({
      left: origin.left,
      top: origin.top,
      angle: origin.angle,
      dirty: true,
    });
    target.setCoords();
  }

  private resetJumpTarget(
    target: FabricObject,
    origin: { top: number; scaleX: number; scaleY: number },
  ): void {
    target.set({
      top: origin.top,
      scaleX: origin.scaleX,
      scaleY: origin.scaleY,
      dirty: true,
    });
    target.setCoords();
  }

  private setAnimationFrame(key: string, frameId: number, finish: () => void): void {
    this.activeAnimationsByKey.set(key, {
      frameId,
      finish,
    });
  }
}

function easeOutCubic(value: number): number {
  return 1 - ((1 - value) ** 3);
}
