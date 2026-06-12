import { Expression } from '~/constants/character';
import type {
  DialogueScriptBranchCandidateDefinition,
  DialogueScriptBranchGroupDefinition,
  DialogueScriptChoiceDefinition,
  DialogueScriptChoiceResultDefinition,
  DialogueScriptConditionDefinition,
  DialogueScriptDefinition,
  DialogueScriptInstructionDefinition,
  DialogueScriptParticipantDefinition,
  DialogueScriptSayDefinition,
  DialogueScriptScoreRuleDefinition,
} from '~/typing/dialogueScript';
import {
  includesString,
  isRecord,
  readOptionalNumber,
  readOptionalString,
  readRequiredNonNegativeNumber,
  readRequiredNumber,
  readRequiredString,
  type CharacterEventDefinitionRecord,
} from './schemaReaders';

const VALID_AVATAR_SLOTS = ['left', 'center-left', 'center-right', 'right'] as const;
const VALID_EXPRESSIONS = Object.values(Expression);
const VALID_INSTRUCTION_TYPES = ['SAY', 'CHOICE'] as const;
const VALID_CHOICE_RESULT_TYPES = [
  'appendLines',
  'replaceRemaining',
  'jumpTo',
  'branch',
  'activityRoll',
  'end',
] as const;
const VALID_SELECTION_STRATEGIES = ['scoreWeighted', 'rankWeighted'] as const;
const VALID_SELECTION_MODES = ['required', 'weighted'] as const;

export function loadDialogueScriptDefinitions(rawDefinitions: unknown): DialogueScriptDefinition[] {
  if (!Array.isArray(rawDefinitions)) {
    throw new Error('Dialogue script definitions must be an array.');
  }

  const definitions = rawDefinitions.map((definition, index) => (
    readDialogueScriptDefinition(definition, index)
  ));

  assertUniqueIds(definitions, 'dialogue script');
  return definitions;
}

function readDialogueScriptDefinition(
  value: unknown,
  index: number,
): DialogueScriptDefinition {
  if (!isRecord(value)) {
    throw new Error(`Dialogue script definition at index ${index} must be an object.`);
  }

  const participants = readParticipants(value, index);
  const participantKeys = new Set(participants.map(participant => participant.key));
  const lines = readInstructions(value.lines, index, 'lines', participantKeys);
  const branchGroups = readBranchGroups(value.branchGroups, index, participantKeys);
  const definition = {
    id: readRequiredString(value, 'id', index),
    participants,
    lines,
    branchGroups,
  };

  assertReferencedBranchGroups(definition, index);
  return definition;
}

function readParticipants(
  definition: CharacterEventDefinitionRecord,
  index: number,
): DialogueScriptParticipantDefinition[] {
  const value = definition.participants;

  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Dialogue script definition at index ${index} must include participants.`);
  }

  const participants = value.map((participant, participantIndex) => {
    if (!isRecord(participant)) {
      throw new Error(
        `Dialogue script definition at index ${index} has invalid participants[${participantIndex}].`,
      );
    }

    const slot = readRequiredString(participant, 'slot', index);

    if (!includesString(VALID_AVATAR_SLOTS, slot)) {
      throw new Error(
        `Dialogue script definition at index ${index} has invalid participant slot "${slot}".`,
      );
    }

    return {
      key: readRequiredString(participant, 'key', index),
      slot,
    };
  });

  assertUniqueIds(
    participants.map(participant => ({ id: participant.key })),
    `dialogue script ${index} participant`,
  );
  return participants;
}

function readInstructions(
  value: unknown,
  definitionIndex: number,
  path: string,
  participantKeys: ReadonlySet<string>,
): DialogueScriptInstructionDefinition[] {
  if (!Array.isArray(value)) {
    throw new Error(`Dialogue script definition at index ${definitionIndex} has invalid ${path}.`);
  }

  return value.map((instruction, instructionIndex) => (
    readInstruction(
      instruction,
      definitionIndex,
      `${path}[${instructionIndex}]`,
      participantKeys,
    )
  ));
}

function readInstruction(
  value: unknown,
  definitionIndex: number,
  path: string,
  participantKeys: ReadonlySet<string>,
): DialogueScriptInstructionDefinition {
  if (!isRecord(value)) {
    throw new Error(`Dialogue script definition at index ${definitionIndex} has invalid ${path}.`);
  }

  const type = readRequiredString(value, 'type', definitionIndex);

  if (!includesString(VALID_INSTRUCTION_TYPES, type)) {
    throw new Error(
      `Dialogue script definition at index ${definitionIndex} has invalid ${path}.type "${type}".`,
    );
  }

  return type === 'SAY'
    ? readSay(value, definitionIndex, path, participantKeys)
    : readChoice(value, definitionIndex, path, participantKeys);
}

function readSay(
  value: CharacterEventDefinitionRecord,
  definitionIndex: number,
  path: string,
  participantKeys: ReadonlySet<string>,
): DialogueScriptSayDefinition {
  return {
    id: readOptionalString(value, 'id', definitionIndex),
    type: 'SAY',
    speaker: readParticipantKey(value, 'speaker', definitionIndex, path, participantKeys),
    text: readRequiredString(value, 'text', definitionIndex),
    expression: readExpression(value, definitionIndex, path),
  };
}

function readChoice(
  value: CharacterEventDefinitionRecord,
  definitionIndex: number,
  path: string,
  participantKeys: ReadonlySet<string>,
): DialogueScriptChoiceDefinition {
  const rawChoices = value.choices;

  if (!Array.isArray(rawChoices) || rawChoices.length === 0) {
    throw new Error(`Dialogue script definition at index ${definitionIndex} has invalid ${path}.choices.`);
  }

  const choices = rawChoices.map((choice, choiceIndex) => {
    if (!isRecord(choice)) {
      throw new Error(
        `Dialogue script definition at index ${definitionIndex} has invalid ${path}.choices[${choiceIndex}].`,
      );
    }

    return {
      id: readRequiredString(choice, 'id', definitionIndex),
      label: readRequiredString(choice, 'label', definitionIndex),
      result: readChoiceResult(
        choice.result,
        definitionIndex,
        `${path}.choices[${choiceIndex}].result`,
        participantKeys,
      ),
    };
  });

  assertUniqueIds(choices, `${path} choice`);
  return {
    id: readOptionalString(value, 'id', definitionIndex),
    type: 'CHOICE',
    speaker: readParticipantKey(value, 'speaker', definitionIndex, path, participantKeys),
    text: readRequiredString(value, 'text', definitionIndex),
    expression: readExpression(value, definitionIndex, path),
    idlePrompt: readOptionalString(value, 'idlePrompt', definitionIndex),
    idlePromptLines: value.idlePromptLines === undefined
      ? undefined
      : readInstructions(
        value.idlePromptLines,
        definitionIndex,
        `${path}.idlePromptLines`,
        participantKeys,
      ).map(instruction => {
        if (instruction.type !== 'SAY') {
          throw new Error(
            `Dialogue script definition at index ${definitionIndex} requires SAY instructions in ${path}.idlePromptLines.`,
          );
        }

        return instruction;
      }),
    timeoutMs: readRequiredNonNegativeNumber(value, 'timeoutMs', definitionIndex),
    choices,
  };
}

function readChoiceResult(
  value: unknown,
  definitionIndex: number,
  path: string,
  participantKeys: ReadonlySet<string>,
): DialogueScriptChoiceResultDefinition {
  if (!isRecord(value)) {
    throw new Error(`Dialogue script definition at index ${definitionIndex} has invalid ${path}.`);
  }

  const type = readRequiredString(value, 'type', definitionIndex);

  if (!includesString(VALID_CHOICE_RESULT_TYPES, type)) {
    throw new Error(
      `Dialogue script definition at index ${definitionIndex} has invalid ${path}.type "${type}".`,
    );
  }

  if (type === 'appendLines' || type === 'replaceRemaining') {
    return {
      type,
      lines: readInstructions(value.lines, definitionIndex, `${path}.lines`, participantKeys),
    };
  }

  if (type === 'jumpTo') {
    return {
      type,
      target: readJumpTarget(value.target, definitionIndex, `${path}.target`),
    };
  }

  if (type === 'branch') {
    return {
      type,
      branchGroupId: readRequiredString(value, 'branchGroupId', definitionIndex),
    };
  }

  if (type === 'activityRoll') {
    const contentPoolId = readOptionalString(value, 'contentPoolId', definitionIndex);
    const subjectKey = readOptionalString(value, 'subjectKey', definitionIndex);
    const subjectKeys = readOptionalStringList(
      value.subjectKeys,
      definitionIndex,
      `${path}.subjectKeys`,
    );

    if (contentPoolId && !subjectKey && !subjectKeys) {
      throw new Error(
        `Dialogue script definition at index ${definitionIndex} requires a subject key for ${path}.`,
      );
    }

    return {
      type,
      rollId: readRequiredString(value, 'rollId', definitionIndex),
      contentPoolId,
      subjectKey,
      subjectKeys,
      lines: value.lines === undefined
        ? undefined
        : readInstructions(value.lines, definitionIndex, `${path}.lines`, participantKeys),
      lineVariants: readOptionalInstructionVariants(
        value.lineVariants,
        definitionIndex,
        `${path}.lineVariants`,
        participantKeys,
      ),
      branchLines: readRequiredBranchLines(
        value.branchLines,
        definitionIndex,
        `${path}.branchLines`,
        participantKeys,
      ),
    };
  }

  return { type: 'end' };
}

function readOptionalStringList(
  value: unknown,
  definitionIndex: number,
  path: string,
): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    !Array.isArray(value)
    || value.length === 0
    || value.some(entry => typeof entry !== 'string' || entry.length === 0)
  ) {
    throw new Error(`Dialogue script definition at index ${definitionIndex} has invalid ${path}.`);
  }

  return [...new Set(value)];
}

function readOptionalInstructionVariants(
  value: unknown,
  definitionIndex: number,
  path: string,
  participantKeys: ReadonlySet<string>,
): DialogueScriptInstructionDefinition[][] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Dialogue script definition at index ${definitionIndex} has invalid ${path}.`);
  }

  return value.map((instructions, variantIndex) => (
    readInstructions(
      instructions,
      definitionIndex,
      `${path}[${variantIndex}]`,
      participantKeys,
    )
  ));
}

function readRequiredBranchLines(
  value: unknown,
  definitionIndex: number,
  path: string,
  participantKeys: ReadonlySet<string>,
): Readonly<Record<string, DialogueScriptInstructionDefinition[]>> {
  if (!isRecord(value) || Object.keys(value).length === 0) {
    throw new Error(`Dialogue script definition at index ${definitionIndex} has invalid ${path}.`);
  }

  return Object.fromEntries(
    Object.entries(value).map(([branchId, instructions]) => [
      branchId,
      readInstructions(
        instructions,
        definitionIndex,
        `${path}.${branchId}`,
        participantKeys,
      ),
    ]),
  );
}

function readJumpTarget(
  value: unknown,
  definitionIndex: number,
  path: string,
): Extract<DialogueScriptChoiceResultDefinition, { type: 'jumpTo' }>['target'] {
  if (!isRecord(value)) {
    throw new Error(`Dialogue script definition at index ${definitionIndex} has invalid ${path}.`);
  }

  const type = readRequiredString(value, 'type', definitionIndex);

  if (type === 'index') {
    return {
      type,
      index: readRequiredNonNegativeNumber(value, 'index', definitionIndex),
    };
  }

  if (type === 'anchor') {
    return {
      type,
      anchorId: readRequiredString(value, 'anchorId', definitionIndex),
    };
  }

  throw new Error(
    `Dialogue script definition at index ${definitionIndex} has invalid ${path}.type "${type}".`,
  );
}

function readBranchGroups(
  value: unknown,
  definitionIndex: number,
  participantKeys: ReadonlySet<string>,
): Readonly<Record<string, DialogueScriptBranchGroupDefinition>> | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error(`Dialogue script definition at index ${definitionIndex} has invalid branchGroups.`);
  }

  return Object.fromEntries(
    Object.entries(value).map(([groupKey, group]) => [
      groupKey,
      readBranchGroup(group, definitionIndex, groupKey, participantKeys),
    ]),
  );
}

function readBranchGroup(
  value: unknown,
  definitionIndex: number,
  groupKey: string,
  participantKeys: ReadonlySet<string>,
): DialogueScriptBranchGroupDefinition {
  if (!isRecord(value)) {
    throw new Error(
      `Dialogue script definition at index ${definitionIndex} has invalid branchGroups.${groupKey}.`,
    );
  }

  const selectionStrategy = readRequiredString(value, 'selectionStrategy', definitionIndex);
  const rawCandidates = value.candidates;

  if (!includesString(VALID_SELECTION_STRATEGIES, selectionStrategy)) {
    throw new Error(
      `Dialogue script definition at index ${definitionIndex} has invalid branch strategy "${selectionStrategy}".`,
    );
  }

  if (!Array.isArray(rawCandidates) || rawCandidates.length === 0) {
    throw new Error(
      `Dialogue script definition at index ${definitionIndex} requires candidates in branchGroups.${groupKey}.`,
    );
  }

  const candidates = rawCandidates.map((candidate, candidateIndex) => (
    readBranchCandidate(
      candidate,
      definitionIndex,
      `branchGroups.${groupKey}.candidates[${candidateIndex}]`,
      participantKeys,
    )
  ));

  assertUniqueIds(candidates, `branchGroups.${groupKey} candidate`);
  return {
    id: readRequiredString(value, 'id', definitionIndex),
    selectionStrategy,
    rankWeights: readOptionalNumberList(value.rankWeights, definitionIndex, `branchGroups.${groupKey}.rankWeights`),
    candidates,
  };
}

function readBranchCandidate(
  value: unknown,
  definitionIndex: number,
  path: string,
  participantKeys: ReadonlySet<string>,
): DialogueScriptBranchCandidateDefinition {
  if (!isRecord(value)) {
    throw new Error(`Dialogue script definition at index ${definitionIndex} has invalid ${path}.`);
  }

  const selectionMode = readRequiredString(value, 'selectionMode', definitionIndex);

  if (!includesString(VALID_SELECTION_MODES, selectionMode)) {
    throw new Error(
      `Dialogue script definition at index ${definitionIndex} has invalid ${path}.selectionMode.`,
    );
  }

  return {
    id: readRequiredString(value, 'id', definitionIndex),
    selectionMode,
    priority: readOptionalNumber(value, 'priority', definitionIndex),
    baseWeight: readRequiredNumber(value, 'baseWeight', definitionIndex),
    conditions: readConditions(value.conditions, definitionIndex, `${path}.conditions`, participantKeys),
    scoreRules: readScoreRules(value.scoreRules, definitionIndex, `${path}.scoreRules`, participantKeys),
    lines: readInstructions(value.lines, definitionIndex, `${path}.lines`, participantKeys),
  };
}

function readConditions(
  value: unknown,
  definitionIndex: number,
  path: string,
  participantKeys: ReadonlySet<string>,
): DialogueScriptConditionDefinition[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`Dialogue script definition at index ${definitionIndex} has invalid ${path}.`);
  }

  return value.map((condition, conditionIndex) => (
    readCondition(condition, definitionIndex, `${path}[${conditionIndex}]`, participantKeys)
  ));
}

function readCondition(
  value: unknown,
  definitionIndex: number,
  path: string,
  participantKeys: ReadonlySet<string>,
): DialogueScriptConditionDefinition {
  if (!isRecord(value)) {
    throw new Error(`Dialogue script definition at index ${definitionIndex} has invalid ${path}.`);
  }

  const type = readRequiredString(value, 'type', definitionIndex);

  if (type === 'intimacyRange') {
    return {
      type,
      source: readParticipantKey(value, 'source', definitionIndex, path, participantKeys),
      target: readParticipantKey(value, 'target', definitionIndex, path, participantKeys),
      min: readOptionalNumber(value, 'min', definitionIndex),
      max: readOptionalNumber(value, 'max', definitionIndex),
    };
  }

  if (type === 'traitIncludes') {
    return {
      type,
      participant: readParticipantKey(value, 'participant', definitionIndex, path, participantKeys),
      trait: readRequiredString(value, 'trait', definitionIndex),
    };
  }

  throw new Error(
    `Dialogue script definition at index ${definitionIndex} has invalid ${path}.type "${type}".`,
  );
}

function readScoreRules(
  value: unknown,
  definitionIndex: number,
  path: string,
  participantKeys: ReadonlySet<string>,
): DialogueScriptScoreRuleDefinition[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`Dialogue script definition at index ${definitionIndex} has invalid ${path}.`);
  }

  return value.map((rule, ruleIndex) => {
    if (!isRecord(rule)) {
      throw new Error(
        `Dialogue script definition at index ${definitionIndex} has invalid ${path}[${ruleIndex}].`,
      );
    }

    return {
      when: readCondition(
        rule.when,
        definitionIndex,
        `${path}[${ruleIndex}].when`,
        participantKeys,
      ),
      add: readRequiredNumber(rule, 'add', definitionIndex),
      multiplier: readOptionalNumber(rule, 'multiplier', definitionIndex),
    };
  });
}

function readExpression(
  definition: CharacterEventDefinitionRecord,
  definitionIndex: number,
  path: string,
): Expression {
  const expression = readRequiredString(definition, 'expression', definitionIndex);

  if (!includesString(VALID_EXPRESSIONS, expression)) {
    throw new Error(
      `Dialogue script definition at index ${definitionIndex} has invalid ${path}.expression "${expression}".`,
    );
  }

  return expression;
}

function readParticipantKey(
  definition: CharacterEventDefinitionRecord,
  key: string,
  definitionIndex: number,
  path: string,
  participantKeys: ReadonlySet<string>,
): string {
  const participantKey = readRequiredString(definition, key, definitionIndex);

  if (!participantKeys.has(participantKey)) {
    throw new Error(
      `Dialogue script definition at index ${definitionIndex} references unknown participant "${participantKey}" in ${path}.${key}.`,
    );
  }

  return participantKey;
}

function readOptionalNumberList(
  value: unknown,
  definitionIndex: number,
  path: string,
): number[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || !value.every(item => typeof item === 'number' && Number.isFinite(item))) {
    throw new Error(`Dialogue script definition at index ${definitionIndex} has invalid ${path}.`);
  }

  return [...value];
}

function assertReferencedBranchGroups(
  definition: DialogueScriptDefinition,
  definitionIndex: number,
): void {
  const branchGroupIds = new Set(Object.keys(definition.branchGroups ?? {}));

  collectBranchGroupReferences(definition.lines).forEach(branchGroupId => {
    if (!branchGroupIds.has(branchGroupId)) {
      throw new Error(
        `Dialogue script definition at index ${definitionIndex} references missing branch group "${branchGroupId}".`,
      );
    }
  });
}

function collectBranchGroupReferences(
  instructions: readonly DialogueScriptInstructionDefinition[],
): string[] {
  return instructions.flatMap(instruction => {
    if (instruction.type !== 'CHOICE') {
      return [];
    }

    return instruction.choices.flatMap(choice => {
      if (choice.result.type === 'branch') {
        return [choice.result.branchGroupId];
      }

      if (
        choice.result.type === 'appendLines' ||
        choice.result.type === 'replaceRemaining'
      ) {
        return collectBranchGroupReferences(choice.result.lines);
      }

      return [];
    });
  });
}

function assertUniqueIds(
  values: readonly { id: string }[],
  label: string,
): void {
  const seenIds = new Set<string>();

  values.forEach(value => {
    if (seenIds.has(value.id)) {
      throw new Error(`Duplicate ${label} id "${value.id}".`);
    }

    seenIds.add(value.id);
  });
}
