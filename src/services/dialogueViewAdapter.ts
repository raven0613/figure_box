import { DEFAULT_EXPRESSION_PRESET_ID } from '~/constants/expressionCatalog';
import type { DialogueBank, DialogueLine, SelectedDialogue } from '~/constants/dialogue';
import { selectDialogueScript } from '~/constants/dialogueEvents';
import type { EventActor, EventBlackboard, ParticipantRole, PlayDialogueCommand } from '~/constants/event';
import { getDialogueAvatarState } from '~/services/dialogueAvatarStateService';
import type {
  DialogueChoiceInstruction,
  DialogueInstruction,
  DialogueParticipant,
  DialogueParticipantRole,
  DialogueSayInstruction,
  DialogueScriptDocument,
} from '~/typing/dialogue';
import type {
  DialogueViewChoice,
  DialogueViewInstruction,
  DialogueViewLine,
  DialogueViewParticipant,
  DialogueViewScript,
} from '~/typing/dialogueView';

export function createDialogueViewScriptFromDocument(
  script: DialogueScriptDocument,
  participants: DialogueParticipant[],
): DialogueViewScript {
  return {
    id: script.id,
    participants: participants.map(createDialogueViewParticipant),
    lines: script.lines.flatMap((instruction, index) => convertInstruction(instruction, participants, index)),
  };
}

export function createDialogueViewScriptFromPlayDialogueCommand(
  command: PlayDialogueCommand,
  dialogueBank: DialogueBank,
  initiator: EventActor,
  target: EventActor,
  blackboard: EventBlackboard,
): DialogueViewScript | null {
  const selectedDialogue = selectDialogueScript(command, dialogueBank, initiator, target, blackboard);

  if (!selectedDialogue) {
    return null;
  }

  return createDialogueViewScriptFromSelectedDialogue(
    selectedDialogue,
    [
      {
        id: initiator.id,
        role: 'initiator',
        name: initiator.name,
      },
      {
        id: target.id,
        role: 'target',
        name: target.name,
      },
    ],
  );
}

export function createDialogueViewScriptFromSelectedDialogue(
  selectedDialogue: SelectedDialogue,
  participants: DialogueParticipant[],
): DialogueViewScript {
  return {
    id: selectedDialogue.scriptId,
    participants: participants.map(createDialogueViewParticipant),
    lines: selectedDialogue.lines.map((line, index) => convertDialogueLine(line, participants, index)),
  };
}

function createDialogueViewParticipant(
  participant: DialogueParticipant,
  index: number,
): DialogueViewParticipant {
  return {
    id: participant.id,
    name: participant.name,
    color: getFallbackColor(index),
    label: participant.name.slice(0, 1).toUpperCase(),
    slot: index % 2 === 0 ? 'left' : 'right',
    avatarState: getDialogueAvatarState(participant.id),
  };
}

function convertInstruction(
  instruction: DialogueInstruction,
  participants: DialogueParticipant[],
  index: number,
): DialogueViewInstruction[] {
  if (instruction.type === 'SAY') {
    return [convertSayInstruction(instruction, participants, index)];
  }

  if (instruction.type === 'CHOICE') {
    const speakerId = resolveSpeakerId(instruction.speaker, participants);

    return [{
      id: `choice-${index}`,
      type: 'CHOICE',
      speakerId,
      text: instruction.text ?? '',
      expressionPresetId: instruction.expressionPresetId ?? DEFAULT_EXPRESSION_PRESET_ID,
      idlePrompt: '還在嗎？',
      timeoutMs: 10000,
      choices: instruction.choices.map(choice => convertChoice(choice, participants)),
    }];
  }

  return [];
}

function convertSayInstruction(
  instruction: DialogueSayInstruction,
  participants: DialogueParticipant[],
  index: number,
): DialogueViewLine {
  return {
    id: `line-${index}`,
    type: 'SAY',
    speakerId: resolveSpeakerId(instruction.speaker, participants),
    text: instruction.text,
    expressionPresetId: instruction.expressionPresetId ?? DEFAULT_EXPRESSION_PRESET_ID,
  };
}

function convertDialogueLine(
  line: DialogueLine,
  participants: DialogueParticipant[],
  index: number,
): DialogueViewLine {
  return {
    id: `line-${index}`,
    type: 'SAY',
    speakerId: resolveSpeakerId(line.speaker, participants),
    text: line.text,
    expressionPresetId: line.expressionPresetId ?? DEFAULT_EXPRESSION_PRESET_ID,
  };
}

function convertChoice(
  choice: DialogueChoiceInstruction['choices'][number],
  participants: DialogueParticipant[],
): DialogueViewChoice {
  if (choice.nextLines) {
    return {
      id: choice.id,
      label: choice.label,
      result: {
        type: 'appendLines',
        lines: choice.nextLines.flatMap((instruction, index) => convertInstruction(instruction, participants, index)),
      },
    };
  }

  if (choice.nextIndex !== undefined) {
    return {
      id: choice.id,
      label: choice.label,
      result: {
        type: 'jumpTo',
        target: {
          type: 'index',
          index: choice.nextIndex,
        },
      },
    };
  }

  return {
    id: choice.id,
    label: choice.label,
    result: {
      type: 'end',
    },
  };
}

function resolveSpeakerId(
  role: DialogueParticipantRole | ParticipantRole | undefined,
  participants: DialogueParticipant[],
): string {
  return participants.find(participant => participant.role === role)?.id ?? participants[0]?.id ?? 'unknown';
}

function getFallbackColor(index: number): string {
  const colors = ['#413636', '#e57070', '#ff9900', '#33cc33'];
  return colors[index % colors.length];
}
