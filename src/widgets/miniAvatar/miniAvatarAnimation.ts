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
const WALK_BODY_BOB_Y = 1;
const WALK_LEG_LIFT_Y = 3;
const WALK_LEG_SPREAD_X = 0; // 負數看起來像往左下走，正數看起來像往右下走
const WALK_ARM_SWING_ANGLE = 5;
const DEFAULT_BLINK_START_MS = 430;
const BLINK_CLOSE_MS = 110;
const BLINK_HOLD_MS = 90;
const BLINK_OPEN_MS = 130;
const BLINK_UPPER_EYELID_OFFSET_Y = 7;

export function sampleMiniAnimation(animation: MiniAnimation, elapsedMs: number): MiniPose {
  return animation.clips.reduce<MiniPose>(
    (combinedPose, clip) => mergeMiniPoses(combinedPose, clip.sample(elapsedMs, animation, clip)),
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
    id: 'wave',
    sample: (elapsedMs, animation, clip) => {
      const progress = getClipLoopProgress(elapsedMs, animation, clip);
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

export function createMiniWalkFrontClip(): MiniAnimationClip {
  return {
    id: 'walk_front',
    durationMs: 700,
    sample: (elapsedMs, animation, clip) => {
      const progress = getClipLoopProgress(elapsedMs, animation, clip);
      const stridePhase = Math.sin(progress * Math.PI * 2);
      const stepPhase = Math.cos(progress * Math.PI * 4);
      const wholeBodyBobY = snapMiniMotionValue((1 - Math.abs(stepPhase)) * -WALK_BODY_BOB_Y);
      const leftLegLiftY = snapMiniMotionValue(Math.max(0, stridePhase) * -WALK_LEG_LIFT_Y);
      const rightLegLiftY = snapMiniMotionValue(Math.max(0, -stridePhase) * -WALK_LEG_LIFT_Y);

      return {
        nodes: {
          body: { y: wholeBodyBobY },
          head: { y: wholeBodyBobY },
          leftLeg: {
            x: snapMiniMotionValue(-stridePhase * WALK_LEG_SPREAD_X),
            y: leftLegLiftY,
          },
          rightLeg: {
            x: snapMiniMotionValue(stridePhase * WALK_LEG_SPREAD_X),
            y: rightLegLiftY,
          },
          leftArm: {
            angle: stridePhase * WALK_ARM_SWING_ANGLE,
          },
          rightArm: {
            angle: -stridePhase * WALK_ARM_SWING_ANGLE,
          },
        },
      };
    },
  };
}

export function createMiniBlinkClip(options: { intervalMs?: number; startOffsetMs?: number } = {}): MiniAnimationClip {
  return {
    id: 'blink',
    durationMs: BLINK_CLOSE_MS + BLINK_HOLD_MS + BLINK_OPEN_MS,
    intervalMs: options.intervalMs,
    startOffsetMs: options.startOffsetMs,
    sample: (elapsedMs, animation, clip) => {
      const blinkAmount = getBlinkAmount(elapsedMs, animation, clip);

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

function getClipLoopProgress(elapsedMs: number, animation: MiniAnimation, clip: MiniAnimationClip): number {
  const durationMs = clip.durationMs ?? animation.durationMs;
  return (elapsedMs % durationMs) / durationMs;
}

function getBlinkAmount(elapsedMs: number, animation: MiniAnimation, clip: MiniAnimationClip): number {
  const durationMs = clip.durationMs ?? BLINK_CLOSE_MS + BLINK_HOLD_MS + BLINK_OPEN_MS;
  const intervalMs = clip.intervalMs ?? animation.durationMs;
  const startOffsetMs = clip.startOffsetMs ?? DEFAULT_BLINK_START_MS;
  const loopElapsedMs = (elapsedMs - startOffsetMs + intervalMs) % intervalMs;
  const closeEndMs = BLINK_CLOSE_MS;
  const holdEndMs = closeEndMs + BLINK_HOLD_MS;
  const openEndMs = holdEndMs + BLINK_OPEN_MS;

  if (loopElapsedMs > openEndMs || loopElapsedMs > durationMs) {
    return 0;
  }

  if (loopElapsedMs <= closeEndMs) {
    return easeInOutSine(loopElapsedMs / BLINK_CLOSE_MS);
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
