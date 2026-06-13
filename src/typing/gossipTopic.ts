import type { ExpressionPresetId, MemoryType } from '~/constants/character';

export interface GossipTopicDefinition {
  id: string;
  baseWeight: number;
  text: string;
  expressionPresetId: ExpressionPresetId;
}

export interface GossipMemoryTopicDefinition extends GossipTopicDefinition {
  memoryType: MemoryType;
  maxAgeMs: number;
}

export interface ResolvedGossipTopic {
  id: string;
  text: string;
  expressionPresetId: ExpressionPresetId;
  subjectId: string;
  memoryTargetId?: string;
}
