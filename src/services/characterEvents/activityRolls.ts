import type { Feeling, Mood } from '~/constants/character';
import type { CharacterPersonality } from '~/constants/characterPersonality';
import type {
  CharacterEventActivityRoll,
  CharacterEventActivityRollBranch,
  CharacterEventActivityRollRuleClause,
  CharacterEventActivityRollWeightModifier,
} from '~/constants/charactarEventsDefinitions';
import { WeightedDecisionSelector } from '~/services/decisionSelector';
import {
  applyRuleWeightModifiers,
  matchesRuleClauses,
} from '~/services/ruleEvaluator';

export interface ActivityRollCharacterContext {
  status: {
    mood: Mood;
    moodValue: number;
  };
  personality: CharacterPersonality;
  relationshipToOther: {
    feeling: Feeling;
    intimacy: number;
  };
}

export interface ActivityRollSelection {
  selectedBranchId: string;
}

export interface ActivityRollRuleContext {
  initiator: ActivityRollCharacterContext & {
    relationshipToTarget: ActivityRollCharacterContext['relationshipToOther'];
  };
  target: ActivityRollCharacterContext & {
    relationshipToInitiator: ActivityRollCharacterContext['relationshipToOther'];
  };
  activity: {
    participantCount: number;
    rolls: Readonly<Record<string, ActivityRollSelection>>;
  };
}

const decisionSelector = new WeightedDecisionSelector();

export function selectActivityRollBranch(
  roll: CharacterEventActivityRoll,
  context: ActivityRollRuleContext,
  random: () => number = Math.random,
): CharacterEventActivityRollBranch | null {
  const candidates = roll.branches
    .filter(branch => matchesActivityRollClauses(
      branch.conditions,
      branch.conditionMode,
      context,
    ))
    .map(branch => ({
      item: branch,
      weight: applyActivityRollWeightModifiers(
        branch.baseWeight,
        branch.weightModifiers,
        context,
      ),
    }));

  return decisionSelector.select(candidates, random);
}

function matchesActivityRollClauses(
  clauses: readonly CharacterEventActivityRollRuleClause[] | undefined,
  mode: CharacterEventActivityRollBranch['conditionMode'],
  context: ActivityRollRuleContext,
): boolean {
  return matchesRuleClauses(
    clauses,
    mode,
    context,
    readActivityRollRuleValue,
  );
}

function applyActivityRollWeightModifiers(
  baseWeight: number,
  modifiers: readonly CharacterEventActivityRollWeightModifier[] | undefined,
  context: ActivityRollRuleContext,
): number {
  return applyRuleWeightModifiers(
    baseWeight,
    modifiers,
    context,
    readActivityRollRuleValue,
  );
}

function readActivityRollRuleValue(
  path: CharacterEventActivityRollRuleClause['path'],
  context: ActivityRollRuleContext,
): unknown {
  return path.split('.').reduce<unknown>((value, segment) => {
    if (!value || typeof value !== 'object') {
      return undefined;
    }

    return (value as Record<string, unknown>)[segment];
  }, context);
}
