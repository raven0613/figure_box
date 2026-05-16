import type {
  CharacterEventPresentationVariant,
  CharacterEventTransitionPresentation,
} from '../../constants/charactarEventsDefinitions';
import { readOptionalActivity } from './activitySchema';
import {
  readOptionalRuleClauses,
  readOptionalWeightModifiers,
} from './ruleSchema';
import {
  isRecord,
  readOptionalClauseMode,
  readOptionalString,
  readOptionalStringList,
  readRequiredNumber,
  readRequiredString,
  type CharacterEventDefinitionRecord,
} from './schemaReaders';

// presentationVariants / transition presentations parser
export function readOptionalPresentationVariants(
  definition: CharacterEventDefinitionRecord,
  index: number,
): CharacterEventPresentationVariant[] | undefined {
  const value = definition.presentationVariants;

  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`Character event definition at index ${index} has invalid presentationVariants.`);
  }

  const variants = value.map((variant, variantIndex) => readPresentationVariant(variant, index, variantIndex));
  assertUniquePresentationVariantIds(variants, index);

  return variants;
}

export function readOptionalTransitionPresentations(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): CharacterEventTransitionPresentation[] | undefined {
  const value = definition[key];

  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`Character event definition at index ${index} has invalid ${key}.`);
  }

  const presentations = value.map((presentation, presentationIndex) => {
    const variant = readPresentationVariant(presentation, index, presentationIndex);

    if (!isRecord(presentation)) {
      throw new Error(`Character event definition at index ${index} has invalid ${key}[${presentationIndex}].`);
    }

    return {
      ...variant,
      dialogueGroupId: readOptionalString(presentation, 'dialogueGroupId', index),
    };
  });

  assertUniquePresentationVariantIds(presentations, index);
  return presentations;
}

function readPresentationVariant(
  rawVariant: unknown,
  definitionIndex: number,
  variantIndex: number,
): CharacterEventPresentationVariant {
  if (!isRecord(rawVariant)) {
    throw new Error(
      `Character event definition at index ${definitionIndex} has invalid presentationVariants[${variantIndex}].`,
    );
  }

  return {
    id: readRequiredString(rawVariant, 'id', definitionIndex),
    baseWeight: readRequiredNumber(rawVariant, 'baseWeight', definitionIndex),
    conditionMode: readOptionalClauseMode(rawVariant, 'conditionMode', definitionIndex),
    conditions: readOptionalRuleClauses(rawVariant, 'conditions', definitionIndex),
    weightModifiers: readOptionalWeightModifiers(rawVariant, 'weightModifiers', definitionIndex),
    presentationTags: readOptionalStringList(rawVariant, 'presentationTags', definitionIndex),
    performanceId: readOptionalString(rawVariant, 'performanceId', definitionIndex),
    activity: readOptionalActivity(rawVariant, definitionIndex),
  };
}

function assertUniquePresentationVariantIds(
  variants: CharacterEventPresentationVariant[],
  definitionIndex: number,
): void {
  const seenIds = new Set<string>();

  variants.forEach(variant => {
    if (seenIds.has(variant.id)) {
      throw new Error(
        `Character event definition at index ${definitionIndex} has duplicate presentation variant id "${variant.id}".`,
      );
    }

    seenIds.add(variant.id);
  });
}

