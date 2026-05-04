import { assign, createMachine, fromCallback } from 'xstate';
import i18n from '~/i18n';
import { ErrorPopUp, ErrorType } from '~/widgets/error';
import { GameFlowEvents } from './events';
import { BigBattleGameStates, FlowStates, PreparingStates } from './states';
import type { GameFlowContext } from './context';

export const ABLY_TRANSFER_TIME = 700;

export const gameFlowMachine = createMachine(
  {
    id: 'game flow',
    types: {} as {
      context: GameFlowContext;
      events: GameFlowEvents;
    },
    initial: BigBattleGameStates.PREPARING,
    context: {
      nothing: undefined,
    },
    states: {
      [BigBattleGameStates.PREPARING]: {
        initial: PreparingStates.SUCCESS,
        entry: assign({
        }),
        states: {
          [PreparingStates.SUCCESS]: {
            type: 'final' as const,
          },
        },
        onDone: {
          target: BigBattleGameStates.FLOW,
        },
      },

      [BigBattleGameStates.FLOW]: {
        initial: FlowStates.JOIN,
        invoke: [
          {
            src: 'loginSocket',
          },
          {
            src: 'spyingNetwork',
          },
        ],
        states: {
          [FlowStates.JOIN]: {
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

      [BigBattleGameStates.ERROR]: {
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
      loginSocket: fromCallback(() => {}),
      spyingNetwork: fromCallback(() => {}),
      heartbeat: fromCallback(() => {}),
      gameFlowSocket: fromCallback(() => {}),
    },
  }
);
