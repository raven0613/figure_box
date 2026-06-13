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
  const participantTemplateValues = Object.fromEntries(
    Object.entries(context.participants).map(([key, participant]) => [
      `${key}Name`,
      participant.name,
    ]),
  );
  const templateValues: Readonly<Record<string, string>> = {
    ...participantTemplateValues,
    ...context.templateValues,
  };

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
      resolveInstruction(instruction, participantIdByKey, templateValues)
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
              resolveBranchCandidate(candidate, participantIdByKey, templateValues)
            )),
          },
        ]),
      )
      : undefined,
    branchContext: createBranchContext(context, participantIdByKey),
    resolveActivityRoll: context.resolveActivityRoll,
    resolveDialogueContent: context.resolveDialogueContent,
  };
}

function resolveInstruction(
  instruction: DialogueScriptInstructionDefinition,
  participantIdByKey: ReadonlyMap<string, string>,
  templateValues: Readonly<Record<string, string>>,
): DialogueViewInstruction {
  const speakerId = getParticipantId(instruction.speaker, participantIdByKey);

  if (instruction.type === 'SAY') {
    return {
      id: instruction.id,
      type: 'SAY',
      speakerId,
      text: formatDialogueText(instruction.text, templateValues),
      expressionPresetId: instruction.expressionPresetId,
    };
  }

  return {
    id: instruction.id,
    type: 'CHOICE',
    speakerId,
    text: formatDialogueText(instruction.text, templateValues),
    expressionPresetId: instruction.expressionPresetId,
    idlePrompt: instruction.idlePrompt
      ? formatDialogueText(instruction.idlePrompt, templateValues)
      : undefined,
    idlePromptLines: instruction.idlePromptLines?.map(line => ({
      id: line.id,
      type: 'SAY',
      speakerId: getParticipantId(line.speaker, participantIdByKey),
      text: formatDialogueText(line.text, templateValues),
      expressionPresetId: line.expressionPresetId,
    })),
    timeoutMs: instruction.timeoutMs,
    choices: instruction.choices.map(choice => ({
      id: choice.id,
      label: formatDialogueText(choice.label, templateValues),
      result: resolveChoiceResult(choice.result, participantIdByKey, templateValues),
    })),
  };
}

function resolveChoiceResult(
  result: DialogueScriptChoiceResultDefinition,
  participantIdByKey: ReadonlyMap<string, string>,
  templateValues: Readonly<Record<string, string>>,
): DialogueChoiceResult {
  if (result.type === 'appendLines' || result.type === 'replaceRemaining') {
    return {
      type: result.type,
      lines: result.lines.map(instruction => (
        resolveInstruction(instruction, participantIdByKey, templateValues)
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

  if (result.type === 'activityRoll') {
    return {
      type: 'activityRoll',
      rollId: result.rollId,
      contentPoolId: result.contentPoolId,
      subjectKey: result.subjectKey,
      subjectKeys: result.subjectKeys ? [...result.subjectKeys] : undefined,
      lines: (result.lines ?? []).map(instruction => (
        resolveInstruction(instruction, participantIdByKey, templateValues)
      )),
      lineVariants: result.lineVariants?.map(lines => (
        lines.map(instruction => (
          resolveInstruction(instruction, participantIdByKey, templateValues)
        ))
      )),
      branchLines: Object.fromEntries(
        Object.entries(result.branchLines).map(([branchId, lines]) => [
          branchId,
          lines.map(instruction => (
            resolveInstruction(instruction, participantIdByKey, templateValues)
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
  templateValues: Readonly<Record<string, string>>,
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
      resolveInstruction(instruction, participantIdByKey, templateValues)
    )),
  };
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
): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => (
    values[key] ?? `{${key}}`
  ));
}
