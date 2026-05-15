import type {
  DialogueBranchCandidate,
  DialogueBranchContext,
  DialogueChoiceResult,
  DialogueCondition,
  DialogueJumpTarget,
  DialogueViewInstruction,
  DialogueViewScript,
} from '~/constants/dialogueDemo';

export interface DialogueChoiceResolution {
  instructions: DialogueViewInstruction[];
  nextLineIndex: number;
  shouldClose: boolean;
}

export function resolveDialogueChoiceResult(
  script: DialogueViewScript,
  instructions: DialogueViewInstruction[],
  lineIndex: number,
  result: DialogueChoiceResult,
): DialogueChoiceResolution {
  switch (result.type) {
    case 'appendLines':
      return {
        instructions: [
          ...instructions.slice(0, lineIndex + 1),
          ...result.lines,
          ...instructions.slice(lineIndex + 1),
        ],
        nextLineIndex: lineIndex + 1,
        shouldClose: false,
      };
    case 'replaceRemaining':
      return {
        instructions: [
          ...instructions.slice(0, lineIndex + 1),
          ...result.lines,
        ],
        nextLineIndex: lineIndex + 1,
        shouldClose: false,
      };
    case 'jumpTo':
      return {
        instructions,
        nextLineIndex: resolveJumpTarget(instructions, result.target) ?? lineIndex,
        shouldClose: false,
      };
    case 'branch':
      return resolveBranchChoice(script, instructions, lineIndex, result.branchGroupId);
    case 'end':
      return {
        instructions,
        nextLineIndex: lineIndex,
        shouldClose: true,
      };
    default:
      return {
        instructions,
        nextLineIndex: lineIndex,
        shouldClose: false,
      };
  }
}

function resolveBranchChoice(
  script: DialogueViewScript,
  instructions: DialogueViewInstruction[],
  lineIndex: number,
  branchGroupId: string,
): DialogueChoiceResolution {
  const branchGroup = script.branchGroups?.[branchGroupId];
  const selectedCandidate = branchGroup && script.branchContext
    ? selectBranchCandidate(branchGroup.candidates, script.branchContext, branchGroup.selectionStrategy, branchGroup.rankWeights)
    : null;

  return {
    instructions: [
      ...instructions.slice(0, lineIndex + 1),
      ...(selectedCandidate?.lines ?? []),
      ...instructions.slice(lineIndex + 1),
    ],
    nextLineIndex: lineIndex + 1,
    shouldClose: false,
  };
}

function selectBranchCandidate(
  candidates: DialogueBranchCandidate[],
  context: DialogueBranchContext,
  selectionStrategy: 'scoreWeighted' | 'rankWeighted',
  rankWeights: number[] = [],
): DialogueBranchCandidate | null {
  const validCandidates = candidates.filter(candidate => (
    !context.recentBranchIds?.includes(candidate.id)
    && matchesAllConditions(candidate.conditions, context)
  ));

  const requiredCandidates = validCandidates
    .filter(candidate => candidate.selectionMode === 'required')
    .sort((first, second) => (second.priority ?? 0) - (first.priority ?? 0));

  if (requiredCandidates.length > 0) {
    const topPriority = requiredCandidates[0].priority ?? 0;
    const topCandidates = requiredCandidates.filter(candidate => (candidate.priority ?? 0) === topPriority);
    return sampleWeighted(topCandidates, candidate => Math.max(0, scoreBranchCandidate(candidate, context)), context.random ?? Math.random);
  }

  const weightedCandidates = validCandidates
    .filter(candidate => candidate.selectionMode === 'weighted')
    .map(candidate => ({
      candidate,
      score: scoreBranchCandidate(candidate, context),
    }))
    .filter(entry => entry.score > 0);

  if (weightedCandidates.length === 0) {
    return null;
  }

  if (selectionStrategy === 'rankWeighted') {
    const rankedCandidates = weightedCandidates.sort((first, second) => second.score - first.score);
    return sampleWeighted(
      rankedCandidates,
      (_entry, index) => rankWeights[index] ?? Math.max(1, rankedCandidates.length - index),
      context.random ?? Math.random,
    )?.candidate ?? null;
  }

  return sampleWeighted(
    weightedCandidates,
    entry => entry.score,
    context.random ?? Math.random,
  )?.candidate ?? null;
}

function scoreBranchCandidate(candidate: DialogueBranchCandidate, context: DialogueBranchContext): number {
  return (candidate.scoreRules ?? []).reduce((score, rule) => {
    if (!matchesCondition(rule.when, context)) {
      return score;
    }

    return Math.max(0, (score + rule.add) * (rule.multiplier ?? 1));
  }, candidate.baseWeight);
}

function matchesAllConditions(
  conditions: DialogueCondition[] | undefined,
  context: DialogueBranchContext,
): boolean {
  return !conditions || conditions.every(condition => matchesCondition(condition, context));
}

function matchesCondition(condition: DialogueCondition, context: DialogueBranchContext): boolean {
  switch (condition.type) {
    case 'intimacyRange': {
      const relationship = context.relationships.find(entry => (
        entry.sourceId === condition.sourceId && entry.targetId === condition.targetId
      ));
      const intimacy = relationship?.intimacy ?? 0;

      return (
        (condition.min === undefined || intimacy >= condition.min)
        && (condition.max === undefined || intimacy <= condition.max)
      );
    }
    case 'traitIncludes':
      return context.characters
        .find(character => character.id === condition.characterId)
        ?.traits.includes(condition.trait) ?? false;
    default:
      return false;
  }
}

function resolveJumpTarget(
  instructions: DialogueViewInstruction[],
  target: DialogueJumpTarget,
): number | null {
  if (target.type === 'index') {
    return target.index >= 0 && target.index < instructions.length ? target.index : null;
  }

  const anchorIndex = instructions.findIndex(instruction => instruction.id === target.anchorId);
  return anchorIndex >= 0 ? anchorIndex : null;
}

function sampleWeighted<T>(
  candidates: T[],
  getWeight: (candidate: T, index: number) => number,
  random: () => number,
): T | null {
  const totalWeight = candidates.reduce((sum, candidate, index) => sum + getWeight(candidate, index), 0);

  if (totalWeight <= 0) {
    return null;
  }

  let cursor = random() * totalWeight;

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    cursor -= getWeight(candidate, index);

    if (cursor <= 0) {
      return candidate;
    }
  }

  return candidates.at(-1) ?? null;
}
