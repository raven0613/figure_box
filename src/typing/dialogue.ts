import type { CharacterEvent } from '../stateMachines/gameFlow/events';
import type { Expression } from '~/constants/character';

export type DialogueParticipantRole = 'initiator' | 'target';

export interface DialogueParticipant {
  id: string;
  role: DialogueParticipantRole;
  name: string;
}

export type DialogueInstruction =
  | DialogueSayInstruction
  | DialogueCharacterInstruction
  | DialogueChoiceInstruction;

export interface DialogueSayInstruction {
  type: 'SAY';
  speaker: DialogueParticipantRole;
  text: string;
  expression?: Expression;
}

export interface DialogueCharacterInstruction {
  type: 'CHARACTER';
  target: DialogueParticipantRole | 'both' | string;
  command: CharacterEvent;
  label?: string;
}

export interface DialogueChoiceInstruction {
  type: 'CHOICE';
  speaker?: DialogueParticipantRole;
  text?: string;
  expression?: Expression;
  choices: DialogueChoiceOption[];
}

export interface DialogueChoiceOption {
  id: string;
  label: string;
  nextIndex?: number;
  nextLines?: DialogueInstruction[];
}

export interface DialogueScriptDocument {
  id: string;
  lines: DialogueInstruction[];
}
