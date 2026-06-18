import { assign, createMachine, forwardTo, fromCallback } from 'xstate';
import { GameFlowEvents } from './events';
import {
  GameGodState,
  GameState,
  GameSystemState,
  GameSimWorldState,
} from './states';
import type { GameFlowContext } from './context';
import { createRelationshipStore } from './relationships';
import { dialogueManagerMachine } from './children/dialogue';

export const ABLY_TRANSFER_TIME = 700;

export const gameFlowMachine = createMachine(
  {
    id: 'game flow',
    types: {} as {
      context: GameFlowContext;
      events: GameFlowEvents;
    },
    initial: GameState.Loading,
    context: {
      relationships: createRelationshipStore(),
      activityObservation: null,
    },
    states: {
      [GameState.Loading]: {
        entry: assign({
        }),
        on: {
          LOADING_COMPLETE: {
            target: GameState.Active,
          },
          LOADING_FAILED: {
            target: GameState.Error,
          },
        },
      },

      [GameState.Active]: {
        type: 'parallel',
        invoke: [
          {
            src: 'loginSocket',
          },
          {
            src: 'spyingNetwork',
          },
        ],
        states: {
          system: {
            initial: GameSystemState.Null,
            states: {
              [GameSystemState.Null]: {
                on: {
                  OPEN_SYSTEM_UI: {
                    target: GameSystemState.Operating,
                  },
                },
              },
              [GameSystemState.Operating]: {
                on: {
                  CLOSE_SYSTEM_UI: {
                    target: GameSystemState.Null,
                  },
                },
              },
            },
          },
          god: {
            initial: GameGodState.Normal,
            states: {
              [GameGodState.Normal]: {
                on: {
                  START_INTERACTION: {
                    target: GameGodState.Interaction,
                  },
                  PICK_CHARACTER: {
                    target: GameGodState.Interaction,
                  },
                },
              },
              [GameGodState.Interaction]: {
                on: {
                  END_INTERACTION: {
                    target: GameGodState.Normal,
                  },
                  RELEASE_CHARACTER: {
                    target: GameGodState.Normal,
                  },
                },
              },
            },
          },
          world: {
            invoke: [
              {
                src: 'heartbeat',
              },
              {
                src: 'gameFlowSocket',
              },
            ],
            initial: GameSimWorldState.Running,
            states: {
              [GameSimWorldState.Running]: {
                on: {
                  PAUSE_SIM_WORLD: {
                    target: GameSimWorldState.ManuallyPaused,
                  },
                  START_ACTIVITY_OBSERVATION: {
                    target: GameSimWorldState.ActivityObservationPaused,
                    actions: 'startActivityObservation',
                  },
                  ACTIVITY_OBSERVATION_SETTLED: {
                    guard: 'isCurrentActivityObservationEvent',
                    actions: 'clearActivityObservation',
                  },
                },
              },
              [GameSimWorldState.ManuallyPaused]: {
                on: {
                  RESUME_SIM_WORLD: {
                    target: GameSimWorldState.Running,
                  },
                  START_ACTIVITY_OBSERVATION: {
                    target: GameSimWorldState.ActivityObservationPaused,
                    actions: 'startActivityObservation',
                  },
                  ACTIVITY_OBSERVATION_SETTLED: {
                    guard: 'isCurrentActivityObservationEvent',
                    actions: 'clearActivityObservation',
                  },
                },
              },
              [GameSimWorldState.ActivityObservationPaused]: {
                on: {
                  ACTIVITY_OBSERVATION_DIALOGUE_CLOSED: {
                    guard: 'isCurrentActivityObservationEvent',
                    target: GameSimWorldState.Running,
                    actions: 'markActivityObservationDialogueClosed',
                  },
                  ACTIVITY_OBSERVATION_SETTLED: {
                    guard: 'isCurrentActivityObservationEvent',
                    actions: 'markActivityObservationSettled',
                  },
                  CANCEL_ACTIVITY_OBSERVATION: {
                    guard: 'isCurrentActivityObservationEvent',
                    target: GameSimWorldState.Running,
                    actions: 'clearActivityObservation',
                  },
                },
              },
            },
          },
          user: {
            initial: 'observing',
            states: {
              observing: {
                on: {
                  PICK_CHARACTER: {
                    target: 'draggingCharacter',
                  },
                },
              },
              draggingCharacter: {
                on: {
                  RELEASE_CHARACTER: {
                    target: 'observing',
                  },
                },
              },
            },
          },
          dialogue: {
            invoke: {
              id: 'dialogueManager',
              src: 'dialogueManager',
            },
            on: {
              START_DIALOGUE: {
                actions: forwardTo('dialogueManager'),
              },
              RESOLVE: {
                actions: forwardTo('dialogueManager'),
              },
              CANCEL_DIALOGUE: {
                actions: forwardTo('dialogueManager'),
              },
            },
          },
        },
      },

      [GameState.Error]: {
        entry: () => {
        },
      },
    },
  },
  {
    guards: {
      isCurrentActivityObservationEvent: ({ context, event }) => (
        (
          event.type === 'ACTIVITY_OBSERVATION_DIALOGUE_CLOSED'
          || event.type === 'ACTIVITY_OBSERVATION_SETTLED'
          || event.type === 'CANCEL_ACTIVITY_OBSERVATION'
        )
        && context.activityObservation?.activityId === event.activityId
      ),
    },
    actions: {
      toNextStage: assign(({ context }) => {
        return context;
      }),
      startActivityObservation: assign({
        activityObservation: ({ context, event }) => (
          event.type === 'START_ACTIVITY_OBSERVATION'
            ? {
              activityId: event.activityId,
              isDialogueClosed: false,
              isActivitySettled: false,
            }
            : context.activityObservation
        ),
      }),
      markActivityObservationDialogueClosed: assign({
        activityObservation: ({ context }) => {
          const activityObservation = context.activityObservation;

          if (!activityObservation || activityObservation.isActivitySettled) {
            return null;
          }

          return {
            ...activityObservation,
            isDialogueClosed: true,
          };
        },
      }),
      markActivityObservationSettled: assign({
        activityObservation: ({ context }) => (
          context.activityObservation
            ? {
              ...context.activityObservation,
              isActivitySettled: true,
            }
            : null
        ),
      }),
      clearActivityObservation: assign({
        activityObservation: () => null,
      }),
    },
    actors: {
      loginSocket: fromCallback(() => { }),
      spyingNetwork: fromCallback(() => { }),
      heartbeat: fromCallback(() => { }),
      gameFlowSocket: fromCallback(() => { }),
      dialogueManager: dialogueManagerMachine,
    },
  }
);
