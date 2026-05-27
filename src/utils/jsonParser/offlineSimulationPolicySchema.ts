import type { CharacterRequestLevel } from '~/services/characterRequests/types';
import type { CharacterEventActivityType } from '~/constants/charactarEventsDefinitions';
import type {
  OfflineEventPolicyRule,
  OfflineRecapMode,
  OfflineRecapDisplayOrderMode,
  OfflineRequestLevelPolicy,
  OfflineRequestMode,
  OfflineSimulationPolicy,
} from '~/services/offlineSimulation/types';
import {
  includesString,
  isRecord,
  readRequiredNonNegativeNumber,
  readRequiredNumber,
  type CharacterEventDefinitionRecord,
} from './schemaReaders';

const VALID_BUCKET_IDS = ['baseline', 'need', 'environment', 'global'] as const;
const VALID_MOTIVATIONS = ['idle', 'findFood', 'rest', 'play', 'chat', 'goHome'] as const;
const VALID_RECAP_MODES = ['none', 'auto', 'always'] as const;
const VALID_REQUEST_LEVELS = ['critical', 'social', 'minor'] as const;
const VALID_REQUEST_MODES = ['allow', 'pendingOnly', 'disabled'] as const;
const VALID_ACTIVITY_TYPES = ['chat', 'playWithItem', 'playAtLocation'] as const;
const VALID_RECAP_DISPLAY_ORDER_MODES = ['timestamp', 'timeBucketShuffle'] as const;
const MINUTES_PER_DAY = 24 * 60;

export function loadOfflineSimulationPolicy(rawPolicy: unknown): OfflineSimulationPolicy {
  if (!isRecord(rawPolicy)) {
    throw new Error('Offline simulation policy must be an object.');
  }

  const events = readRequiredRecord(rawPolicy, 'events');

  return {
    version: readRequiredNumber(rawPolicy, 'version', 0),
    elapsedTime: readElapsedTimePolicy(readRequiredRecord(rawPolicy, 'elapsedTime')),
    limits: readLimitsPolicy(readRequiredRecord(rawPolicy, 'limits')),
    perception: readPerceptionPolicy(readRequiredRecord(rawPolicy, 'perception')),
    timeOfDay: readTimeOfDayPolicy(readRequiredRecord(rawPolicy, 'timeOfDay')),
    resolutionEffects: readResolutionEffectsPolicy(readRequiredRecord(rawPolicy, 'resolutionEffects')),
    events: {
      default: readRequiredEventPolicyRule(readRequiredRecord(events, 'default'), 'events.default'),
      bucket: readEventPolicyRuleMap(
        readRequiredRecord(events, 'bucket'),
        VALID_BUCKET_IDS,
        'events.bucket',
      ),
      motivation: readEventPolicyRuleMap(
        readRequiredRecord(events, 'motivation'),
        VALID_MOTIVATIONS,
        'events.motivation',
      ),
      eventOverrides: readEventOverridePolicyMap(readRequiredRecord(events, 'eventOverrides')),
    },
    requests: {
      level: readRequestLevelPolicyMap(readRequiredRecord(readRequiredRecord(rawPolicy, 'requests'), 'level')),
    },
    recap: readRecapPolicy(readRequiredRecord(rawPolicy, 'recap')),
  };
}

function readLimitsPolicy(value: CharacterEventDefinitionRecord): OfflineSimulationPolicy['limits'] {
  return {
    maxEventsPerCharacter: readPositiveNumber(value, 'maxEventsPerCharacter', 'limits'),
    maxCandidatesPerCharacter: readPositiveNumber(value, 'maxCandidatesPerCharacter', 'limits'),
  };
}

function readPerceptionPolicy(value: CharacterEventDefinitionRecord): OfflineSimulationPolicy['perception'] {
  return {
    nearbyCharacterFallbackRange: readRequiredNonNegativeNumber(value, 'nearbyCharacterFallbackRange', 0),
    itemVisibilityRadius: readRequiredNonNegativeNumber(value, 'itemVisibilityRadius', 0),
  };
}

function readTimeOfDayPolicy(value: CharacterEventDefinitionRecord): OfflineSimulationPolicy['timeOfDay'] {
  const buckets = readTimeOfDayBuckets(value);

  assertUniqueTimeOfDayBucketIds(buckets);

  return { buckets };
}

function readTimeOfDayBuckets(
  value: CharacterEventDefinitionRecord,
): OfflineSimulationPolicy['timeOfDay']['buckets'] {
  const buckets = value.buckets;

  if (!Array.isArray(buckets) || !buckets.every(isRecord)) {
    throw new Error('Offline simulation policy timeOfDay.buckets must be an array of objects.');
  }

  return buckets.map((bucket, index) => ({
    id: readNonEmptyString(bucket, 'id', `timeOfDay.buckets[${String(index)}]`),
    startMinute: readMinuteOfDay(bucket, 'startMinute', `timeOfDay.buckets[${String(index)}]`),
    endMinute: readMinuteOfDay(bucket, 'endMinute', `timeOfDay.buckets[${String(index)}]`),
  }));
}

function assertUniqueTimeOfDayBucketIds(
  buckets: OfflineSimulationPolicy['timeOfDay']['buckets'],
): void {
  const seenIds = new Set<string>();

  buckets.forEach(bucket => {
    if (seenIds.has(bucket.id)) {
      throw new Error(`Offline simulation policy timeOfDay.buckets has duplicate id "${bucket.id}".`);
    }

    seenIds.add(bucket.id);
  });
}

function readResolutionEffectsPolicy(
  value: CharacterEventDefinitionRecord,
): OfflineSimulationPolicy['resolutionEffects'] {
  return {
    goEatSaturationDelta: readRequiredNumber(value, 'goEatSaturationDelta', 0),
    goRestMoodValueDelta: readRequiredNumber(value, 'goRestMoodValueDelta', 0),
    goPlayMoodValueDelta: readRequiredNumber(value, 'goPlayMoodValueDelta', 0),
    goPlayPlayNeedDelta: readRequiredNumber(value, 'goPlayPlayNeedDelta', 0),
    homeFoodSaturationDelta: readRequiredNumber(value, 'homeFoodSaturationDelta', 0),
    homePlayMoodValueDelta: readRequiredNumber(value, 'homePlayMoodValueDelta', 0),
    homePlayPlayNeedDelta: readRequiredNumber(value, 'homePlayPlayNeedDelta', 0),
  };
}

function readElapsedTimePolicy(value: CharacterEventDefinitionRecord): OfflineSimulationPolicy['elapsedTime'] {
  return {
    ignoreBelowMs: readRequiredNonNegativeNumber(value, 'ignoreBelowMs', 0),
    maxSimulatedMs: readRequiredNonNegativeNumber(value, 'maxSimulatedMs', 0),
    slotDurationMs: readPositiveNumber(value, 'slotDurationMs', 'elapsedTime'),
    maxSlots: readPositiveNumber(value, 'maxSlots', 'elapsedTime'),
  };
}

function readRequiredEventPolicyRule(
  value: CharacterEventDefinitionRecord,
  label: string,
): Required<OfflineEventPolicyRule> {
  const rule = readEventPolicyRule(value, label);

  return {
    enabled: rule.enabled ?? true,
    weightMultiplier: rule.weightMultiplier ?? 1,
    recap: rule.recap ?? 'auto',
    maxPerReturn: rule.maxPerReturn ?? Number.POSITIVE_INFINITY,
  };
}

function readEventPolicyRule(
  value: CharacterEventDefinitionRecord,
  label: string,
): OfflineEventPolicyRule {
  return {
    enabled: readOptionalBoolean(value, 'enabled', label),
    weightMultiplier: readOptionalNonNegativeNumber(value, 'weightMultiplier', label),
    recap: readOptionalRecapMode(value, 'recap', label),
    maxPerReturn: readOptionalNonNegativeNumber(value, 'maxPerReturn', label),
  };
}

function readEventPolicyRuleMap<T extends string>(
  value: CharacterEventDefinitionRecord,
  validKeys: readonly T[],
  label: string,
): Partial<Record<T, OfflineEventPolicyRule>> {
  return Object.fromEntries(
    Object.entries(value).map(([key, rule]) => {
      if (!includesString(validKeys, key)) {
        throw new Error(`Offline simulation policy has invalid ${label} key "${key}".`);
      }

      if (!isRecord(rule)) {
        throw new Error(`Offline simulation policy ${label}.${key} must be an object.`);
      }

      return [key, readEventPolicyRule(rule, `${label}.${key}`)];
    }),
  ) as Partial<Record<T, OfflineEventPolicyRule>>;
}

function readEventOverridePolicyMap(
  value: CharacterEventDefinitionRecord,
): Record<string, OfflineEventPolicyRule> {
  return Object.fromEntries(
    Object.entries(value).map(([key, rule]) => {
      if (!isRecord(rule)) {
        throw new Error(`Offline simulation policy events.eventOverrides.${key} must be an object.`);
      }

      return [key, readEventPolicyRule(rule, `events.eventOverrides.${key}`)];
    }),
  );
}

function readRequestLevelPolicyMap(
  value: CharacterEventDefinitionRecord,
): Record<CharacterRequestLevel, OfflineRequestLevelPolicy> {
  const policies = Object.fromEntries(
    VALID_REQUEST_LEVELS.map(level => {
      const policy = value[level];

      if (!isRecord(policy)) {
        throw new Error(`Offline simulation policy requests.level.${level} must be an object.`);
      }

      return [level, readRequestLevelPolicy(policy, `requests.level.${level}`)];
    }),
  ) as Record<CharacterRequestLevel, OfflineRequestLevelPolicy>;

  Object.keys(value).forEach(key => {
    if (!includesString(VALID_REQUEST_LEVELS, key)) {
      throw new Error(`Offline simulation policy has invalid requests.level key "${key}".`);
    }
  });

  return policies;
}

function readRequestLevelPolicy(
  value: CharacterEventDefinitionRecord,
  label: string,
): OfflineRequestLevelPolicy {
  return {
    mode: readRequestMode(value, 'mode', label),
    weightMultiplier: readOptionalNonNegativeNumber(value, 'weightMultiplier', label),
    maxPerReturn: readOptionalNonNegativeNumber(value, 'maxPerReturn', label),
  };
}

function readRecapPolicy(value: CharacterEventDefinitionRecord): OfflineSimulationPolicy['recap'] {
  return {
    maxItems: readRequiredNonNegativeNumber(value, 'maxItems', 0),
    maxDetailedItems: readRequiredNonNegativeNumber(value, 'maxDetailedItems', 0),
    preferredMultiplayerItems: readRequiredNonNegativeNumber(value, 'preferredMultiplayerItems', 0),
    preferredSoloItems: readRequiredNonNegativeNumber(value, 'preferredSoloItems', 0),
    displayOrder: readRecapDisplayOrderPolicy(readRequiredRecord(value, 'displayOrder')),
    displayScore: readRecapDisplayScorePolicy(readRequiredRecord(value, 'displayScore')),
  };
}

function readRecapDisplayOrderPolicy(
  value: CharacterEventDefinitionRecord,
): OfflineSimulationPolicy['recap']['displayOrder'] {
  return {
    mode: readRecapDisplayOrderMode(value, 'mode', 'recap.displayOrder'),
  };
}

function readRecapDisplayScorePolicy(
  value: CharacterEventDefinitionRecord,
): OfflineSimulationPolicy['recap']['displayScore'] {
  return {
    base: readRequiredNumber(value, 'base', 0),
    multiplayerBonus: readRequiredNumber(value, 'multiplayerBonus', 0),
    participantBonus: readRequiredNumber(value, 'participantBonus', 0),
    activityType: readActivityTypeScoreMap(readRequiredRecord(value, 'activityType')),
    detailBonus: readRequiredNumber(value, 'detailBonus', 0),
    quoteBonus: readRequiredNumber(value, 'quoteBonus', 0),
  };
}

function readActivityTypeScoreMap(
  value: CharacterEventDefinitionRecord,
): Partial<Record<CharacterEventActivityType, number>> {
  return Object.fromEntries(
    Object.entries(value).map(([key, score]) => {
      if (!includesString(VALID_ACTIVITY_TYPES, key)) {
        throw new Error(`Offline simulation policy recap.displayScore.activityType has invalid key "${key}".`);
      }

      if (typeof score !== 'number' || !Number.isFinite(score)) {
        throw new Error(`Offline simulation policy recap.displayScore.activityType.${key} must be a number.`);
      }

      return [key, score];
    }),
  ) as Partial<Record<CharacterEventActivityType, number>>;
}

function readRequiredRecord(
  definition: CharacterEventDefinitionRecord,
  key: string,
): CharacterEventDefinitionRecord {
  const value = definition[key];

  if (!isRecord(value)) {
    throw new Error(`Offline simulation policy must include object ${key}.`);
  }

  return value;
}

function readPositiveNumber(
  definition: CharacterEventDefinitionRecord,
  key: string,
  label: string,
): number {
  const value = readRequiredNonNegativeNumber(definition, key, 0);

  if (value <= 0) {
    throw new Error(`Offline simulation policy ${label}.${key} must be greater than 0.`);
  }

  return value;
}

function readMinuteOfDay(
  definition: CharacterEventDefinitionRecord,
  key: string,
  label: string,
): number {
  const value = readRequiredNonNegativeNumber(definition, key, 0);

  if (value > MINUTES_PER_DAY) {
    throw new Error(`Offline simulation policy ${label}.${key} must be 0 to ${String(MINUTES_PER_DAY)}.`);
  }

  return value;
}

function readNonEmptyString(
  definition: CharacterEventDefinitionRecord,
  key: string,
  label: string,
): string {
  const value = definition[key];

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Offline simulation policy ${label}.${key} must be a non-empty string.`);
  }

  return value;
}

function readOptionalBoolean(
  definition: CharacterEventDefinitionRecord,
  key: string,
  label: string,
): boolean | undefined {
  const value = definition[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'boolean') {
    throw new Error(`Offline simulation policy ${label}.${key} must be a boolean.`);
  }

  return value;
}

function readOptionalNonNegativeNumber(
  definition: CharacterEventDefinitionRecord,
  key: string,
  label: string,
): number | undefined {
  const value = definition[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`Offline simulation policy ${label}.${key} must be a non-negative number.`);
  }

  return value;
}

function readOptionalRecapMode(
  definition: CharacterEventDefinitionRecord,
  key: string,
  label: string,
): OfflineRecapMode | undefined {
  const value = definition[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || !includesString(VALID_RECAP_MODES, value)) {
    throw new Error(`Offline simulation policy ${label}.${key} has invalid recap mode "${String(value)}".`);
  }

  return value;
}

function readRecapDisplayOrderMode(
  definition: CharacterEventDefinitionRecord,
  key: string,
  label: string,
): OfflineRecapDisplayOrderMode {
  const value = definition[key];

  if (typeof value !== 'string' || !includesString(VALID_RECAP_DISPLAY_ORDER_MODES, value)) {
    throw new Error(`Offline simulation policy ${label}.${key} has invalid display order mode "${String(value)}".`);
  }

  return value;
}

function readRequestMode(
  definition: CharacterEventDefinitionRecord,
  key: string,
  label: string,
): OfflineRequestMode {
  const value = definition[key];

  if (typeof value !== 'string' || !includesString(VALID_REQUEST_MODES, value)) {
    throw new Error(`Offline simulation policy ${label}.${key} has invalid request mode "${String(value)}".`);
  }

  return value;
}
