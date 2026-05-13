import { assign, createMachine, enqueueActions, StateValue } from 'xstate';
import { Mood, Position } from '~/constants/character';
import { TOWN_MAP_WIDTH, TOWN_MAP_HEIGHT, DESTINATION_MAP } from '~/constants/townMap';
import {
    CharacterBodyActionState,
    CharacterBodyMoveState,
    CharacterCommunicationState,
    CharacterMindState,
    CharacterStateSummary,
} from '../states';
import { CharacterEvent, EventType } from '../events';
import { CharacterContext, CharacterMachineInput, CharacterUtilityScores, UtilityDrivenMotivation } from '../context';
import { rememberPassBy } from '../relationships';
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
            relationships: input.relationships ?? [],
            locks: {
                bodyAction: [],
                bodyMove: [],
                mind: [],
                communication: [],
            },
        }),
        type: 'parallel',
        on: {
            [EventType.Tick]: {
                guard: 'canReceiveLogicCommand',
                actions: ['tickStatus', 'calculateUtilityScores', 'raiseBestUtilityEvent'],
            },
            [EventType.PassBy]: {
                guard: 'canReceiveLogicCommand',
                actions: 'rememberPassBy',
            },
            [EventType.GoEat]: {
                guard: 'shouldChangeToFindFood',
                target: [
                    '.bodyAction.observing',
                    '.bodyMove.walking',
                    '.mind.thinking',
                    '.communication.requesting',
                ],
                actions: ['setFoodMotivation', 'setManualTarget'],
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
                guard: 'canReceiveLogicCommand',
                target: [
                    '.bodyAction.pickedUp',
                    '.bodyMove.stand',
                    '.mind.thinking',
                    '.communication.null',
                ],
                actions: ['setPickedUpMotivation', 'clearTarget'],
            },
            [EventType.Drop]: {
                guard: 'canReceiveLogicCommand',
                target: [
                    '.bodyAction.idle',
                    '.bodyMove.stand',
                    '.mind.null',
                    '.communication.null',
                ],
                actions: ['dropAtPosition', 'setIdleMotivation', 'clearTarget'],
            },
            [EventType.MoveTo]: {
                guard: 'canReceiveLogicCommand',
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
                actions: ['syncPositionOnBlock', 'setIdleMotivation', 'clearTarget'],
            },
            [EventType.StartThinking]: {
                guard: 'canReceiveLogicCommand',
                target: '.mind.thinking',
            },
            [EventType.StopThinking]: {
                guard: 'canReceiveLogicCommand',
                target: '.mind.null',
            },
            [EventType.AddLock]: {
                actions: 'addLock',
            },
            [EventType.RemoveLock]: {
                actions: 'removeLock',
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
            canReceiveLogicCommand: ({ context }) => !isLocked(context, 'bodyAction') && !isLocked(context, 'bodyMove'),
            shouldChangeToFindFood: ({ context }) => (
                !isLocked(context, 'bodyAction') && !isLocked(context, 'bodyMove') &&
                context.currentMotivation !== 'controllingByGod' &&
                (context.currentMotivation !== 'findFood' || context.target === null)
            ),
            shouldChangeToRest: ({ context }) => (
                !isLocked(context, 'bodyAction') && !isLocked(context, 'bodyMove') &&
                context.currentMotivation !== 'controllingByGod' && context.currentMotivation !== 'rest'
            ),
            shouldChangeToPlay: ({ context }) => (
                !isLocked(context, 'bodyAction') && !isLocked(context, 'bodyMove') &&
                context.currentMotivation !== 'controllingByGod' &&
                (context.currentMotivation !== 'play' || context.target === null)
            ),
            shouldChangeToIdle: ({ context }) => (
                !isLocked(context, 'bodyAction') && !isLocked(context, 'bodyMove') &&
                context.currentMotivation !== 'controllingByGod' && context.currentMotivation !== 'idle'
            ),
        },
        actions: {
            addLock: assign({
                locks: ({ context, event }) => {
                    if (event.type !== EventType.AddLock) return context.locks;
                    const newLocks = { ...context.locks };
                    event.parts.forEach(part => {
                        if (!newLocks[part].includes(event.reason)) {
                            newLocks[part] = [...newLocks[part], event.reason];
                        }
                    });
                    return newLocks;
                },
            }),
            removeLock: assign({
                locks: ({ context, event }) => {
                    if (event.type !== EventType.RemoveLock) return context.locks;
                    const newLocks = { ...context.locks };
                    event.parts.forEach(part => {
                        newLocks[part] = newLocks[part].filter(r => r !== event.reason);
                    });
                    return newLocks;
                },
            }),
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
                target: ({ context }) => {
                    if (context.name === "Momo") {
                        console.log(context.name, context.currentMotivation)
                        console.log(context.name, getRandomTarget(context.position))
                    }
                    return getRandomTarget(context.position)
                }
            }),
            clearTarget: assign({
                target: () => null,
            }),
            setManualTarget: assign({
                target: ({ event }) => ((event.type === EventType.MoveTo || event.type === EventType.GoEat) ? event.target : null),
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
            syncPositionOnBlock: assign({
                position: ({ context, event }) => (
                    event.type === EventType.MoveBlocked && event.position
                        ? event.position
                        : context.position
                ),
            }),
            rememberPassBy: assign({
                relationships: ({ context, event }) => (
                    event.type === EventType.PassBy
                        ? rememberPassBy(
                            context.relationships,
                            context.id,
                            event.targetCharId,
                            event.timestamp ?? Date.now(),
                        )
                        : context.relationships
                ),
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

function getRandomDestinationTarget(motivation: string): Position | null {
    const destinations = DESTINATION_MAP[motivation];

    if (!destinations || destinations.length === 0) {
        return null;
    }

    const destination = destinations[Math.floor(Math.random() * destinations.length)];
    const tiles = destination.serviceTiles;
    return tiles[Math.floor(Math.random() * tiles.length)];
}

function getUtilityEvent(motivation: UtilityDrivenMotivation): CharacterEvent {
    const foodTarget = getRandomDestinationTarget('findFood');
    const eventByMotivation: Record<UtilityDrivenMotivation, CharacterEvent> = {
        idle: { type: EventType.GoIdle },
        findFood: { type: EventType.GoEat, target: foodTarget ?? { x: 1, y: 20 } },
        rest: { type: EventType.GoRest },
        play: { type: EventType.GoPlay },
    };

    return eventByMotivation[motivation];
}

function getRandomTarget(position: Position): Position {
    const target = {
        x: Math.floor(Math.random() * TOWN_MAP_WIDTH),
        y: Math.floor(Math.random() * TOWN_MAP_HEIGHT),
    };

    if (target.x === position.x && target.y === position.y) {
        return {
            x: (target.x + 1) % TOWN_MAP_WIDTH,
            y: target.y,
        };
    }
    return target;
}

function isLocked(context: CharacterContext, part: keyof CharacterContext['locks']) {
    return context.locks[part].length > 0;
}
