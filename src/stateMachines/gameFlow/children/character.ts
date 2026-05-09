import { assign, createMachine, enqueueActions, StateValue } from 'xstate';
import { Mood, Position } from '~/constants/character';
import {
    CharacterBodyActionState,
    CharacterBodyMoveState,
    CharacterCommunicationState,
    CharacterMindState,
    CharacterStateSummary,
} from '../states';
import { CharacterEvent, EventType } from '../events';
import { CharacterContext, CharacterMachineInput, CharacterUtilityScores } from '../context';

const MAP_WIDTH = 10;
const MAP_HEIGHT = 10;
const SATURATION_LOSS_PER_TICK = 1;
const SATURATION_GAIN_AFTER_EATING = 36;
const LOW_SATURATION_THRESHOLD = 5;

const INITIAL_UTILITY_SCORES: CharacterUtilityScores = {
    idle: 10,
    findFood: 0,
    rest: 20,
    play: 35,
};

export const characterMachine = createMachine(
    {
        id: 'character',
        types: {} as {
            context: CharacterContext;
            events: CharacterEvent;
            input: CharacterMachineInput;
        },
        context: ({ input }) => ({
            id: input.id,
            name: input.name,
            ownItems: [],
            status: {
                mood: Mood.Happy,
                saturation: input.saturation ?? 70,
                moodValue: 65,
                hungerThreshold: LOW_SATURATION_THRESHOLD,
            },
            utilityScores: INITIAL_UTILITY_SCORES,
            currentMotivation: 'idle',
            position: input.position,
            target: null,
        }),
        type: 'parallel',
        on: {
            [EventType.Tick]: {
                actions: ['tickStatus', 'calculateUtilityScores', 'raiseBestUtilityEvent'],
            },
            [EventType.GoEat]: {
                guard: 'shouldChangeToFindFood',
                target: [
                    '.bodyAction.observing',
                    '.bodyMove.walking',
                    '.mind.thinking',
                    '.communication.requesting',
                ],
                actions: ['setFoodMotivation', 'chooseRandomTarget'],
            },
            [EventType.GoRest]: {
                guard: 'shouldChangeToRest',
                target: [
                    '.bodyAction.idle',
                    '.bodyMove.lie',
                    '.mind.null',
                    '.communication.null',
                ],
                actions: ['setRestMotivation', 'clearTarget'],
            },
            [EventType.GoPlay]: {
                guard: 'shouldChangeToPlay',
                target: [
                    '.bodyAction.socializing',
                    '.bodyMove.walking',
                    '.mind.thinking',
                    '.communication.null',
                ],
                actions: ['setPlayMotivation', 'chooseRandomTarget'],
            },
            [EventType.GoIdle]: {
                guard: 'shouldChangeToIdle',
                target: [
                    '.bodyAction.idle',
                    '.bodyMove.stand',
                    '.mind.null',
                    '.communication.null',
                ],
                actions: ['setIdleMotivation', 'clearTarget'],
            },
            [EventType.PickUp]: {
                target: [
                    '.bodyAction.pickedUp',
                    '.bodyMove.stand',
                    '.mind.thinking',
                    '.communication.null',
                ],
                actions: ['setPickedUpMotivation', 'clearTarget'],
            },
            [EventType.Drop]: {
                target: [
                    '.bodyAction.idle',
                    '.bodyMove.stand',
                    '.mind.null',
                    '.communication.null',
                ],
                actions: ['dropAtPosition', 'setIdleMotivation', 'clearTarget'],
            },
            [EventType.MoveTo]: {
                target: [
                    '.bodyAction.observing',
                    '.bodyMove.walking',
                    '.mind.thinking',
                ],
                actions: 'setManualTarget',
            },
            [EventType.Arrive]: {
                target: [
                    '.bodyAction.idle',
                    '.bodyMove.stand',
                    '.mind.null',
                    '.communication.null',
                ],
                actions: ['arriveAtTarget', 'completeCurrentMotivation'],
            },
            [EventType.MoveBlocked]: {
                target: [
                    '.bodyAction.idle',
                    '.bodyMove.stand',
                ],
                actions: ['setIdleMotivation', 'clearTarget'],
            },
            [EventType.StartThinking]: {
                target: '.mind.thinking',
            },
            [EventType.StopThinking]: {
                target: '.mind.null',
            },
        },
        states: {
            bodyAction: {
                initial: CharacterBodyActionState.Idle,
                states: {
                    [CharacterBodyActionState.Idle]: {},
                    [CharacterBodyActionState.Observing]: {},
                    [CharacterBodyActionState.Operating]: {},
                    [CharacterBodyActionState.PickedUp]: {},
                    [CharacterBodyActionState.Socializing]: {},
                },
            },
            bodyMove: {
                initial: CharacterBodyMoveState.Stand,
                states: {
                    [CharacterBodyMoveState.Stand]: {},
                    [CharacterBodyMoveState.Lie]: {},
                    [CharacterBodyMoveState.Sit]: {},
                    [CharacterBodyMoveState.Walking]: {},
                    [CharacterBodyMoveState.Running]: {},
                    [CharacterBodyMoveState.fallDown]: {},
                },
            },
            mind: {
                initial: CharacterMindState.Null,
                states: {
                    [CharacterMindState.Null]: {},
                    [CharacterMindState.Thinking]: {},
                },
            },
            communication: {
                initial: CharacterCommunicationState.Null,
                states: {
                    [CharacterCommunicationState.Null]: {},
                    [CharacterCommunicationState.Requesting]: {},
                },
            },
        },
    },
    {
        guards: {
            shouldChangeToFindFood: ({ context }) => (
                context.currentMotivation !== 'controllingByGod' && context.currentMotivation !== 'findFood'
            ),
            shouldChangeToRest: ({ context }) => (
                context.currentMotivation !== 'controllingByGod' && context.currentMotivation !== 'rest'
            ),
            shouldChangeToPlay: ({ context }) => (
                context.currentMotivation !== 'controllingByGod' && context.currentMotivation !== 'play'
            ),
            shouldChangeToIdle: ({ context }) => (
                context.currentMotivation !== 'controllingByGod' && context.currentMotivation !== 'idle'
            ),
        },
        actions: {
            tickStatus: assign({
                status: ({ context }) => ({
                    ...context.status,
                    saturation: Math.max(0, context.status.saturation - SATURATION_LOSS_PER_TICK),
                    moodValue: Math.max(0, context.status.moodValue - 1),
                }),
            }),
            calculateUtilityScores: assign({
                utilityScores: ({ context }) => calculateUtilityScores(context),
            }),
            raiseBestUtilityEvent: enqueueActions(({ context, enqueue }) => {
                enqueue.raise(getUtilityEvent(getTopMotivation(calculateUtilityScores(context))));
            }),
            setFoodMotivation: assign({
                currentMotivation: () => 'findFood',
            }),
            setRestMotivation: assign({
                currentMotivation: () => 'rest',
            }),
            setPlayMotivation: assign({
                currentMotivation: () => 'play',
            }),
            setIdleMotivation: assign({
                currentMotivation: () => 'idle',
            }),
            setPickedUpMotivation: assign({
                currentMotivation: () => 'controllingByGod',
            }),
            chooseRandomTarget: assign({
                target: ({ context }) => getRandomTarget(context.position),
            }),
            clearTarget: assign({
                target: () => null,
            }),
            setManualTarget: assign({
                target: ({ event }) => (event.type === EventType.MoveTo ? event.target : null),
            }),
            dropAtPosition: assign({
                position: ({ context, event }) => (
                    event.type === EventType.Drop && event.position ? event.position : context.position
                ),
            }),
            arriveAtTarget: assign({
                position: ({ event }) => (event.type === EventType.Arrive ? event.position : { x: 0, y: 0 }),
                target: () => null,
            }),
            completeCurrentMotivation: assign({
                status: ({ context }) => {
                    if (context.currentMotivation === 'findFood') {
                        return {
                            ...context.status,
                            saturation: Math.min(100, context.status.saturation + SATURATION_GAIN_AFTER_EATING),
                        }
                    }

                    if (context.currentMotivation === 'play') {
                        return {
                            ...context.status,
                            moodValue: Math.min(100, context.status.moodValue + 18),
                        };
                    }

                    return context.status;
                },
                currentMotivation: () => 'idle',
            }),
        },
    }
);

export function getCharacterStateSummary(value: StateValue): CharacterStateSummary {
    const parallelValue = value as Partial<Record<keyof CharacterStateSummary, string>>;

    return {
        bodyAction: (parallelValue.bodyAction ?? CharacterBodyActionState.Idle) as CharacterBodyActionState,
        bodyMove: (parallelValue.bodyMove ?? CharacterBodyMoveState.Stand) as CharacterBodyMoveState,
        mind: (parallelValue.mind ?? CharacterMindState.Null) as CharacterMindState,
        communication: (
            parallelValue.communication ?? CharacterCommunicationState.Null
        ) as CharacterCommunicationState,
    };
}

export function formatCharacterStateValue(value: StateValue): string {
    const summary = getCharacterStateSummary(value);

    return [
        summary.bodyMove,
        summary.bodyAction,
        summary.mind,
        summary.communication,
    ].join(' | ');
}

function calculateUtilityScores(context: CharacterContext): CharacterUtilityScores {
    const saturationNeed = 100 - context.status.saturation;
    const hungerScore = context.status.saturation <= context.status.hungerThreshold
        ? Math.min(100, saturationNeed + 25)
        : saturationNeed;
    const moodNeed = 100 - context.status.moodValue;
    const restScore = Math.min(100, 18 + moodNeed * 0.35);
    const playScore = Math.min(100, 28 + moodNeed * 0.8);
    const idleScore = context.status.saturation > 70 && context.status.moodValue > 70 ? 45 : 8;

    return {
        idle: Math.round(idleScore),
        findFood: Math.round(hungerScore),
        rest: Math.round(restScore),
        play: Math.round(playScore),
    };
}

function getTopMotivation(scores: CharacterUtilityScores): UtilityDrivenMotivation {
    return (Object.entries(scores) as [UtilityDrivenMotivation, number][])
        .sort((left, right) => right[1] - left[1])[0][0];
}

function getUtilityEvent(motivation: UtilityDrivenMotivation): CharacterEvent {
    const eventByMotivation: Record<UtilityDrivenMotivation, CharacterEvent> = {
        idle: { type: EventType.GoIdle },
        findFood: { type: EventType.GoEat },
        rest: { type: EventType.GoRest },
        play: { type: EventType.GoPlay },
    };

    return eventByMotivation[motivation];
}

function getRandomTarget(position: Position): Position {
    const target = {
        x: Math.floor(Math.random() * MAP_WIDTH),
        y: Math.floor(Math.random() * MAP_HEIGHT),
    };

    if (target.x === position.x && target.y === position.y) {
        return {
            x: (target.x + 1) % MAP_WIDTH,
            y: target.y,
        };
    }
    console.log("getRandomTarget", target)
    return target;
}
