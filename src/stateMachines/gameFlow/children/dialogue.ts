import { assign, createMachine, emit, enqueueActions } from 'xstate';
import { DialogueManagerEmittedEvent, DialogueManagerEvent, EventType } from '../events';
import type {
  DialogueCharacterInstruction,
  DialogueChoiceInstruction,
  DialogueInstruction,
  DialogueParticipant,
  DialogueParticipantRole,
} from '../../../typing/dialogue';
import { DialogueManagerContext } from '../context';

const initialContext: DialogueManagerContext = {
  script: null,
  participants: [],
  cursor: 0,
  activeChoice: null,
  resolvedChoiceId: null,
};

const LINE_ADVANCE_DELAY_MS = 1600;

export const dialogueManagerMachine = createMachine(
  {
    id: 'dialogueManager',
    types: {} as {
      context: DialogueManagerContext;
      events: DialogueManagerEvent;
      emitted: DialogueManagerEmittedEvent;
    },
    initial: 'idle',
    context: initialContext,
    states: {
      idle: {
        on: {
          START_DIALOGUE: {
            target: 'reading',
            actions: 'startDialogue',
          },
        },
      },
      reading: {
        always: [
          {
            guard: 'isChoiceLine',
            target: 'waitingChoice',
            actions: 'openChoice',
          },
          {
            guard: 'hasReadableLine',
            target: 'dispatching',
          },
          {
            target: 'finished',
          },
        ],
        on: {
          CANCEL_DIALOGUE: {
            target: 'idle',
            actions: ['releaseDialogueWait', 'emitDialogueEnded', 'clearDialogue'],
          },
        },
      },
      dispatching: {
        entry: ['dispatchCurrentLine', 'advanceCursor'],
        after: {
          [LINE_ADVANCE_DELAY_MS]: {
            target: 'reading',
          },
        },
        on: {
          CANCEL_DIALOGUE: {
            target: 'idle',
            actions: ['releaseDialogueWait', 'emitDialogueEnded', 'clearDialogue'],
          },
        },
      },
      waitingChoice: {
        entry: 'emitChoiceRequested',
        after: {
          10000: {
            actions: 'emitIdleWhisper',
          },
        },
        on: {
          RESOLVE: {
            target: 'reading',
            actions: ['resolveChoice', 'closeChoice'],
          },
          CANCEL_DIALOGUE: {
            target: 'idle',
            actions: ['releaseDialogueWait', 'emitDialogueEnded', 'clearDialogue'],
          },
        },
      },
      finished: {
        entry: ['releaseDialogueWait', 'emitDialogueEnded', 'clearDialogue'],
        always: {
          target: 'idle',
        },
      },
    },
  },
  {
    guards: {
      hasReadableLine: ({ context }) => getCurrentLine(context) !== null,
      isChoiceLine: ({ context }) => getCurrentLine(context)?.type === 'CHOICE',
    },
    actions: {
      startDialogue: assign(({ event }) => {
        if (event.type !== 'START_DIALOGUE') {
          return {};
        }

        return {
          script: event.script,
          participants: event.participants,
          cursor: 0,
          activeChoice: null,
          resolvedChoiceId: null,
        };
      }),
      openChoice: assign({
        activeChoice: ({ context }) => getCurrentLine(context) as DialogueChoiceInstruction,
      }),
      closeChoice: assign({
        activeChoice: () => null,
      }),
      advanceCursor: assign({
        cursor: ({ context }) => context.cursor + 1,
      }),
      resolveChoice: enqueueActions(({ context, event, enqueue }) => {
        if (event.type !== 'RESOLVE') {
          return;
        }

        const option = context.activeChoice?.choices.find(choice => choice.id === event.choiceId);
        const participantIds = getParticipantIds(context.participants);

        enqueue.assign({
          script: option?.nextLines && context.script
            ? {
              ...context.script,
              lines: [
                ...context.script.lines.slice(0, context.cursor + 1),
                ...option.nextLines,
              ],
            }
            : context.script,
          cursor: option?.nextIndex ?? context.cursor + 1,
          resolvedChoiceId: event.choiceId,
        });

        participantIds.forEach(characterId => {
          enqueue.emit({
            type: 'DIALOGUE_CHARACTER_EVENT',
            characterId,
            event: { type: EventType.RemoveLock, parts: ['bodyAction', 'bodyMove', 'communication'], reason: 'dialogue' },
          });
        });

        enqueue.emit({
          type: 'DIALOGUE_CHOICE_RESOLVED',
          choiceId: event.choiceId,
          participantIds,
        });
      }),
      dispatchCurrentLine: enqueueActions(({ context, enqueue }) => {
        const line = getCurrentLine(context);

        if (!line) {
          return;
        }

        if (line.type === 'SAY') {
          const speakerId = getParticipantId(context.participants, line.speaker);

          if (speakerId) {
            enqueue.emit({
              type: 'DIALOGUE_LINE',
              speakerId,
              text: line.text,
              expression: line.expression,
            });
          }
          return;
        }

        if (line.type === 'CHARACTER') {
          resolveCharacterTargets(context.participants, line).forEach(characterId => {
            enqueue.emit({
              type: 'DIALOGUE_CHARACTER_EVENT',
              characterId,
              event: line.command,
            });
          });
        }
      }),
      emitChoiceRequested: enqueueActions(({ context, enqueue }) => {
        const participantIds = getParticipantIds(context.participants);

        participantIds.forEach(characterId => {
          enqueue.emit({
            type: 'DIALOGUE_CHARACTER_EVENT',
            characterId,
            event: { type: EventType.AddLock, parts: ['bodyAction', 'bodyMove', 'communication'], reason: 'dialogue' },
          });
        });

        if (context.activeChoice) {
          enqueue.emit({
            type: 'DIALOGUE_CHOICE_REQUESTED',
            choice: context.activeChoice,
            participantIds,
          });
        }
      }),
      emitIdleWhisper: enqueueActions(({ context, enqueue }) => {
        const targetId = getParticipantId(context.participants, 'target');
        if (targetId) {
          enqueue.emit({
            type: 'DIALOGUE_LINE',
            speakerId: targetId,
            text: '還在嗎？',
          });
        }
      }),
      releaseDialogueWait: enqueueActions(({ context, enqueue }) => {
        getParticipantIds(context.participants).forEach(characterId => {
          enqueue.emit({
            type: 'DIALOGUE_CHARACTER_EVENT',
            characterId,
            event: { type: EventType.RemoveLock, parts: ['bodyAction', 'bodyMove', 'communication'], reason: 'dialogue' },
          });
        });
      }),
      emitDialogueEnded: emit(({ context }) => ({
        type: 'DIALOGUE_ENDED',
        scriptId: context.script?.id ?? null,
        participantIds: getParticipantIds(context.participants),
      })),
      clearDialogue: assign(() => initialContext),
    },
  },
);

function getCurrentLine(context: DialogueManagerContext): DialogueInstruction | null {
  return context.script?.lines[context.cursor] ?? null;
}

function getParticipantId(
  participants: DialogueParticipant[],
  role: DialogueParticipantRole,
): string | null {
  return participants.find(participant => participant.role === role)?.id ?? null;
}

function getParticipantIds(participants: DialogueParticipant[]): string[] {
  return participants.map(participant => participant.id);
}

function resolveCharacterTargets(
  participants: DialogueParticipant[],
  instruction: DialogueCharacterInstruction,
): string[] {
  if (instruction.target === 'both') {
    return getParticipantIds(participants);
  }

  const byRole = participants.find(participant => participant.role === instruction.target);

  return byRole ? [byRole.id] : [instruction.target];
}
