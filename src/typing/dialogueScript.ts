import type { ExpressionPresetId } from '~/constants/character';
import type { CharacterWayOfSaying } from '~/typing/characterProfile';
import type { DialogueAvatarSlot, DialogueViewInstruction } from './dialogueView';
import type { AvatarState } from '~/widgets/avatarCanvas';

export interface DialogueScriptDefinition {
  id: string;
  participants: readonly DialogueScriptParticipantDefinition[];
  lines: readonly DialogueScriptInstructionDefinition[];
  branchGroups?: Readonly<Record<string, DialogueScriptBranchGroupDefinition>>;
}

export interface DialogueScriptParticipantDefinition {
  key: string;
  slot: DialogueAvatarSlot;
}

export type DialogueScriptInstructionDefinition =
  | DialogueScriptSayDefinition
  | DialogueScriptInputDefinition
  | DialogueScriptActivityRollDefinition
  | DialogueScriptChoiceDefinition;

export interface DialogueScriptSayDefinition {
  id?: string;
  type: 'SAY';
  speaker: string;
  text: string;
  expressionPresetId: ExpressionPresetId;
}

export interface DialogueScriptInputDefinition {
  id?: string;
  type: 'INPUT';
  speaker: string;
  target: string;
  prompt: string;
  variable: string;
  fallbackValue: string;
  memoryKey: string;
  expressionPresetId: ExpressionPresetId;
}

export interface DialogueScriptChoiceDefinition {
  id?: string;
  type: 'CHOICE';
  speaker: string;
  text: string;
  expressionPresetId: ExpressionPresetId;
  idlePrompt?: string;
  idlePromptLines?: readonly DialogueScriptSayDefinition[];
  timeoutMs: number;
  choices: readonly DialogueScriptChoiceDefinitionOption[];
}

export type DialogueActivityRollContextValue = string | number | boolean;
export type DialogueActivityRollContext = Readonly<Record<string, DialogueActivityRollContextValue>>;

export interface DialogueScriptActivityRollDefinition {
  id?: string;
  type: 'ACTIVITY_ROLL';
  rollId: string;
  rollContext?: DialogueActivityRollContext;
  contentPoolId?: string;
  subjectKey?: string;
  subjectKeys?: readonly string[];
  lines?: readonly DialogueScriptInstructionDefinition[];
  lineVariants?: readonly (readonly DialogueScriptInstructionDefinition[])[];
  branchLines: Readonly<Record<string, readonly DialogueScriptInstructionDefinition[]>>;
}

export interface DialogueScriptChoiceDefinitionOption {
  id: string;
  label: string;
  result: DialogueScriptChoiceResultDefinition;
}

export type DialogueScriptChoiceResultDefinition =
  | {
    type: 'appendLines' | 'replaceRemaining';
    rollContext?: DialogueActivityRollContext;
    lines: readonly DialogueScriptInstructionDefinition[];
  }
  | {
    type: 'jumpTo';
    target: {
      type: 'index';
      index: number;
    } | {
      type: 'anchor';
      anchorId: string;
    };
  }
  | {
    type: 'branch';
    branchGroupId: string;
  }
  | {
    type: 'setRollContext';
    rollContext: DialogueActivityRollContext;
  }
  | {
    type: 'activityRoll';
    rollId: string;
    rollContext?: DialogueActivityRollContext;
    contentPoolId?: string;
    subjectKey?: string;
    subjectKeys?: readonly string[];
    lines?: readonly DialogueScriptInstructionDefinition[];
    lineVariants?: readonly (readonly DialogueScriptInstructionDefinition[])[];
    branchLines: Readonly<Record<string, readonly DialogueScriptInstructionDefinition[]>>;
  }
  | {
    type: 'end';
  };

export interface DialogueScriptBranchGroupDefinition {
  id: string;
  selectionStrategy: 'scoreWeighted' | 'rankWeighted';
  rankWeights?: readonly number[];
  candidates: readonly DialogueScriptBranchCandidateDefinition[];
}

export interface DialogueScriptBranchCandidateDefinition {
  id: string;
  selectionMode: 'required' | 'weighted';
  priority?: number;
  baseWeight: number;
  conditions?: readonly DialogueScriptConditionDefinition[];
  scoreRules?: readonly DialogueScriptScoreRuleDefinition[];
  lines: readonly DialogueScriptInstructionDefinition[];
}

export type DialogueScriptConditionDefinition =
  | {
    type: 'intimacyRange';
    source: string;
    target: string;
    min?: number;
    max?: number;
  }
  | {
    type: 'traitIncludes';
    participant: string;
    trait: string;
  };

export interface DialogueScriptScoreRuleDefinition {
  when: DialogueScriptConditionDefinition;
  add: number;
  multiplier?: number;
}

export interface DialogueScriptRuntimeParticipant {
  id: string;
  name: string;
  color: string;
  label: string;
  avatarState: AvatarState;
  wayOfSaying?: CharacterWayOfSaying;
}

export interface DialogueScriptRuntimeContext {
  participants: Readonly<Record<string, DialogueScriptRuntimeParticipant>>;
  traitsByParticipant?: Readonly<Record<string, readonly string[]>>;
  relationships?: readonly {
    source: string;
    target: string;
    intimacy: number;
  }[];
  recentBranchIds?: readonly string[];
  templateValues?: Readonly<Record<string, string>>;
  resolveActivityRoll?: (rollId: string, rollContext?: DialogueActivityRollContext) => string | null;
  resolveDialogueContent?: (
    contentPoolId: string,
    subjectKey: string,
  ) => readonly DialogueViewInstruction[] | null;
  recordSpokenLine?: (input: {
    speakerId: string;
    targetId: string;
    memoryKey: string;
    text: string;
  }) => void;
  random?: () => number;
}
