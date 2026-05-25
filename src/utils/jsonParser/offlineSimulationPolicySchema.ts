import type { CharacterRequestLevel } from '~/services/characterRequests/types';
import type {
  OfflineEventPolicyRule,
  OfflineRecapMode,
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

export function loadOfflineSimulationPolicy(rawPolicy: unknown): OfflineSimulationPolicy {
  if (!isRecord(rawPolicy)) {
    throw new Error('Offline simulation policy must be an object.');
  }

  const events = readRequiredRecord(rawPolicy, 'events');

  return {
    version: readRequiredNumber(rawPolicy, 'version', 0),
    elapsedTime: readElapsedTimePolicy(readRequiredRecord(rawPolicy, 'elapsedTime')),
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
  };
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
