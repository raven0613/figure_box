import type { CharacterBaseSetting, Expression } from '~/constants/character';
import type { DialogueAvatarSlot, DialogueViewInstruction } from './dialogueView';

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
  | DialogueScriptChoiceDefinition;

export interface DialogueScriptSayDefinition {
  id?: string;
  type: 'SAY';
  speaker: string;
  text: string;
  expression: Expression;
}

export interface DialogueScriptChoiceDefinition {
  id?: string;
  type: 'CHOICE';
  speaker: string;
  text: string;
  expression: Expression;
  idlePrompt?: string;
  idlePromptLines?: readonly DialogueScriptSayDefinition[];
  timeoutMs: number;
  choices: readonly DialogueScriptChoiceDefinitionOption[];
}

export interface DialogueScriptChoiceDefinitionOption {
  id: string;
  label: string;
  result: DialogueScriptChoiceResultDefinition;
}

export type DialogueScriptChoiceResultDefinition =
  | {
    type: 'appendLines' | 'replaceRemaining';
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
    type: 'activityRoll';
    rollId: string;
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
  appearance?: CharacterBaseSetting;
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
  resolveActivityRoll?: (rollId: string) => string | null;
  resolveDialogueContent?: (
    contentPoolId: string,
    subjectKey: string,
  ) => readonly DialogueViewInstruction[] | null;
  random?: () => number;
}
