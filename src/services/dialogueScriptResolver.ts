import type {
  DialogueScriptBranchCandidateDefinition,
  DialogueScriptChoiceResultDefinition,
  DialogueScriptConditionDefinition,
  DialogueScriptDefinition,
  DialogueScriptInstructionDefinition,
  DialogueScriptRuntimeContext,
} from '~/typing/dialogueScript';
import type {
  DialogueBranchCandidate,
  DialogueBranchContext,
  DialogueChoiceResult,
  DialogueCondition,
  DialogueViewInstruction,
  DialogueViewScript,
} from '~/typing/dialogueView';
import {
  createParticipantWayOfSayingTemplateValues,
  createWayOfSayingTemplateValues,
} from '~/services/characterWayOfSayingTemplate';
import {
  formatDialogueTextWithNameHighlights,
  type FormattedDialogueText,
} from '~/services/dialogueTextFormatter';

type TemplateValuesByParticipant = Readonly<Record<string, Readonly<Record<string, string>>>>;

export function createDialogueViewScript(
  definition: DialogueScriptDefinition,
  context: DialogueScriptRuntimeContext,
): DialogueViewScript {
  const participantIdByKey = new Map(
    definition.participants.map(participant => {
      const runtimeParticipant = context.participants[participant.key];

      if (!runtimeParticipant) {
        throw new Error(
          `Dialogue script "${definition.id}" is missing runtime participant "${participant.key}".`,
        );
      }

      return [participant.key, runtimeParticipant.id] as const;
    }),
  );
  const baseTemplateValues = createBaseTemplateValues(context);
  const templateValuesByParticipant = createTemplateValuesByParticipant(
    context,
    baseTemplateValues,
  );

  return {
    id: definition.id,
    participants: definition.participants.map(participant => {
      const runtimeParticipant = context.participants[participant.key];

      if (!runtimeParticipant) {
        throw new Error(
          `Dialogue script "${definition.id}" is missing runtime participant "${participant.key}".`,
        );
      }

      return {
        ...runtimeParticipant,
        slot: participant.slot,
      };
    }),
    lines: definition.lines.map(instruction => (
      resolveInstruction(
        instruction,
        participantIdByKey,
        templateValuesByParticipant,
        baseTemplateValues,
      )
    )),
    branchGroups: definition.branchGroups
      ? Object.fromEntries(
        Object.entries(definition.branchGroups).map(([groupId, group]) => [
          groupId,
          {
            id: group.id,
            selectionStrategy: group.selectionStrategy,
            rankWeights: group.rankWeights ? [...group.rankWeights] : undefined,
            candidates: group.candidates.map(candidate => (
              resolveBranchCandidate(
                candidate,
                participantIdByKey,
                templateValuesByParticipant,
                baseTemplateValues,
              )
            )),
          },
        ]),
      )
      : undefined,
    branchContext: createBranchContext(context, participantIdByKey),
    resolveActivityRoll: context.resolveActivityRoll,
    resolveDialogueContent: context.resolveDialogueContent,
    recordSpokenLine: context.recordSpokenLine,
  };
}

function resolveInstruction(
  instruction: DialogueScriptInstructionDefinition,
  participantIdByKey: ReadonlyMap<string, string>,
  templateValuesByParticipant: TemplateValuesByParticipant,
  baseTemplateValues: Readonly<Record<string, string>>,
): DialogueViewInstruction {
  const templateValues = getTemplateValuesForSpeaker(
    instruction.type === 'ACTIVITY_ROLL' ? undefined : instruction.speaker,
    templateValuesByParticipant,
    baseTemplateValues,
  );

  if (instruction.type === 'SAY') {
    const formattedText = formatDialogueText(instruction.text, templateValues);

    return {
      id: instruction.id,
      type: 'SAY',
      speakerId: getParticipantId(instruction.speaker, participantIdByKey),
      text: formattedText.text,
      textSegments: formattedText.textSegments,
      expressionPresetId: instruction.expressionPresetId,
    };
  }

  if (instruction.type === 'INPUT') {
    const formattedPrompt = formatDialogueText(instruction.prompt, templateValues);

    return {
      id: instruction.id,
      type: 'INPUT',
      speakerId: getParticipantId(instruction.speaker, participantIdByKey),
      targetId: getParticipantId(instruction.target, participantIdByKey),
      prompt: formattedPrompt.text,
      promptSegments: formattedPrompt.textSegments,
      variable: instruction.variable,
      fallbackValue: formatDialogueText(instruction.fallbackValue, templateValues).text,
      memoryKey: instruction.memoryKey,
      expressionPresetId: instruction.expressionPresetId,
    };
  }

  if (instruction.type === 'ACTIVITY_ROLL') {
    return {
      id: instruction.id,
      type: 'ACTIVITY_ROLL',
      rollId: instruction.rollId,
      rollContext: instruction.rollContext ? { ...instruction.rollContext } : undefined,
      contentPoolId: instruction.contentPoolId,
      subjectKey: instruction.subjectKey,
      subjectKeys: instruction.subjectKeys ? [...instruction.subjectKeys] : undefined,
      lines: (instruction.lines ?? []).map(line => (
        resolveInstruction(
          line,
          participantIdByKey,
          templateValuesByParticipant,
          baseTemplateValues,
        )
      )),
      lineVariants: instruction.lineVariants?.map(lines => (
        lines.map(line => resolveInstruction(
          line,
          participantIdByKey,
          templateValuesByParticipant,
          baseTemplateValues,
        ))
      )),
      branchLines: Object.fromEntries(
        Object.entries(instruction.branchLines).map(([branchId, lines]) => [
          branchId,
          lines.map(line => resolveInstruction(
            line,
            participantIdByKey,
            templateValuesByParticipant,
            baseTemplateValues,
          )),
        ]),
      ),
    };
  }

  const formattedText = formatDialogueText(instruction.text, templateValues);

  return {
    id: instruction.id,
    type: 'CHOICE',
    speakerId: getParticipantId(instruction.speaker, participantIdByKey),
    text: formattedText.text,
    textSegments: formattedText.textSegments,
    expressionPresetId: instruction.expressionPresetId,
    idlePrompt: instruction.idlePrompt
      ? formatDialogueText(instruction.idlePrompt, templateValues).text
      : undefined,
    idlePromptLines: instruction.idlePromptLines?.map(line => ({
      id: line.id,
      type: 'SAY',
      speakerId: getParticipantId(line.speaker, participantIdByKey),
      ...formatDialogueText(
        line.text,
        getTemplateValuesForSpeaker(
          line.speaker,
          templateValuesByParticipant,
          baseTemplateValues,
        ),
      ),
      expressionPresetId: line.expressionPresetId,
    })),
    timeoutMs: instruction.timeoutMs,
    choices: instruction.choices.map(choice => {
      const formattedLabel = formatDialogueText(choice.label, templateValues);

      return {
        id: choice.id,
        label: formattedLabel.text,
        labelSegments: formattedLabel.textSegments,
        result: resolveChoiceResult(
          choice.result,
          participantIdByKey,
          templateValuesByParticipant,
          baseTemplateValues,
        ),
      };
    }),
  };
}

function resolveChoiceResult(
  result: DialogueScriptChoiceResultDefinition,
  participantIdByKey: ReadonlyMap<string, string>,
  templateValuesByParticipant: TemplateValuesByParticipant,
  baseTemplateValues: Readonly<Record<string, string>>,
): DialogueChoiceResult {
  if (result.type === 'appendLines' || result.type === 'replaceRemaining') {
    return {
      type: result.type,
      rollContext: result.rollContext ? { ...result.rollContext } : undefined,
      lines: result.lines.map(instruction => (
        resolveInstruction(
          instruction,
          participantIdByKey,
          templateValuesByParticipant,
          baseTemplateValues,
        )
      )),
    };
  }

  if (result.type === 'jumpTo') {
    return {
      type: 'jumpTo',
      target: { ...result.target },
    };
  }

  if (result.type === 'branch') {
    return {
      type: 'branch',
      branchGroupId: result.branchGroupId,
    };
  }

  if (result.type === 'setRollContext') {
    return {
      type: 'setRollContext',
      rollContext: { ...result.rollContext },
    };
  }

  if (result.type === 'activityRoll') {
    return {
      type: 'activityRoll',
      rollId: result.rollId,
      rollContext: result.rollContext ? { ...result.rollContext } : undefined,
      contentPoolId: result.contentPoolId,
      subjectKey: result.subjectKey,
      subjectKeys: result.subjectKeys ? [...result.subjectKeys] : undefined,
      lines: (result.lines ?? []).map(instruction => (
        resolveInstruction(
          instruction,
          participantIdByKey,
          templateValuesByParticipant,
          baseTemplateValues,
        )
      )),
      lineVariants: result.lineVariants?.map(lines => (
        lines.map(instruction => (
          resolveInstruction(
            instruction,
            participantIdByKey,
            templateValuesByParticipant,
            baseTemplateValues,
          )
        ))
      )),
      branchLines: Object.fromEntries(
        Object.entries(result.branchLines).map(([branchId, lines]) => [
          branchId,
          lines.map(instruction => (
            resolveInstruction(
              instruction,
              participantIdByKey,
              templateValuesByParticipant,
              baseTemplateValues,
            )
          )),
        ]),
      ),
    };
  }

  return { type: 'end' };
}

function resolveBranchCandidate(
  candidate: DialogueScriptBranchCandidateDefinition,
  participantIdByKey: ReadonlyMap<string, string>,
  templateValuesByParticipant: TemplateValuesByParticipant,
  baseTemplateValues: Readonly<Record<string, string>>,
): DialogueBranchCandidate {
  return {
    id: candidate.id,
    selectionMode: candidate.selectionMode,
    priority: candidate.priority,
    baseWeight: candidate.baseWeight,
    conditions: candidate.conditions?.map(condition => (
      resolveCondition(condition, participantIdByKey)
    )),
    scoreRules: candidate.scoreRules?.map(rule => ({
      when: resolveCondition(rule.when, participantIdByKey),
      add: rule.add,
      multiplier: rule.multiplier,
    })),
    lines: candidate.lines.map(instruction => (
      resolveInstruction(
        instruction,
        participantIdByKey,
        templateValuesByParticipant,
        baseTemplateValues,
      )
    )),
  };
}

function createBaseTemplateValues(
  context: DialogueScriptRuntimeContext,
): Readonly<Record<string, string>> {
  const participantTemplateValues = Object.fromEntries(
    Object.entries(context.participants).map(([key, participant]) => [
      `${key}Name`,
      participant.name,
    ]),
  );

  return {
    ...participantTemplateValues,
    ...createParticipantWayOfSayingTemplateValues(
      Object.fromEntries(
        Object.entries(context.participants).map(([key, participant]) => [
          key,
          participant.wayOfSaying,
        ]),
      ),
    ),
    ...context.templateValues,
  };
}

function createTemplateValuesByParticipant(
  context: DialogueScriptRuntimeContext,
  baseTemplateValues: Readonly<Record<string, string>>,
): TemplateValuesByParticipant {
  return Object.fromEntries(
    Object.entries(context.participants).map(([key, participant]) => [
      key,
      {
        ...baseTemplateValues,
        ...createWayOfSayingTemplateValues(participant.wayOfSaying),
      },
    ]),
  );
}

function getTemplateValuesForSpeaker(
  speakerKey: string | undefined,
  templateValuesByParticipant: TemplateValuesByParticipant,
  baseTemplateValues: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  if (!speakerKey) {
    return baseTemplateValues;
  }

  return templateValuesByParticipant[speakerKey] ?? baseTemplateValues;
}

function resolveCondition(
  condition: DialogueScriptConditionDefinition,
  participantIdByKey: ReadonlyMap<string, string>,
): DialogueCondition {
  if (condition.type === 'intimacyRange') {
    return {
      type: 'intimacyRange',
      sourceId: getParticipantId(condition.source, participantIdByKey),
      targetId: getParticipantId(condition.target, participantIdByKey),
      min: condition.min,
      max: condition.max,
    };
  }

  return {
    type: 'traitIncludes',
    characterId: getParticipantId(condition.participant, participantIdByKey),
    trait: condition.trait,
  };
}

function createBranchContext(
  context: DialogueScriptRuntimeContext,
  participantIdByKey: ReadonlyMap<string, string>,
): DialogueBranchContext {
  return {
    characters: Array.from(participantIdByKey.entries()).map(([key, id]) => ({
      id,
      traits: [...(context.traitsByParticipant?.[key] ?? [])],
    })),
    relationships: (context.relationships ?? []).map(relationship => ({
      sourceId: getParticipantId(relationship.source, participantIdByKey),
      targetId: getParticipantId(relationship.target, participantIdByKey),
      intimacy: relationship.intimacy,
    })),
    recentBranchIds: context.recentBranchIds
      ? [...context.recentBranchIds]
      : undefined,
    random: context.random,
  };
}

function getParticipantId(
  participantKey: string,
  participantIdByKey: ReadonlyMap<string, string>,
): string {
  const participantId = participantIdByKey.get(participantKey);

  if (!participantId) {
    throw new Error(`Dialogue script references missing participant "${participantKey}".`);
  }

  return participantId;
}

function formatDialogueText(
  template: string,
  values: Readonly<Record<string, string>>,
): FormattedDialogueText {
  return formatDialogueTextWithNameHighlights(template, values);
}
