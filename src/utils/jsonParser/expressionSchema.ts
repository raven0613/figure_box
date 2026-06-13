import type {
  ExpressionChannelDefinition,
  ExpressionEasing,
  ExpressionMotionDefinition,
  ExpressionMotionKeyframe,
  ExpressionPresetDefinition,
  ExpressionRenderProfile,
  ExpressionTransform,
  MiniExpressionProfiles,
} from '~/typing/expression';
import {
  includesString,
  isRecord,
  readRequiredNonNegativeNumber,
  readRequiredString,
} from './schemaReaders';

const VALID_EASINGS = [
  'linear',
  'easeInOutSine',
  'easeOutCubic',
] as const;
const PROFILE_CHANNEL_KEYS = [
  'face',
  'eyes',
  'upperEyelids',
  'eyeballs',
  'eyebrows',
  'mouth',
] as const;
const TRANSFORM_KEYS = [
  'offsetX',
  'offsetY',
  'rotate',
  'scale',
  'opacity',
] as const;

type ExpressionRecord = Record<string, unknown>;

export function loadExpressionMotionDefinitions(rawDefinitions: unknown): ExpressionMotionDefinition[] {
  if (!Array.isArray(rawDefinitions)) {
    throw new Error('Expression motion definitions must be an array.');
  }

  const definitions = rawDefinitions.map(readExpressionMotionDefinition);
  assertUniqueIds(definitions, 'expressionPresetId motion');

  return definitions;
}

export function loadExpressionPresetDefinitions(
  rawDefinitions: unknown,
  motionIds: ReadonlySet<string>,
): ExpressionPresetDefinition[] {
  if (!Array.isArray(rawDefinitions)) {
    throw new Error('Expression preset definitions must be an array.');
  }

  const definitions = rawDefinitions.map((definition, index) => (
    readExpressionPresetDefinition(definition, index, motionIds)
  ));
  assertUniqueIds(definitions, 'expressionPresetId preset');

  return definitions;
}

function readExpressionMotionDefinition(
  value: unknown,
  index: number,
): ExpressionMotionDefinition {
  if (!isRecord(value)) {
    throw new Error(`Expression motion definition at index ${index} must be an object.`);
  }

  const keyframes = value.keyframes;

  if (!Array.isArray(keyframes) || keyframes.length === 0) {
    throw new Error(`Expression motion definition at index ${index} must include keyframes.`);
  }

  const parsedKeyframes = keyframes.map((keyframe, keyframeIndex) => (
    readExpressionMotionKeyframe(keyframe, index, keyframeIndex)
  ));
  const durationMs = readRequiredNonNegativeNumber(value, 'durationMs', index);

  parsedKeyframes.forEach(keyframe => {
    if (keyframe.atMs > durationMs) {
      throw new Error(
        `Expression motion definition at index ${index} has a keyframe beyond durationMs.`,
      );
    }
  });

  return {
    id: readRequiredString(value, 'id', index),
    durationMs,
    loop: readOptionalBoolean(value, 'loop', index),
    keyframes: [...parsedKeyframes].sort((first, second) => first.atMs - second.atMs),
  };
}

function readExpressionMotionKeyframe(
  value: unknown,
  definitionIndex: number,
  keyframeIndex: number,
): ExpressionMotionKeyframe {
  if (!isRecord(value)) {
    throw new Error(
      `Expression motion definition at index ${definitionIndex} has invalid keyframes[${keyframeIndex}].`,
    );
  }

  const easingValue = value.easing;

  if (
    easingValue !== undefined &&
    (typeof easingValue !== 'string' || !includesString(VALID_EASINGS, easingValue))
  ) {
    throw new Error(
      `Expression motion definition at index ${definitionIndex} has invalid easing.`,
    );
  }

  return {
    atMs: readRequiredNonNegativeNumber(value, 'atMs', definitionIndex),
    ...readExpressionTransform(value, definitionIndex),
    easing: easingValue as ExpressionEasing | undefined,
  };
}

function readExpressionPresetDefinition(
  value: unknown,
  index: number,
  motionIds: ReadonlySet<string>,
): ExpressionPresetDefinition {
  if (!isRecord(value)) {
    throw new Error(`Expression preset definition at index ${index} must be an object.`);
  }

  return {
    id: readRequiredString(value, 'id', index),
    label: readRequiredString(value, 'label', index),
    portrait: readExpressionProfile(value.portrait, index, 'portrait', motionIds),
    mini: readMiniExpressionProfiles(value.mini, index, motionIds),
  };
}

function readMiniExpressionProfiles(
  value: unknown,
  index: number,
  motionIds: ReadonlySet<string>,
): MiniExpressionProfiles {
  if (!isRecord(value)) {
    throw new Error(`Expression preset definition at index ${index} must include mini.`);
  }

  return {
    front: readOptionalExpressionProfile(value.front, index, 'mini.front', motionIds),
    side: readOptionalExpressionProfile(value.side, index, 'mini.side', motionIds),
    back: readOptionalExpressionProfile(value.back, index, 'mini.back', motionIds),
  };
}

function readOptionalExpressionProfile(
  value: unknown,
  index: number,
  path: string,
  motionIds: ReadonlySet<string>,
): ExpressionRenderProfile | undefined {
  if (value === undefined) {
    return undefined;
  }

  return readExpressionProfile(value, index, path, motionIds);
}

function readExpressionProfile(
  value: unknown,
  index: number,
  path: string,
  motionIds: ReadonlySet<string>,
): ExpressionRenderProfile {
  if (!isRecord(value)) {
    throw new Error(`Expression preset definition at index ${index} has invalid ${path}.`);
  }

  const profile = PROFILE_CHANNEL_KEYS.reduce<ExpressionRenderProfile>((result, key) => {
    const channel = readOptionalExpressionChannel(value[key], index, `${path}.${key}`, motionIds);

    return channel
      ? {
        ...result,
        [key]: channel,
      }
      : result;
  }, {});

  return {
    ...profile,
    effectId: readOptionalString(value, 'effectId', index),
    emoteId: readOptionalString(value, 'emoteId', index),
  };
}

function readOptionalExpressionChannel(
  value: unknown,
  index: number,
  path: string,
  motionIds: ReadonlySet<string>,
): ExpressionChannelDefinition | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error(`Expression preset definition at index ${index} has invalid ${path}.`);
  }

  const motionId = readOptionalString(value, 'motionId', index);

  if (motionId && !motionIds.has(motionId)) {
    throw new Error(
      `Expression preset definition at index ${index} references unknown motion "${motionId}".`,
    );
  }

  return {
    poseId: readOptionalString(value, 'poseId', index),
    transform: value.transform === undefined
      ? undefined
      : readExpressionTransformRecord(value.transform, index, `${path}.transform`),
    motionId,
  };
}

function readExpressionTransformRecord(
  value: unknown,
  index: number,
  path: string,
): ExpressionTransform {
  if (!isRecord(value)) {
    throw new Error(`Expression preset definition at index ${index} has invalid ${path}.`);
  }

  return readExpressionTransform(value, index);
}

function readExpressionTransform(
  value: ExpressionRecord,
  index: number,
): ExpressionTransform {
  return TRANSFORM_KEYS.reduce<ExpressionTransform>((transform, key) => {
    const transformValue = value[key];

    if (transformValue === undefined) {
      return transform;
    }

    if (typeof transformValue !== 'number' || !Number.isFinite(transformValue)) {
      throw new Error(`Expression definition at index ${index} has invalid ${key}.`);
    }

    return {
      ...transform,
      [key]: transformValue,
    };
  }, {});
}

function readOptionalString(
  value: ExpressionRecord,
  key: string,
  index: number,
): string | undefined {
  const property = value[key];

  if (property === undefined) {
    return undefined;
  }

  if (typeof property !== 'string' || property.length === 0) {
    throw new Error(`Expression definition at index ${index} has invalid ${key}.`);
  }

  return property;
}

function readOptionalBoolean(
  value: ExpressionRecord,
  key: string,
  index: number,
): boolean | undefined {
  const property = value[key];

  if (property === undefined) {
    return undefined;
  }

  if (typeof property !== 'boolean') {
    throw new Error(`Expression definition at index ${index} has invalid ${key}.`);
  }

  return property;
}

function assertUniqueIds(
  definitions: readonly { id: string }[],
  label: string,
): void {
  const ids = new Set<string>();

  definitions.forEach(definition => {
    if (ids.has(definition.id)) {
      throw new Error(`Duplicate ${label} id "${definition.id}".`);
    }

    ids.add(definition.id);
  });
}
