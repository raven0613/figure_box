import { assign, createMachine, forwardTo, fromCallback } from 'xstate';
import { GameFlowEvents } from './events';
import { GameGodState, GameState, GameSystemState } from './states';
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
    },
    states: {
      [GameState.Loading]: {
        initial: 'success',
        entry: assign({
        }),
        states: {
          success: {
            type: 'final' as const,
          },
        },
        onDone: {
          target: GameState.Active,
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
            initial: 'join',
            states: {
              join: {
                invoke: [
                  {
                    src: 'heartbeat',
                  },
                  {
                    src: 'gameFlowSocket',
                  },
                ],
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
    actions: {
      toNextStage: assign(({ context }) => {
        return context;
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
