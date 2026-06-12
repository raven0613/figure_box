import type { CharacterBaseSetting, Expression } from '~/constants/character';

export type DialogueAvatarSlot = 'left' | 'center-left' | 'center-right' | 'right';

export interface DialogueViewParticipant {
  id: string;
  name: string;
  color: string;
  label: string;
  slot: DialogueAvatarSlot;
  appearance?: CharacterBaseSetting;
}

export interface DialogueViewLine {
  id?: string;
  type: 'SAY';
  speakerId: string;
  text: string;
  expression: Expression;
}

export interface DialogueViewChoice {
  id: string;
  label: string;
  result: DialogueChoiceResult;
}

export type DialogueChoiceResult =
  | {
    type: 'appendLines';
    lines: DialogueViewInstruction[];
  }
  | {
    type: 'replaceRemaining';
    lines: DialogueViewInstruction[];
  }
  | {
    type: 'jumpTo';
    target: DialogueJumpTarget;
  }
  | {
    type: 'branch';
    branchGroupId: string;
  }
  | {
    type: 'activityRoll';
    rollId: string;
    contentPoolId?: string;
    subjectKey?: string;
    subjectKeys?: string[];
    lines: DialogueViewInstruction[];
    lineVariants?: DialogueViewInstruction[][];
    branchLines: Record<string, DialogueViewInstruction[]>;
  }
  | {
    type: 'end';
  };

export type DialogueJumpTarget =
  | {
    type: 'index';
    index: number;
  }
  | {
    type: 'anchor';
    anchorId: string;
  };

export interface DialogueBranchCharacterState {
  id: string;
  traits: string[];
}

export interface DialogueBranchRelationshipState {
  sourceId: string;
  targetId: string;
  intimacy: number;
}

export interface DialogueBranchContext {
  characters: DialogueBranchCharacterState[];
  relationships: DialogueBranchRelationshipState[];
  recentBranchIds?: string[];
  random?: () => number;
}

export type DialogueCondition =
  | {
    type: 'intimacyRange';
    sourceId: string;
    targetId: string;
    min?: number;
    max?: number;
  }
  | {
    type: 'traitIncludes';
    characterId: string;
    trait: string;
  };

export interface DialogueScoreRule {
  when: DialogueCondition;
  add: number;
  multiplier?: number;
}

export interface DialogueBranchCandidate {
  id: string;
  selectionMode: 'required' | 'weighted';
  priority?: number;
  baseWeight: number;
  conditions?: DialogueCondition[];
  scoreRules?: DialogueScoreRule[];
  lines: DialogueViewInstruction[];
}

export interface DialogueBranchGroup {
  id: string;
  selectionStrategy: 'scoreWeighted' | 'rankWeighted';
  rankWeights?: number[];
  candidates: DialogueBranchCandidate[];
}

export interface DialogueViewChoiceLine {
  id?: string;
  type: 'CHOICE';
  speakerId: string;
  text: string;
  expression: Expression;
  idlePrompt?: string;
  idlePromptLines?: DialogueViewLine[];
  timeoutMs: number;
  choices: DialogueViewChoice[];
}

export type DialogueViewInstruction = DialogueViewLine | DialogueViewChoiceLine;

export interface DialogueViewScript {
  id: string;
  participants: DialogueViewParticipant[];
  lines: DialogueViewInstruction[];
  branchGroups?: Record<string, DialogueBranchGroup>;
  branchContext?: DialogueBranchContext;
  resolveActivityRoll?: (rollId: string) => string | null;
  resolveDialogueContent?: (
    contentPoolId: string,
    subjectKey: string,
  ) => readonly DialogueViewInstruction[] | null;
}
