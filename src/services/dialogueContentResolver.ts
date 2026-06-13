import type { DirectedRelationship, ExpressionPresetId } from '~/constants/character';
import { resolveGossipTopic } from '~/services/gossipTopicResolver';

export interface ResolveDialogueContentInput {
  contentPoolId: string;
  subjectId: string;
  subjectName: string;
  relationships: readonly DirectedRelationship[];
  getCharacterName: (characterId: string) => string;
  timestamp?: number;
  random?: () => number;
}

export interface ResolvedDialogueContent {
  text: string;
  expressionPresetId: ExpressionPresetId;
}

type DialogueContentPoolResolver = (
  input: ResolveDialogueContentInput,
) => ResolvedDialogueContent | null;

const CONTENT_POOL_RESOLVERS: Readonly<Record<string, DialogueContentPoolResolver>> = {
  gossip: resolveGossipDialogueContent,
};

export function resolveDialogueContent(
  input: ResolveDialogueContentInput,
): ResolvedDialogueContent | null {
  return CONTENT_POOL_RESOLVERS[input.contentPoolId]?.(input) ?? null;
}

function resolveGossipDialogueContent(
  input: ResolveDialogueContentInput,
): ResolvedDialogueContent | null {
  const topic = resolveGossipTopic({
    subjectId: input.subjectId,
    subjectName: input.subjectName,
    relationships: input.relationships,
    getCharacterName: input.getCharacterName,
    timestamp: input.timestamp,
    random: input.random,
  });

  return topic
    ? {
      text: topic.text,
      expressionPresetId: topic.expressionPresetId,
    }
    : null;
}
