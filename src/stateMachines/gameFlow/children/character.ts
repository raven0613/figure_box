import { assign, createMachine, enqueueActions, StateValue } from 'xstate';
import {
    clampMoodValue,
    Expression,
    getMoodForMoodValue,
    getMoodMinValue,
} from '~/constants/character';
import {
    CharacterBodyActionState,
    CharacterBodyMoveState,
    CharacterCommunicationState,
    CharacterControlState,
    CharacterMindState,
    CharacterStateSummary,
} from '../states';
import { CharacterEvent, EventType } from '../events';
import { CharacterContext, CharacterMachineInput, CharacterUtilityScores } from '../context';
import {
    changeRelationshipIntimacy,
    decreaseRelationshipIntimacyToFeelingMin,
    rememberPassBy,
} from '../relationships';
import { decideCharacterEvent } from '~/services/characterEvents/decision';
import {
    calculateCharacterUtilityScores,
    LOW_SATURATION_THRESHOLD,
    PLAY_NEED_GAIN_PER_TICK,
    PLAY_NEED_REDUCTION_AFTER_PLAYING_TOGETHER,
    PLAY_NEED_REDUCTION_AFTER_SOLO_PLAY,
    SATURATION_GAIN_AFTER_EATING,
    SATURATION_LOSS_PER_TICK,
} from '~/services/characterEvents/utility';
import {
    getRandomDestinationTarget,
    getRandomMapTarget,
} from '~/services/characterEvents/targets';
import {
    createEmptyActivityCooldowns,
    recordActivityCooldowns,
} from '~/services/characterEvents/activityCooldowns';
import {
    CHARACTER_EVENT_DEFINITIONS_BY_ID,
    type CharacterEventActivity,
} from '~/constants/charactarEventsDefinitions';
import type { CharacterRequestSatisfiedEffect } from '~/services/characterRequests/types';

const INITIAL_UTILITY_SCORES: CharacterUtilityScores = {
    idle: 10,
    findFood: 0,
    rest: 20,
    play: 35,
    chat: 15,
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
            ownItems: [...(input.ownItems ?? [])],
            status: {
                mood: getMoodForMoodValue(65),
                expression: Expression.Normal,
                saturation: input.saturation ?? 70,
                moodValue: 65,
                playNeed: 35,
                hungerThreshold: LOW_SATURATION_THRESHOLD,
            },
            utilityScores: INITIAL_UTILITY_SCORES,
            lastEventDecision: null,
            currentMotivation: 'idle',
            controlState: CharacterControlState.Normal,
            pendingActivityJoin: null,
            currentActivity: null,
            activityCooldowns: createEmptyActivityCooldowns(),
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
                actions: ['tickStatus', 'clearIdleTarget', 'updateUtilityScores', 'decideAndRaiseEvent'],
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
                actions: ['setPlayMotivation', 'choosePlayTarget'],
            },
            [EventType.StartActivity]: {
                guard: 'shouldStartActivity',
                target: [
                    '.bodyAction.socializing',
                    '.bodyMove.stand',
                    '.mind.thinking',
                    '.communication.null',
                ],
                actions: ['setActivityMotivation', 'startOwnActivity'],
            },
            [EventType.JoinActivity]: {
                guard: 'shouldJoinActivity',
                target: [
                    '.bodyAction.socializing',
                    '.bodyMove.stand',
                    '.mind.thinking',
                    '.communication.null',
                ],
                actions: ['setActivityMotivation', 'setPendingActivityJoin'],
            },
            [EventType.JoinActivityAccepted]: {
                guard: 'shouldAcceptActivityJoin',
                target: [
                    '.bodyAction.socializing',
                    '.bodyMove.stand',
                    '.mind.thinking',
                    '.communication.null',
                ],
                actions: ['setActivityMotivation', 'acceptActivityJoin'],
            },
            [EventType.JoinActivityRejected]: {
                guard: 'shouldRejectActivityJoin',
                target: [
                    '.bodyAction.idle',
                    '.bodyMove.stand',
                    '.mind.null',
                    '.communication.null',
                ],
                actions: ['rejectActivityJoin', 'setIdleMotivation', 'clearTarget'],
            },
            [EventType.EndJoinedActivity]: {
                guard: 'shouldEndJoinedActivity',
                target: [
                    '.bodyAction.idle',
                    '.bodyMove.stand',
                    '.mind.null',
                    '.communication.null',
                ],
                actions: ['completeJoinedActivity', 'clearTarget'],
            },
            [EventType.RecordActivityCooldown]: {
                actions: 'recordActivityCooldown',
            },
            [EventType.ApplyRequestEffects]: {
                actions: 'applyRequestEffects',
            },
            [EventType.SetControlState]: [
                {
                    guard: 'shouldSetRequestFulfillmentControl',
                    target: '.control.requestFulfillment',
                    actions: 'setControlState',
                },
                {
                    guard: 'shouldSetDialogueControl',
                    target: '.control.dialogue',
                    actions: 'setControlState',
                },
                {
                    guard: 'shouldSetRelationshipMomentControl',
                    target: '.control.relationshipMoment',
                    actions: 'setControlState',
                },
                {
                    guard: 'shouldSetNormalControl',
                    target: '.control.normal',
                    actions: 'setControlState',
                },
            ],
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
                actions: ['setPickedUpMotivation', 'clearTarget', 'clearActivity'],
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
                actions: ['syncPositionOnBlock', 'setIdleMotivation', 'clearTarget', 'clearActivity'],
            },
            [EventType.StartThinking]: {
                guard: 'canReceiveLogicCommand',
                target: '.mind.thinking',
            },
            [EventType.StopThinking]: {
                guard: 'canReceiveLogicCommand',
                target: '.mind.null',
            },
            [EventType.SetExpression]: {
                actions: 'setExpression',
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
            control: {
                initial: CharacterControlState.Normal,
                states: {
                    [CharacterControlState.Normal]: {},
                    [CharacterControlState.RequestFulfillment]: {},
                    [CharacterControlState.RelationshipMoment]: {},
                    [CharacterControlState.Dialogue]: {},
                },
            },
        },
    },
    {
        guards: {
            canReceiveLogicCommand: ({ context }) => canReceiveNormalLogicCommand(context),
            shouldChangeToFindFood: ({ context }) => (
                canReceiveNormalLogicCommand(context) &&
                context.currentMotivation !== 'controllingByGod' &&
                (context.currentMotivation !== 'findFood' || context.target === null)
            ),
            shouldChangeToRest: ({ context }) => (
                canReceiveNormalLogicCommand(context) &&
                context.currentMotivation !== 'controllingByGod' && context.currentMotivation !== 'rest'
            ),
            shouldChangeToPlay: ({ context }) => (
                canReceiveNormalLogicCommand(context) &&
                context.currentMotivation !== 'controllingByGod' &&
                (context.currentMotivation !== 'play' || context.target === null)
            ),
            shouldStartActivity: ({ context }) => (
                canReceiveNormalLogicCommand(context) &&
                context.currentMotivation !== 'controllingByGod' &&
                context.target === null &&
                context.currentActivity === null &&
                context.pendingActivityJoin === null
            ),
            shouldJoinActivity: ({ context }) => (
                canReceiveNormalLogicCommand(context) &&
                context.currentMotivation !== 'controllingByGod' &&
                context.target === null &&
                context.currentActivity === null &&
                context.pendingActivityJoin === null
            ),
            shouldAcceptActivityJoin: ({ context, event }) => (
                canReceiveNormalLogicCommand(context) &&
                event.type === EventType.JoinActivityAccepted &&
                context.pendingActivityJoin?.activityId === event.activityId
            ),
            shouldRejectActivityJoin: ({ context, event }) => (
                canReceiveNormalLogicCommand(context) &&
                event.type === EventType.JoinActivityRejected &&
                context.pendingActivityJoin?.activityId === event.activityId
            ),
            shouldEndJoinedActivity: ({ context, event }) => (
                event.type === EventType.EndJoinedActivity &&
                (
                    context.currentActivity?.activityId === event.activityId ||
                    context.pendingActivityJoin?.activityId === event.activityId
                )
            ),
            shouldChangeToIdle: ({ context }) => (
                canReceiveNormalLogicCommand(context) &&
                context.currentMotivation !== 'controllingByGod' && context.currentMotivation !== 'idle'
            ),
            shouldSetRequestFulfillmentControl: ({ event }) => (
                event.type === EventType.SetControlState &&
                event.controlState === CharacterControlState.RequestFulfillment
            ),
            shouldSetDialogueControl: ({ event }) => (
                event.type === EventType.SetControlState &&
                event.controlState === CharacterControlState.Dialogue
            ),
            shouldSetRelationshipMomentControl: ({ event }) => (
                event.type === EventType.SetControlState &&
                event.controlState === CharacterControlState.RelationshipMoment
            ),
            shouldSetNormalControl: ({ event }) => (
                event.type === EventType.SetControlState &&
                event.controlState === CharacterControlState.Normal
            ),
        },
        actions: {
            setControlState: assign({
                controlState: ({ context, event }) => (
                    event.type === EventType.SetControlState ? event.controlState : context.controlState
                ),
            }),
            setExpression: assign({
                status: ({ context, event }) => {
                    if (event.type !== EventType.SetExpression) return context.status;
                    return {
                        ...context.status,
                        expression: event.expression,
                    };
                },
            }),
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
                status: ({ context }) => updateCharacterMoodValue(
                    {
                        ...context.status,
                        saturation: Math.max(0, context.status.saturation - SATURATION_LOSS_PER_TICK),
                        playNeed: Math.min(100, context.status.playNeed + PLAY_NEED_GAIN_PER_TICK),
                    },
                    context.status.moodValue - 1,
                ),
            }),
            updateUtilityScores: assign({
                utilityScores: ({ context }) => calculateCharacterUtilityScores(context),
            }),
            decideAndRaiseEvent: enqueueActions(({ context, event, enqueue }) => {
                if (event.type !== EventType.Tick) {
                    return;
                }

                if (event.allowAutonomousDecision === false) {
                    return;
                }

                if (!canMakeAutonomousDecision(context)) {
                    return;
                }

                const decision = decideCharacterEvent(context, {
                    nearbyCharacterIds: event.nearbyCharacterIds,
                    nearbyRelationships: event.nearbyRelationships,
                    nearbyJoinableActivities: event.nearbyJoinableActivities,
                    globalEventTags: event.globalEventTags,
                    timestamp: event.timestamp,
                });

                enqueue.assign({
                    utilityScores: decision.utilityScores,
                    lastEventDecision: decision.decision,
                });
                enqueue.raise(decision.event);
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
            setActivityMotivation: assign({
                currentMotivation: ({ event }) => (
                    event.type === EventType.StartActivity ||
                        event.type === EventType.JoinActivity ||
                        event.type === EventType.JoinActivityAccepted
                        ? CHARACTER_EVENT_DEFINITIONS_BY_ID[event.sourceEventId]?.motivation ?? 'play'
                        : 'play'
                ),
            }),
            setIdleMotivation: assign({
                currentMotivation: () => 'idle',
            }),
            setPickedUpMotivation: assign({
                currentMotivation: () => 'controllingByGod',
            }),
            chooseRandomTarget: assign({
                target: ({ context }) => getRandomMapTarget(context.position),
            }),
            choosePlayTarget: assign({
                target: ({ context }) => (
                    getRandomDestinationTarget('play') ?? getRandomMapTarget(context.position)
                ),
            }),
            startOwnActivity: assign({
                currentActivity: ({ event }) => (
                    event.type === EventType.StartActivity
                        ? {
                            id: `activity-${event.activityId}`,
                            activityId: event.activityId,
                            sourceEventId: event.sourceEventId,
                        }
                        : null
                ),
            }),
            setPendingActivityJoin: assign({
                pendingActivityJoin: ({ event }) => (
                    event.type === EventType.JoinActivity
                        ? {
                            id: `join-${event.activityId}`,
                            activityId: event.activityId,
                            sourceEventId: event.sourceEventId,
                        }
                        : null
                ),
            }),
            acceptActivityJoin: assign({
                pendingActivityJoin: ({ context, event }) => (
                    event.type === EventType.JoinActivityAccepted &&
                        context.pendingActivityJoin?.activityId === event.activityId
                        ? null
                        : context.pendingActivityJoin
                ),
                currentActivity: ({ event }) => (
                    event.type === EventType.JoinActivityAccepted
                        ? {
                            id: `activity-${event.activityId}`,
                            activityId: event.activityId,
                            sourceEventId: event.sourceEventId,
                        }
                        : null
                ),
            }),
            rejectActivityJoin: assign({
                pendingActivityJoin: ({ context, event }) => (
                    event.type === EventType.JoinActivityRejected &&
                        context.pendingActivityJoin?.activityId === event.activityId
                        ? null
                        : context.pendingActivityJoin
                ),
            }),
            completeJoinedActivity: assign({
                status: ({ context, event }) => (
                    event.type === EventType.EndJoinedActivity &&
                        context.currentActivity?.activityId === event.activityId
                        ? getCompletedActivityStatus(context, event.activityEffects)
                        : context.status
                ),
                pendingActivityJoin: ({ context, event }) => (
                    event.type === EventType.EndJoinedActivity &&
                        context.pendingActivityJoin?.activityId === event.activityId
                        ? null
                        : context.pendingActivityJoin
                ),
                currentActivity: ({ context, event }) => (
                    event.type === EventType.EndJoinedActivity &&
                        context.currentActivity?.activityId === event.activityId
                        ? null
                        : context.currentActivity
                ),
                relationships: ({ context, event }) => (
                    event.type === EventType.EndJoinedActivity &&
                        context.currentActivity?.activityId === event.activityId
                        ? applyCompletedActivityRelationshipEffects(
                            context.relationships,
                            context.id,
                            event.participantIds ?? [],
                            event.activityEffects,
                            event.timestamp ?? Date.now(),
                        )
                        : context.relationships
                ),
                currentMotivation: () => 'idle',
            }),
            clearActivity: assign({
                pendingActivityJoin: () => null,
                currentActivity: () => null,
            }),
            recordActivityCooldown: assign({
                activityCooldowns: ({ context, event }) => (
                    event.type === EventType.RecordActivityCooldown
                        ? recordActivityCooldowns(context.activityCooldowns, {
                            partnerCharIds: event.partnerCharIds,
                            role: event.role,
                            sourceEventId: event.sourceEventId,
                            timestamp: event.timestamp ?? Date.now(),
                        })
                        : context.activityCooldowns
                ),
            }),
            applyRequestEffects: assign({
                status: ({ context, event }) => (
                    event.type === EventType.ApplyRequestEffects
                        ? applyRequestEffectsToStatus(context.status, event.requestEffects)
                        : context.status
                ),
            }),
            clearTarget: assign({
                target: () => null,
            }),
            clearIdleTarget: assign({
                target: ({ context }) => (
                    context.currentMotivation === 'idle' &&
                        context.currentActivity === null &&
                        context.pendingActivityJoin === null
                        ? null
                        : context.target
                ),
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
                    if (context.currentActivity) {
                        return context.status;
                    }

                    if (context.currentMotivation === 'findFood') {
                        return {
                            ...context.status,
                            saturation: Math.min(100, context.status.saturation + SATURATION_GAIN_AFTER_EATING),
                        }
                    }

                    if (context.currentMotivation === 'play') {
                        return updateCharacterMoodValue(
                            {
                                ...context.status,
                                playNeed: Math.max(0, context.status.playNeed - PLAY_NEED_REDUCTION_AFTER_SOLO_PLAY),
                            },
                            context.status.moodValue + 18,
                        );
                    }

                    return context.status;
                },
                currentMotivation: ({ context }) => (context.currentActivity ? context.currentMotivation : 'idle'),
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
        control: (
            parallelValue.control ?? CharacterControlState.Normal
        ) as CharacterControlState,
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

function isLocked(context: CharacterContext, part: keyof CharacterContext['locks']) {
    return context.locks[part].length > 0;
}

function canReceiveNormalLogicCommand(context: CharacterContext): boolean {
    return context.controlState === CharacterControlState.Normal;
}

function getCompletedActivityStatus(
    context: CharacterContext,
    activityEffects: CharacterEventActivity['effects'],
): CharacterContext['status'] {
    const sourceEventId = context.currentActivity?.sourceEventId;
    const motivation = sourceEventId
        ? CHARACTER_EVENT_DEFINITIONS_BY_ID[sourceEventId]?.motivation
        : undefined;

    if (motivation === 'play') {
        return applyCompletedActivityMoodEffects(
            {
                ...context.status,
                playNeed: Math.max(
                    0,
                    context.status.playNeed - PLAY_NEED_REDUCTION_AFTER_PLAYING_TOGETHER,
                ),
            },
            context.status.moodValue + 10,
            activityEffects,
        );
    }

    return applyCompletedActivityMoodEffects(
        context.status,
        context.status.moodValue + 6,
        activityEffects,
    );
}

function applyCompletedActivityMoodEffects(
    status: CharacterContext['status'],
    baseMoodValue: number,
    activityEffects: CharacterEventActivity['effects'],
): CharacterContext['status'] {
    const deltaMoodValue = baseMoodValue + (activityEffects?.moodValueDelta ?? 0);
    const moodValue = activityEffects?.moodStageTarget
        ? getMoodMinValue(activityEffects.moodStageTarget)
        : deltaMoodValue;

    return updateCharacterMoodValue(status, moodValue);
}

function updateCharacterMoodValue(
    status: CharacterContext['status'],
    moodValue: number,
): CharacterContext['status'] {
    const clampedMoodValue = clampMoodValue(moodValue);

    return {
        ...status,
        moodValue: clampedMoodValue,
        mood: getMoodForMoodValue(clampedMoodValue),
    };
}

function applyCompletedActivityRelationshipEffects(
    relationships: CharacterContext['relationships'],
    characterId: string,
    participantIds: readonly string[],
    activityEffects: CharacterEventActivity['effects'],
    timestamp: number,
): CharacterContext['relationships'] {
    return participantIds
        .filter(participantId => participantId !== characterId)
        .reduce(
            (nextRelationships, participantId) => {
                const changedRelationships = changeRelationshipIntimacy(
                    nextRelationships,
                    characterId,
                    participantId,
                    activityEffects?.relationshipIntimacyDelta ?? 0,
                    timestamp,
                );

                if (!activityEffects?.relationshipFeelingTarget) {
                    return changedRelationships;
                }

                return decreaseRelationshipIntimacyToFeelingMin(
                    changedRelationships,
                    characterId,
                    participantId,
                    activityEffects.relationshipFeelingTarget,
                    timestamp,
                );
            },
            relationships,
        );
}

function applyRequestEffectsToStatus(
    status: CharacterContext['status'],
    requestEffects: readonly CharacterRequestSatisfiedEffect[],
): CharacterContext['status'] {
    const nextStatus = requestEffects.reduce((currentStatus, effect) => {
        if (effect.type === 'characterSaturationDelta') {
            return {
                ...currentStatus,
                saturation: Math.max(0, Math.min(100, currentStatus.saturation + effect.value)),
            };
        }

        if (effect.type === 'characterMoodValueDelta') {
            return updateCharacterMoodValue(currentStatus, currentStatus.moodValue + effect.value);
        }

        return currentStatus;
    }, status);

    return updateCharacterMoodValue(nextStatus, nextStatus.moodValue);
}

function canMakeAutonomousDecision(context: CharacterContext): boolean {
    return (
        context.target === null &&
        context.pendingActivityJoin === null &&
        context.currentActivity === null &&
        context.currentMotivation !== 'controllingByGod' &&
        !isLocked(context, 'bodyAction') &&
        !isLocked(context, 'bodyMove') &&
        !isLocked(context, 'mind')
    );
}
