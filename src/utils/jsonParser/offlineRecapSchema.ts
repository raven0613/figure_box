import type { OfflineRecapTemplate } from '~/services/offlineSimulation/types';
import {
  isRecord,
  readOptionalNumber,
  readOptionalString,
  type CharacterEventDefinitionRecord,
} from './schemaReaders';

export function readOptionalOfflineRecap(
  definition: CharacterEventDefinitionRecord,
  index: number,
  path: string,
): OfflineRecapTemplate | undefined {
  const value = definition.offlineRecap;

  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error(`Character event definition at index ${index} has invalid ${path}.`);
  }

  const offlineRecap = {
    summary: readOptionalString(value, 'summary', index),
    detail: readOptionalString(value, 'detail', index),
    quote: readOptionalString(value, 'quote', index),
    priority: readOptionalNumber(value, 'priority', index),
    sequenceKey: readOptionalString(value, 'sequenceKey', index),
    sequenceOrder: readOptionalNumber(value, 'sequenceOrder', index),
  };

  if (
    !offlineRecap.summary &&
    !offlineRecap.detail &&
    !offlineRecap.quote &&
    offlineRecap.priority === undefined &&
    !offlineRecap.sequenceKey &&
    offlineRecap.sequenceOrder === undefined
  ) {
    throw new Error(`Character event definition at index ${index} has empty ${path}.`);
  }

  return offlineRecap;
}
