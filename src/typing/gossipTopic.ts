import type { Expression, MemoryType } from '~/constants/character';

export interface GossipTopicDefinition {
  id: string;
  baseWeight: number;
  text: string;
  expression: Expression;
}

export interface GossipMemoryTopicDefinition extends GossipTopicDefinition {
  memoryType: MemoryType;
  maxAgeMs: number;
}

export interface ResolvedGossipTopic {
  id: string;
  text: string;
  expression: Expression;
  subjectId: string;
  memoryTargetId?: string;
}
