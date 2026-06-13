import type { DirectedRelationship } from '~/constants/character';
import {
  GOSSIP_MEMORY_TOPIC_DEFINITIONS,
  GOSSIP_TOPIC_DEFINITIONS,
} from '~/constants/gossipTopics';
import { WeightedDecisionSelector } from '~/services/decisionSelector';
import type { WeightedCandidate } from '~/services/decisionSelector';
import type { ResolvedGossipTopic } from '~/typing/gossipTopic';

interface ResolveGossipTopicInput {
  subjectId: string;
  subjectName: string;
  relationships: readonly DirectedRelationship[];
  getCharacterName: (characterId: string) => string;
  timestamp?: number;
  random?: () => number;
}

const decisionSelector = new WeightedDecisionSelector();

export function resolveGossipTopic(
  input: ResolveGossipTopicInput,
): ResolvedGossipTopic | null {
  const timestamp = input.timestamp ?? Date.now();
  const commonCandidates: WeightedCandidate<ResolvedGossipTopic>[] = GOSSIP_TOPIC_DEFINITIONS.map(definition => ({
    item: {
      id: definition.id,
      text: formatGossipText(definition.text, {
        subjectName: input.subjectName,
      }),
      expressionPresetId: definition.expressionPresetId,
      subjectId: input.subjectId,
    },
    weight: definition.baseWeight,
  }));
  const memoryCandidates: WeightedCandidate<ResolvedGossipTopic>[] = input.relationships
    .filter(relationship => relationship.charId === input.subjectId)
    .flatMap(relationship => (
      GOSSIP_MEMORY_TOPIC_DEFINITIONS.flatMap(definition => {
        const memory = relationship.memories[definition.memoryType];

        if (
          memory.counts <= 0
          || timestamp - memory.lastUpdate > definition.maxAgeMs
        ) {
          return [];
        }

        return [{
          item: {
            id: `${definition.id}:${relationship.targetCharId}`,
            text: formatGossipText(definition.text, {
              subjectName: input.subjectName,
              memoryTargetName: input.getCharacterName(relationship.targetCharId),
            }),
            expressionPresetId: definition.expressionPresetId,
            subjectId: input.subjectId,
            memoryTargetId: relationship.targetCharId,
          },
          weight: definition.baseWeight,
        }];
      })
    ));

  return decisionSelector.select(
    [...commonCandidates, ...memoryCandidates],
    input.random,
  );
}

function formatGossipText(
  template: string,
  values: Readonly<Record<string, string>>,
): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => (
    values[key] ?? `{${key}}`
  ));
}
