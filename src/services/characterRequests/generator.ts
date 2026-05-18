import { createCharacterEventRuleContext, matchesCharacterEventClauses } from '~/services/characterEvents/rules';
import type { CharacterEventDecisionInput } from '~/services/characterEvents/types';
import type { CharacterContext } from '~/stateMachines/gameFlow/context';
import { calculateCharacterUtilityScores } from '~/services/characterEvents/utility';
import { WeightedDecisionSelector } from '~/services/decisionSelector';
import type {
  CharacterRequestCandidate,
  CharacterRequestCharacterTarget,
  CharacterRequestDefinition,
  CharacterRequestTarget,
} from './types';

export interface CharacterRequestGeneratorInput extends CharacterEventDecisionInput {
  context: CharacterContext;
  relationshipTargets?: readonly CharacterRequestCharacterTarget[];
}

const REQUEST_LEVEL_PRIORITY = ['critical', 'social', 'minor'] as const;

export class CharacterRequestGenerator {
  private readonly selector = new WeightedDecisionSelector();
  private readonly definitions: readonly CharacterRequestDefinition[];

  constructor(definitions: readonly CharacterRequestDefinition[]) {
    this.definitions = definitions;
  }

  selectCandidate(
    input: CharacterRequestGeneratorInput,
    random: () => number,
  ): CharacterRequestCandidate | null {
    const utilityScores = calculateCharacterUtilityScores(input.context);
    const ruleContext = createCharacterEventRuleContext(input.context, utilityScores, input);

    for (const level of REQUEST_LEVEL_PRIORITY) {
      const candidates = this.definitions
        .filter(definition => definition.level === level)
        .filter(definition => matchesCharacterEventClauses(definition.conditions, definition.conditionMode, ruleContext))
        .filter(definition => random() <= definition.baseChance)
        .flatMap(definition => this.expandDefinitionCandidates(definition, input));
      const selectedCandidate = this.selector.select(
        candidates.map(candidate => ({ item: candidate, weight: candidate.weight })),
        random,
      );

      if (selectedCandidate) {
        return selectedCandidate;
      }
    }

    return null;
  }

  private expandDefinitionCandidates(
    definition: CharacterRequestDefinition,
    input: CharacterRequestGeneratorInput,
  ): CharacterRequestCandidate[] {
    if (!definition.targetSelector) {
      return [{
        definition,
        target: definition.target,
        label: definition.label,
        weight: definition.baseChance,
      }];
    }

    const targetSelector = definition.targetSelector;

    if (targetSelector.type === 'characterByRelationship') {
      return (input.relationshipTargets ?? [])
        .filter(target => targetSelector.statuses.includes(target.socialStatus))
        .map(target => {
          const requestTarget: CharacterRequestTarget = {
            ...definition.target,
            targetCharacterId: target.characterId,
            targetCharacterName: target.characterName,
          };

          return {
            definition,
            target: requestTarget,
            label: formatCharacterRequestLabel(definition.label, target.characterName),
            weight: definition.baseChance *
              (targetSelector.statusWeight?.[target.socialStatus] ?? 1),
          };
        });
    }

    return [];
  }
}

function formatCharacterRequestLabel(label: string, targetName: string): string {
  return label.replaceAll('{targetName}', targetName);
}
