import type {
  OfflineRecapTemplate,
  OfflineRecapTemplates,
} from '~/services/offlineSimulation/types';
import {
  includesString,
  isRecord,
  readOptionalNumber,
  readRequiredNumber,
  type CharacterEventDefinitionRecord,
} from './schemaReaders';

const VALID_MOTIVATIONS = ['idle', 'findFood', 'play', 'chat', 'goHome'] as const;
const VALID_ACTIVITY_TYPES = ['chat', 'playWithItem', 'playAtLocation'] as const;

export function loadOfflineRecapTemplates(rawTemplates: unknown): OfflineRecapTemplates {
  if (!isRecord(rawTemplates)) {
    throw new Error('Offline recap templates must be an object.');
  }

  return {
    version: readRequiredNumber(rawTemplates, 'version', 0),
    fallback: readFallbackTemplate(readRequiredRecord(rawTemplates, 'fallback')),
    motivation: readTemplateMap(
      readRequiredRecord(rawTemplates, 'motivation'),
      VALID_MOTIVATIONS,
      'motivation',
    ),
    eventType: readAnyKeyTemplateMap(readRequiredRecord(rawTemplates, 'eventType'), 'eventType'),
    activityType: readTemplateMap(
      readRequiredRecord(rawTemplates, 'activityType'),
      VALID_ACTIVITY_TYPES,
      'activityType',
    ),
    eventOverrides: readAnyKeyTemplateMap(readRequiredRecord(rawTemplates, 'eventOverrides'), 'eventOverrides'),
  };
}

function readFallbackTemplate(
  value: CharacterEventDefinitionRecord,
): Required<Pick<OfflineRecapTemplate, 'summary'>> & OfflineRecapTemplate {
  const template = readTemplate(value, 'fallback');

  if (!template.summary) {
    throw new Error('Offline recap templates fallback.summary is required.');
  }

  return {
    ...template,
    summary: template.summary,
  };
}

function readTemplateMap<T extends string>(
  value: CharacterEventDefinitionRecord,
  validKeys: readonly T[],
  label: string,
): Partial<Record<T, OfflineRecapTemplate>> {
  return Object.fromEntries(
    Object.entries(value).map(([key, template]) => {
      if (!includesString(validKeys, key)) {
        throw new Error(`Offline recap templates has invalid ${label} key "${key}".`);
      }

      if (!isRecord(template)) {
        throw new Error(`Offline recap templates ${label}.${key} must be an object.`);
      }

      return [key, readTemplate(template, `${label}.${key}`)];
    }),
  ) as Partial<Record<T, OfflineRecapTemplate>>;
}

function readAnyKeyTemplateMap(
  value: CharacterEventDefinitionRecord,
  label: string,
): Record<string, OfflineRecapTemplate> {
  return Object.fromEntries(
    Object.entries(value).map(([key, template]) => {
      if (!isRecord(template)) {
        throw new Error(`Offline recap templates ${label}.${key} must be an object.`);
      }

      return [key, readTemplate(template, `${label}.${key}`)];
    }),
  );
}

function readTemplate(
  value: CharacterEventDefinitionRecord,
  label: string,
): OfflineRecapTemplate {
  const template = {
    summary: readOptionalTemplateText(value, 'summary', label),
    detail: readOptionalTemplateText(value, 'detail', label),
    quote: readOptionalTemplateText(value, 'quote', label),
    priority: readOptionalNumber(value, 'priority', 0),
    sequenceKey: readOptionalTemplateText(value, 'sequenceKey', label),
    sequenceOrder: readOptionalNumber(value, 'sequenceOrder', 0),
  };

  if (
    !template.summary &&
    !template.detail &&
    !template.quote &&
    template.priority === undefined &&
    !template.sequenceKey &&
    template.sequenceOrder === undefined
  ) {
    throw new Error(`Offline recap templates ${label} must include summary, detail, or quote.`);
  }

  return template;
}

function readRequiredRecord(
  definition: CharacterEventDefinitionRecord,
  key: string,
): CharacterEventDefinitionRecord {
  const value = definition[key];

  if (!isRecord(value)) {
    throw new Error(`Offline recap templates must include object ${key}.`);
  }

  return value;
}

function readOptionalTemplateText(
  definition: CharacterEventDefinitionRecord,
  key: string,
  label: string,
): string | undefined {
  const value = definition[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Offline recap templates ${label}.${key} must be a non-empty string.`);
  }

  return value;
}
