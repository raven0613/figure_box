import type {
  MiniAnimation,
  MiniAnimationClip,
  MiniPose,
  MiniPoseNodeKey,
  MiniTransform,
} from './miniAvatarTypes';

// 取樣/clip 工具，之後新增動畫時會是「definition 檔新增一筆資料 + clip 工具組合」

const WAVE_BODY_BOB_Y = 0.8;
const WAVE_HEAD_BOB_Y = 0.5;
const WAVE_RIGHT_ARM_BASE_ANGLE = -60;
const WAVE_RIGHT_ARM_SWING_ANGLE = 36;
const WAVE_RIGHT_ARM_OFFSET_X = 5;
const WAVE_RIGHT_ARM_OFFSET_Y = 0;
const BLINK_START_MS = 430;
const BLINK_CLOSE_MS = 110;
const BLINK_HOLD_MS = 90;
const BLINK_OPEN_MS = 130;
const BLINK_UPPER_EYELID_OFFSET_Y = 7;

export function sampleMiniAnimation(animation: MiniAnimation, elapsedMs: number): MiniPose {
  return animation.clips.reduce<MiniPose>(
    (combinedPose, clip) => mergeMiniPoses(combinedPose, clip.sample(elapsedMs, animation)),
    {},
  );
}

export function getMiniAnimationFrameCount(animation: MiniAnimation): number {
  return Math.max(1, Math.round(animation.durationMs / 1000 * animation.fps));
}

export function getMiniAnimationFrameDurationMs(animation: MiniAnimation): number {
  return animation.durationMs / getMiniAnimationFrameCount(animation);
}

export function createMiniWaveClip(): MiniAnimationClip {
  return {
    sample: (elapsedMs, animation) => {
      const progress = getLoopProgress(elapsedMs, animation.durationMs);
      const wavePhase = Math.sin(progress * Math.PI * 2);
      const bobPhase = Math.sin(progress * Math.PI * 2 + Math.PI / 5);

      return {
        nodes: {
          body: { y: snapMiniMotionValue(bobPhase * WAVE_BODY_BOB_Y) },
          head: { y: snapMiniMotionValue(bobPhase * WAVE_HEAD_BOB_Y) },
          rightArm: {
            x: WAVE_RIGHT_ARM_OFFSET_X,
            y: WAVE_RIGHT_ARM_OFFSET_Y,
            angle: WAVE_RIGHT_ARM_BASE_ANGLE + wavePhase * WAVE_RIGHT_ARM_SWING_ANGLE,
          },
          leftArm: {
            angle: -wavePhase * 3,
          },
        },
      };
    },
  };
}

export function createMiniBlinkClip(): MiniAnimationClip {
  return {
    sample: (elapsedMs, animation) => {
      const blinkAmount = getBlinkAmount(elapsedMs, animation.durationMs);

      if (blinkAmount <= 0) {
        return {};
      }

      return {
        eyeExpression: blinkAmount >= 0.95 ? 'smileBlink' : 'default',
        nodes: {
          upperEyelid: {
            y: snapMiniMotionValue(blinkAmount * BLINK_UPPER_EYELID_OFFSET_Y),
          },
          eyelid: {
            y: snapMiniMotionValue(blinkAmount * BLINK_UPPER_EYELID_OFFSET_Y),
          },
        },
      };
    },
  };
}

function mergeMiniPoses(firstPose: MiniPose, secondPose: MiniPose): MiniPose {
  return {
    nodes: mergeMiniPoseNodes(firstPose.nodes, secondPose.nodes),
    eyeExpression: secondPose.eyeExpression ?? firstPose.eyeExpression,
  };
}

function mergeMiniPoseNodes(
  firstNodes: MiniPose['nodes'] = {},
  secondNodes: MiniPose['nodes'] = {},
): MiniPose['nodes'] {
  const nodeKeys = new Set<MiniPoseNodeKey>([
    ...(Object.keys(firstNodes) as MiniPoseNodeKey[]),
    ...(Object.keys(secondNodes) as MiniPoseNodeKey[]),
  ]);

  return [...nodeKeys].reduce<MiniPose['nodes']>((mergedNodes, nodeKey) => ({
    ...mergedNodes,
    [nodeKey]: mergeMiniTransforms(firstNodes[nodeKey], secondNodes[nodeKey]),
  }), {});
}

function mergeMiniTransforms(
  firstTransform: MiniTransform = {},
  secondTransform: MiniTransform = {},
): MiniTransform {
  return {
    x: addOptionalNumbers(firstTransform.x, secondTransform.x),
    y: addOptionalNumbers(firstTransform.y, secondTransform.y),
    angle: addOptionalNumbers(firstTransform.angle, secondTransform.angle),
    scale: multiplyOptionalNumbers(firstTransform.scale, secondTransform.scale),
    flipX: secondTransform.flipX ?? firstTransform.flipX,
    zIndexOffset: addOptionalNumbers(firstTransform.zIndexOffset, secondTransform.zIndexOffset),
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

function getLoopProgress(elapsedMs: number, durationMs: number): number {
  return (elapsedMs % durationMs) / durationMs;
}

function getBlinkAmount(elapsedMs: number, durationMs: number): number {
  const loopElapsedMs = elapsedMs % durationMs;
  const closeEndMs = BLINK_START_MS + BLINK_CLOSE_MS;
  const holdEndMs = closeEndMs + BLINK_HOLD_MS;
  const openEndMs = holdEndMs + BLINK_OPEN_MS;

  if (loopElapsedMs < BLINK_START_MS || loopElapsedMs > openEndMs) {
    return 0;
  }

  if (loopElapsedMs <= closeEndMs) {
    return easeInOutSine((loopElapsedMs - BLINK_START_MS) / BLINK_CLOSE_MS);
  }

  if (loopElapsedMs <= holdEndMs) {
    return 1;
  }

  return 1 - easeInOutSine((loopElapsedMs - holdEndMs) / BLINK_OPEN_MS);
}

function easeInOutSine(progress: number): number {
  return -(Math.cos(Math.PI * progress) - 1) / 2;
}

function snapMiniMotionValue(value: number): number {
  return Math.round(value * 2) / 2;
}
