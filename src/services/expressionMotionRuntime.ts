import { getExpressionMotionDefinition } from '~/constants/expressionCatalog';
import type {
  ExpressionChannelKey,
  ExpressionEasing,
  ExpressionMotionDefinition,
  ExpressionMotionKeyframe,
  ExpressionRenderProfile,
  ExpressionTransform,
} from '~/typing/expression';

export type ExpressionMotionFrame = Partial<Record<ExpressionChannelKey, ExpressionTransform>>;

interface ExpressionMotionRuntimeInput {
  profile: ExpressionRenderProfile;
  onFrame: (frame: ExpressionMotionFrame) => void;
}

interface ActiveChannelMotion {
  channel: ExpressionChannelKey;
  definition: ExpressionMotionDefinition;
}

const CHANNEL_KEYS: readonly ExpressionChannelKey[] = [
  'face',
  'eyes',
  'upperEyelids',
  'eyeballs',
  'eyebrows',
  'mouth',
];
const TRANSFORM_KEYS = [
  'offsetX',
  'offsetY',
  'rotate',
  'scale',
  'opacity',
] as const;

type ExpressionTransformKey = typeof TRANSFORM_KEYS[number];

export class ExpressionMotionRuntime {
  private frameId: number | null = null;
  private runVersion = 0;

  play(input: ExpressionMotionRuntimeInput): void {
    this.cancel();

    const channelMotions = getActiveChannelMotions(input.profile);

    if (channelMotions.length === 0) {
      input.onFrame({});
      return;
    }

    const runVersion = this.runVersion;
    const startedAt = performance.now();

    const animate = (timestamp: number) => {
      if (runVersion !== this.runVersion) {
        return;
      }

      const elapsedMs = Math.max(0, timestamp - startedAt);
      const frame = Object.fromEntries(
        channelMotions.map(({ channel, definition }) => [
          channel,
          sampleExpressionMotion(definition, elapsedMs),
        ]),
      ) as ExpressionMotionFrame;

      input.onFrame(frame);

      if (hasActiveMotion(channelMotions, elapsedMs)) {
        this.frameId = window.requestAnimationFrame(animate);
        return;
      }

      this.frameId = null;
    };

    this.frameId = window.requestAnimationFrame(animate);
  }

  cancel(): void {
    this.runVersion += 1;

    if (this.frameId === null) {
      return;
    }

    window.cancelAnimationFrame(this.frameId);
    this.frameId = null;
  }
}

export function sampleExpressionMotion(
  definition: ExpressionMotionDefinition,
  elapsedMs: number,
): ExpressionTransform {
  const motionElapsedMs = definition.loop && definition.durationMs > 0
    ? elapsedMs % definition.durationMs
    : Math.min(elapsedMs, definition.durationMs);

  return TRANSFORM_KEYS.reduce<ExpressionTransform>((transform, key) => {
    const value = sampleTransformValue(definition.keyframes, key, motionElapsedMs);

    return value === undefined
      ? transform
      : {
        ...transform,
        [key]: value,
      };
  }, {});
}

function getActiveChannelMotions(
  profile: ExpressionRenderProfile,
): ActiveChannelMotion[] {
  return CHANNEL_KEYS.flatMap(channel => {
    const motionId = profile[channel]?.motionId;
    const definition = motionId
      ? getExpressionMotionDefinition(motionId)
      : null;

    return definition
      ? [{ channel, definition }]
      : [];
  });
}

function hasActiveMotion(
  channelMotions: readonly ActiveChannelMotion[],
  elapsedMs: number,
): boolean {
  return channelMotions.some(({ definition }) => (
    definition.loop === true || elapsedMs < definition.durationMs
  ));
}

function sampleTransformValue(
  keyframes: readonly ExpressionMotionKeyframe[],
  key: ExpressionTransformKey,
  elapsedMs: number,
): number | undefined {
  const valueKeyframes = keyframes.filter(keyframe => keyframe[key] !== undefined);

  if (valueKeyframes.length === 0) {
    return undefined;
  }

  const previous = findPreviousKeyframe(valueKeyframes, elapsedMs);
  const next = valueKeyframes.find(keyframe => keyframe.atMs > elapsedMs);

  if (!next) {
    return previous[key];
  }

  const previousValue = previous[key] ?? getDefaultTransformValue(key);
  const nextValue = next[key] ?? previousValue;
  const segmentDurationMs = next.atMs - previous.atMs;

  if (segmentDurationMs <= 0) {
    return nextValue;
  }

  const progress = Math.min(1, Math.max(0, (elapsedMs - previous.atMs) / segmentDurationMs));
  const easedProgress = applyEasing(progress, next.easing);

  return previousValue + (nextValue - previousValue) * easedProgress;
}

function findPreviousKeyframe(
  keyframes: readonly ExpressionMotionKeyframe[],
  elapsedMs: number,
): ExpressionMotionKeyframe {
  for (let index = keyframes.length - 1; index >= 0; index -= 1) {
    if (keyframes[index].atMs <= elapsedMs) {
      return keyframes[index];
    }
  }

  return {
    atMs: 0,
  };
}

function getDefaultTransformValue(key: ExpressionTransformKey): number {
  return key === 'scale' || key === 'opacity' ? 1 : 0;
}

function applyEasing(progress: number, easing: ExpressionEasing | undefined): number {
  if (easing === 'easeInOutSine') {
    return -(Math.cos(Math.PI * progress) - 1) / 2;
  }

  if (easing === 'easeOutCubic') {
    return 1 - ((1 - progress) ** 3);
  }

  return progress;
}
