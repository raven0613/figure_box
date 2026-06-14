import type {
  ExpressionBubbleAnimation,
  ExpressionBubbleAnimationClip,
  ExpressionBubblePose,
  ExpressionBubbleTransform,
} from './expressionBubbleTypes';

const POP_DURATION_MS = 180;
const POP_START_SCALE = 0.86;
const LAUGH_BOUNCE_AMOUNT_Y = 1;
const SHAKE_FRAME_OFFSETS: readonly ExpressionBubbleTransform[] = [
  {},
  { x: 1 },
  { y: -1 },
  { x: -1 },
  { y: 1 },
  {},
];
const LAUGH_FRAME_OFFSETS: readonly ExpressionBubbleTransform[] = [
  {},
  { y: -1 },
  {},
  { y: -1 },
  {},
  { y: -1 },
];

export function sampleExpressionBubbleAnimation(
  animation: ExpressionBubbleAnimation,
  elapsedMs: number,
): ExpressionBubblePose {
  return animation.clips.reduce<ExpressionBubblePose>(
    (combinedPose, clip) => mergeExpressionBubblePoses(
      combinedPose,
      clip.sample(elapsedMs, animation, clip),
    ),
    {},
  );
}

export function getExpressionBubbleAnimationFrameCount(
  animation: ExpressionBubbleAnimation,
): number {
  return Math.max(1, Math.round(animation.durationMs / 1000 * animation.fps));
}

export function getExpressionBubbleAnimationFrameDurationMs(
  animation: ExpressionBubbleAnimation,
): number {
  return animation.durationMs / getExpressionBubbleAnimationFrameCount(animation);
}

export function createExpressionBubblePopClip(): ExpressionBubbleAnimationClip {
  return {
    id: 'pop',
    durationMs: POP_DURATION_MS,
    params: {
      durationMs: POP_DURATION_MS,
      startScale: POP_START_SCALE,
    },
    sample: elapsedMs => {
      if (elapsedMs > POP_DURATION_MS) {
        return {};
      }

      const progress = easeOutBack(Math.max(0, elapsedMs) / POP_DURATION_MS);
      const scale = POP_START_SCALE + (1 - POP_START_SCALE) * progress;
      const opacity = Math.min(1, progress);

      return {
        frame: { scale, opacity },
        face: { scale, opacity },
        expression: { scale, opacity },
      };
    },
  };
}

export function createExpressionBubbleFaceShakeClip(
  options: { amountX?: number; amountY?: number; intervalMs?: number } = {},
): ExpressionBubbleAnimationClip {
  const amountX = options.amountX ?? 1;
  const amountY = options.amountY ?? 1;

  return {
    id: 'face_shake',
    intervalMs: options.intervalMs,
    params: {
      amountX,
      amountY,
      intervalMs: options.intervalMs ?? 0,
      frameOffsets: SHAKE_FRAME_OFFSETS,
    },
    sample: (elapsedMs, animation) => {
      const frameOffset = getLoopFrameOffset(SHAKE_FRAME_OFFSETS, elapsedMs, animation);
      const transform = {
        x: frameOffset.x === undefined ? undefined : frameOffset.x * amountX,
        y: frameOffset.y === undefined ? undefined : frameOffset.y * amountY,
      };

      return createFaceExpressionPose(transform);
    },
  };
}

export function createExpressionBubbleEffectFloatClip(
  effectId: string,
  options: { amountY?: number; amountX?: number } = {},
): ExpressionBubbleAnimationClip {
  const amountY = options.amountY ?? 1;
  const amountX = options.amountX ?? 0;

  return {
    id: `${effectId}_float`,
    params: {
      amountX,
      amountY,
      effectId,
    },
    sample: (elapsedMs, animation, clip) => {
      const progress = getClipLoopProgress(elapsedMs, animation, clip);
      const wave = Math.sin(progress * Math.PI * 2);

      return {
        effects: {
          [effectId]: {
            x: snapBubbleMotionValue(wave * amountX),
            y: snapBubbleMotionValue(wave * amountY),
          },
        },
      };
    },
  };
}

export function createExpressionBubbleLaughClip(): ExpressionBubbleAnimationClip {
  return {
    id: 'laugh_bounce',
    params: {
      amountY: LAUGH_BOUNCE_AMOUNT_Y,
      frameOffsets: LAUGH_FRAME_OFFSETS,
    },
    sample: (elapsedMs, animation) => {
      const frameOffset = getLoopFrameOffset(LAUGH_FRAME_OFFSETS, elapsedMs, animation);
      const transform = {
        y: frameOffset.y === undefined ? undefined : frameOffset.y * LAUGH_BOUNCE_AMOUNT_Y,
      };

      return createFaceExpressionPose(transform);
    },
  };
}

function createFaceExpressionPose(transform: ExpressionBubbleTransform): ExpressionBubblePose {
  return {
    face: transform,
    expression: transform,
  };
}

function mergeExpressionBubblePoses(
  firstPose: ExpressionBubblePose,
  secondPose: ExpressionBubblePose,
): ExpressionBubblePose {
  return {
    frame: mergeTransforms(firstPose.frame, secondPose.frame),
    face: mergeTransforms(firstPose.face, secondPose.face),
    expression: mergeTransforms(firstPose.expression, secondPose.expression),
    effects: mergeEffects(firstPose.effects, secondPose.effects),
  };
}

function mergeEffects(
  firstEffects: ExpressionBubblePose['effects'] = {},
  secondEffects: ExpressionBubblePose['effects'] = {},
): ExpressionBubblePose['effects'] {
  const effectIds = new Set([
    ...Object.keys(firstEffects),
    ...Object.keys(secondEffects),
  ]);

  return [...effectIds].reduce<Record<string, ExpressionBubbleTransform>>(
    (mergedEffects, effectId) => ({
      ...mergedEffects,
      [effectId]: mergeTransforms(firstEffects[effectId], secondEffects[effectId]),
    }),
    {},
  );
}

function mergeTransforms(
  firstTransform: ExpressionBubbleTransform = {},
  secondTransform: ExpressionBubbleTransform = {},
): ExpressionBubbleTransform {
  return {
    x: addOptionalNumbers(firstTransform.x, secondTransform.x),
    y: addOptionalNumbers(firstTransform.y, secondTransform.y),
    angle: addOptionalNumbers(firstTransform.angle, secondTransform.angle),
    scale: multiplyOptionalNumbers(firstTransform.scale, secondTransform.scale),
    opacity: multiplyOptionalNumbers(firstTransform.opacity, secondTransform.opacity),
  };
}

function addOptionalNumbers(firstValue: number | undefined, secondValue: number | undefined): number | undefined {
  if (firstValue === undefined) {
    return secondValue;
  }

  if (secondValue === undefined) {
    return firstValue;
  }

  return firstValue + secondValue;
}

function multiplyOptionalNumbers(firstValue: number | undefined, secondValue: number | undefined): number | undefined {
  if (firstValue === undefined) {
    return secondValue;
  }

  if (secondValue === undefined) {
    return firstValue;
  }

  return firstValue * secondValue;
}

function getClipLoopProgress(
  elapsedMs: number,
  animation: ExpressionBubbleAnimation,
  clip: ExpressionBubbleAnimationClip,
): number {
  const durationMs = clip.durationMs ?? clip.intervalMs ?? animation.durationMs;
  return (elapsedMs % durationMs) / durationMs;
}

function getLoopFrameOffset(
  frameOffsets: readonly ExpressionBubbleTransform[],
  elapsedMs: number,
  animation: ExpressionBubbleAnimation,
): ExpressionBubbleTransform {
  const frameIndex = getLoopFrameIndex(elapsedMs, animation);

  return frameOffsets[frameIndex % frameOffsets.length] ?? {};
}

function getLoopFrameIndex(
  elapsedMs: number,
  animation: ExpressionBubbleAnimation,
): number {
  const frameDurationMs = getExpressionBubbleAnimationFrameDurationMs(animation);
  const elapsedLoopMs = ((elapsedMs % animation.durationMs) + animation.durationMs) % animation.durationMs;

  return Math.floor(elapsedLoopMs / frameDurationMs);
}

function snapBubbleMotionValue(value: number): number {
  return Math.round(value);
}

function easeOutBack(progress: number): number {
  const overshoot = 1.35;
  const shifted = progress - 1;

  return 1 + (overshoot + 1) * Math.pow(shifted, 3) + overshoot * Math.pow(shifted, 2);
}
