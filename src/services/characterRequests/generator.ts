import { createCharacterEventRuleContext, matchesCharacterEventClauses } from '~/services/characterEvents/rules';
import type { CharacterEventDecisionInput } from '~/services/characterEvents/types';
import type { CharacterContext } from '~/stateMachines/gameFlow/context';
import { calculateCharacterUtilityScores } from '~/services/characterEvents/utility';
import { WeightedDecisionSelector } from '~/services/decisionSelector';
import type { CharacterRequestDefinition } from './types';

export interface CharacterRequestGeneratorInput extends CharacterEventDecisionInput {
  context: CharacterContext;
}

export class CharacterRequestGenerator {
  private readonly selector = new WeightedDecisionSelector();
  private readonly definitions: readonly CharacterRequestDefinition[];

  constructor(definitions: readonly CharacterRequestDefinition[]) {
    this.definitions = definitions;
  }

  selectDefinition(
    input: CharacterRequestGeneratorInput,
    random: () => number,
  ): CharacterRequestDefinition | null {
    const utilityScores = calculateCharacterUtilityScores(input.context);
    const ruleContext = createCharacterEventRuleContext(input.context, utilityScores, input);
    const candidates = this.definitions
      .filter(definition => matchesCharacterEventClauses(definition.conditions, definition.conditionMode, ruleContext))
      .filter(definition => random() <= definition.baseChance)
      .map(definition => ({
        definition,
        weight: definition.baseChance,
      }));
    const selectedCandidate = this.selector.select(
      candidates.map(candidate => ({ item: candidate, weight: candidate.weight })),
      random,
    );

    return selectedCandidate?.definition ?? null;
  }
}
