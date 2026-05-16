import { assign, createMachine, enqueueActions, StateValue } from 'xstate';
import { Expression, Mood } from '~/constants/character';
import {
    CharacterBodyActionState,
    CharacterBodyMoveState,
    CharacterCommunicationState,
    CharacterMindState,
    CharacterStateSummary,
} from '../states';
import { CharacterEvent, EventType } from '../events';
import { CharacterContext, CharacterMachineInput, CharacterUtilityScores } from '../context';
import { rememberPassBy } from '../relationships';
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
import { getRandomMapTarget } from '~/services/characterEvents/targets';
import {
    applyInteractionCooldowns,
    createEmptyInteractionCooldowns,
} from '~/services/characterEvents/interactionCooldowns';

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
                mood: Mood.Happy,
                expression: Expression.Normal,
                saturation: input.saturation ?? 70,
                moodValue: 65,
                playNeed: 35,
                hungerThreshold: LOW_SATURATION_THRESHOLD,
            },
            utilityScores: INITIAL_UTILITY_SCORES,
            lastEventDecision: null,
            currentMotivation: 'idle',
            pendingInteractionProposal: null,
            currentInteraction: null,
            pendingActivityJoin: null,
            currentActivity: null,
            interactionCooldowns: createEmptyInteractionCooldowns(),
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
                actions: ['tickStatus', 'updateUtilityScores', 'decideAndRaiseEvent'],
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
            [EventType.ProposeChat]: {
                guard: 'shouldProposeChat',
                target: [
                    '.bodyAction.socializing',
                    '.bodyMove.stand',
                    '.mind.thinking',
                    '.communication.requesting',
                ],
                actions: ['setChatMotivation', 'setPendingChatProposal'],
            },
            [EventType.ProposePlay]: {
                guard: 'shouldProposePlay',
                target: [
                    '.bodyAction.socializing',
                    '.bodyMove.stand',
                    '.mind.thinking',
                    '.communication.requesting',
                ],
                actions: ['setPlayMotivation', 'setPendingPlayProposal'],
            },
            [EventType.StartActivity]: {
                guard: 'shouldStartActivity',
                target: [
                    '.bodyAction.socializing',
                    '.bodyMove.stand',
                    '.mind.thinking',
                    '.communication.null',
                ],
                actions: ['setPlayMotivation', 'startOwnActivity'],
            },
            [EventType.JoinActivity]: {
                guard: 'shouldJoinActivity',
                target: [
                    '.bodyAction.socializing',
                    '.bodyMove.stand',
                    '.mind.thinking',
                    '.communication.null',
                ],
                actions: ['setPlayMotivation', 'setPendingActivityJoin'],
            },
            [EventType.JoinActivityAccepted]: {
                target: [
                    '.bodyAction.socializing',
                    '.bodyMove.stand',
                    '.mind.thinking',
                    '.communication.null',
                ],
                actions: ['setPlayMotivation', 'acceptActivityJoin'],
            },
            [EventType.JoinActivityRejected]: {
                target: [
                    '.bodyAction.idle',
                    '.bodyMove.stand',
                    '.mind.null',
                    '.communication.null',
                ],
                actions: ['rejectActivityJoin', 'setIdleMotivation'],
            },
            [EventType.EndJoinedActivity]: {
                guard: 'shouldEndJoinedActivity',
                target: [
                    '.bodyAction.idle',
                    '.bodyMove.stand',
                    '.mind.null',
                    '.communication.null',
                ],
                actions: 'completeJoinedActivity',
            },
            [EventType.ChatProposalAccepted]: {
                target: [
                    '.bodyAction.socializing',
                    '.bodyMove.stand',
                    '.mind.thinking',
                    '.communication.null',
                ],
                actions: ['confirmInitiatedChat'],
            },
            [EventType.ChatProposalRejected]: {
                target: [
                    '.bodyAction.idle',
                    '.bodyMove.stand',
                    '.mind.null',
                    '.communication.null',
                ],
                actions: ['rejectInitiatedChat', 'setIdleMotivation'],
            },
            [EventType.PlayProposalAccepted]: {
                target: [
                    '.bodyAction.socializing',
                    '.bodyMove.stand',
                    '.mind.thinking',
                    '.communication.null',
                ],
                actions: ['confirmInitiatedPlay'],
            },
            [EventType.PlayProposalRejected]: {
                target: [
                    '.bodyAction.idle',
                    '.bodyMove.stand',
                    '.mind.null',
                    '.communication.null',
                ],
                actions: ['rejectInitiatedPlay', 'setIdleMotivation'],
            },
            [EventType.AcceptChatProposal]: {
                guard: 'shouldAcceptChatProposal',
                target: [
                    '.bodyAction.socializing',
                    '.bodyMove.stand',
                    '.mind.thinking',
                    '.communication.null',
                ],
                actions: ['setChatMotivation', 'acceptIncomingChat'],
            },
            [EventType.AcceptPlayProposal]: {
                guard: 'shouldAcceptPlayProposal',
                target: [
                    '.bodyAction.socializing',
                    '.bodyMove.stand',
                    '.mind.thinking',
                    '.communication.null',
                ],
                actions: ['setPlayMotivation', 'acceptIncomingPlay'],
            },
            [EventType.EndChatInteraction]: {
                target: [
                    '.bodyAction.idle',
                    '.bodyMove.stand',
                    '.mind.null',
                    '.communication.null',
                ],
                actions: ['clearInteraction', 'setIdleMotivation'],
            },
            [EventType.EndPlayInteraction]: {
                target: [
                    '.bodyAction.idle',
                    '.bodyMove.stand',
                    '.mind.null',
                    '.communication.null',
                ],
                actions: ['completePlayInteraction'],
            },
            [EventType.RecordInteractionCooldown]: {
                actions: 'recordInteractionCooldown',
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
            shouldProposeChat: ({ context }) => (
                !isLocked(context, 'bodyAction') && !isLocked(context, 'bodyMove') &&
                context.currentMotivation !== 'controllingByGod' &&
                context.target === null &&
                context.currentInteraction === null &&
                context.currentActivity === null &&
                context.pendingInteractionProposal === null &&
                context.pendingActivityJoin === null
            ),
            shouldProposePlay: ({ context }) => (
                !isLocked(context, 'bodyAction') && !isLocked(context, 'bodyMove') &&
                context.currentMotivation !== 'controllingByGod' &&
                context.target === null &&
                context.currentInteraction === null &&
                context.currentActivity === null &&
                context.pendingInteractionProposal === null &&
                context.pendingActivityJoin === null
            ),
            shouldStartActivity: ({ context }) => (
                !isLocked(context, 'bodyAction') && !isLocked(context, 'bodyMove') &&
                context.currentMotivation !== 'controllingByGod' &&
                context.target === null &&
                context.currentInteraction === null &&
                context.currentActivity === null &&
                context.pendingInteractionProposal === null &&
                context.pendingActivityJoin === null
            ),
            shouldJoinActivity: ({ context }) => (
                !isLocked(context, 'bodyAction') && !isLocked(context, 'bodyMove') &&
                context.currentMotivation !== 'controllingByGod' &&
                context.target === null &&
                context.currentInteraction === null &&
                context.currentActivity === null &&
                context.pendingInteractionProposal === null &&
                context.pendingActivityJoin === null
            ),
            shouldAcceptChatProposal: ({ context }) => (
                !isLocked(context, 'bodyAction') && !isLocked(context, 'bodyMove') &&
                context.currentMotivation === 'idle' &&
                context.target === null &&
                context.currentInteraction === null &&
                context.currentActivity === null &&
                context.pendingInteractionProposal === null &&
                context.pendingActivityJoin === null
            ),
            shouldAcceptPlayProposal: ({ context }) => (
                !isLocked(context, 'bodyAction') && !isLocked(context, 'bodyMove') &&
                context.currentMotivation === 'idle' &&
                context.target === null &&
                context.currentInteraction === null &&
                context.currentActivity === null &&
                context.pendingInteractionProposal === null &&
                context.pendingActivityJoin === null
            ),
            shouldEndJoinedActivity: ({ context, event }) => (
                event.type === EventType.EndJoinedActivity &&
                (
                    context.currentActivity?.activityId === event.activityId ||
                    context.pendingActivityJoin?.activityId === event.activityId
                )
            ),
            shouldChangeToIdle: ({ context }) => (
                !isLocked(context, 'bodyAction') && !isLocked(context, 'bodyMove') &&
                context.currentMotivation !== 'controllingByGod' && context.currentMotivation !== 'idle'
            ),
        },
        actions: {
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
                status: ({ context }) => ({
                    ...context.status,
                    saturation: Math.max(0, context.status.saturation - SATURATION_LOSS_PER_TICK),
                    moodValue: Math.max(0, context.status.moodValue - 1),
                    playNeed: Math.min(100, context.status.playNeed + PLAY_NEED_GAIN_PER_TICK),
                }),
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
            setChatMotivation: assign({
                currentMotivation: () => 'chat',
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
            setPendingChatProposal: assign({
                pendingInteractionProposal: ({ event }) => (
                    event.type === EventType.ProposeChat
                        ? {
                            id: event.proposalId,
                            type: 'chat',
                            targetCharId: event.targetCharId,
                            sourceEventId: event.sourceEventId,
                        }
                        : null
                ),
                currentInteraction: ({ event }) => (
                    event.type === EventType.ProposeChat
                        ? {
                            id: event.proposalId,
                            type: 'chat',
                            partnerCharId: event.targetCharId,
                            role: 'initiator',
                            sourceEventId: event.sourceEventId,
                        }
                        : null
                ),
            }),
            setPendingPlayProposal: assign({
                pendingInteractionProposal: ({ event }) => (
                    event.type === EventType.ProposePlay
                        ? {
                            id: event.proposalId,
                            type: 'play',
                            targetCharId: event.targetCharId,
                            sourceEventId: event.sourceEventId,
                        }
                        : null
                ),
                currentInteraction: ({ event }) => (
                    event.type === EventType.ProposePlay
                        ? {
                            id: event.proposalId,
                            type: 'play',
                            partnerCharId: event.targetCharId,
                            role: 'initiator',
                            sourceEventId: event.sourceEventId,
                        }
                        : null
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
            confirmInitiatedChat: assign({
                pendingInteractionProposal: ({ context, event }) => (
                    event.type === EventType.ChatProposalAccepted &&
                        context.pendingInteractionProposal?.id === event.proposalId
                        ? null
                        : context.pendingInteractionProposal
                ),
            }),
            confirmInitiatedPlay: assign({
                pendingInteractionProposal: ({ context, event }) => (
                    event.type === EventType.PlayProposalAccepted &&
                        context.pendingInteractionProposal?.id === event.proposalId
                        ? null
                        : context.pendingInteractionProposal
                ),
            }),
            rejectInitiatedChat: assign({
                interactionCooldowns: ({ context, event }) => (
                    event.type === EventType.ChatProposalRejected &&
                        context.currentInteraction?.id === event.proposalId
                        ? applyInteractionCooldowns(
                            context.interactionCooldowns,
                            context.currentInteraction,
                            event.timestamp ?? Date.now(),
                            context.currentInteraction.role,
                        )
                        : context.interactionCooldowns
                ),
                pendingInteractionProposal: ({ context, event }) => (
                    event.type === EventType.ChatProposalRejected &&
                        context.pendingInteractionProposal?.id === event.proposalId
                        ? null
                        : context.pendingInteractionProposal
                ),
                currentInteraction: ({ context, event }) => (
                    event.type === EventType.ChatProposalRejected &&
                        context.currentInteraction?.id === event.proposalId
                        ? null
                        : context.currentInteraction
                ),
            }),
            rejectInitiatedPlay: assign({
                interactionCooldowns: ({ context, event }) => (
                    event.type === EventType.PlayProposalRejected &&
                        context.currentInteraction?.id === event.proposalId
                        ? applyInteractionCooldowns(
                            context.interactionCooldowns,
                            context.currentInteraction,
                            event.timestamp ?? Date.now(),
                            context.currentInteraction.role,
                        )
                        : context.interactionCooldowns
                ),
                pendingInteractionProposal: ({ context, event }) => (
                    event.type === EventType.PlayProposalRejected &&
                        context.pendingInteractionProposal?.id === event.proposalId
                        ? null
                        : context.pendingInteractionProposal
                ),
                currentInteraction: ({ context, event }) => (
                    event.type === EventType.PlayProposalRejected &&
                        context.currentInteraction?.id === event.proposalId
                        ? null
                        : context.currentInteraction
                ),
            }),
            acceptIncomingChat: assign({
                currentInteraction: ({ event }) => (
                    event.type === EventType.AcceptChatProposal
                        ? {
                            id: event.proposalId,
                            type: 'chat',
                            partnerCharId: event.fromCharacterId,
                            role: 'target',
                            sourceEventId: event.sourceEventId,
                        }
                        : null
                ),
            }),
            acceptIncomingPlay: assign({
                currentInteraction: ({ event }) => (
                    event.type === EventType.AcceptPlayProposal
                        ? {
                            id: event.proposalId,
                            type: 'play',
                            partnerCharId: event.fromCharacterId,
                            role: 'target',
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
                        ? {
                            ...context.status,
                            moodValue: Math.min(100, context.status.moodValue + 10),
                            playNeed: Math.max(
                                0,
                                context.status.playNeed - PLAY_NEED_REDUCTION_AFTER_PLAYING_TOGETHER,
                            ),
                        }
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
                currentMotivation: () => 'idle',
            }),
            clearActivity: assign({
                pendingActivityJoin: () => null,
                currentActivity: () => null,
            }),
            clearInteraction: assign({
                interactionCooldowns: ({ context, event }) => (
                    event.type === EventType.EndChatInteraction &&
                        context.currentInteraction?.id === event.proposalId
                        ? applyInteractionCooldowns(
                            context.interactionCooldowns,
                            context.currentInteraction,
                            event.timestamp ?? Date.now(),
                            context.currentInteraction.role,
                        )
                        : context.interactionCooldowns
                ),
                pendingInteractionProposal: ({ context, event }) => (
                    event.type === EventType.EndChatInteraction &&
                        context.pendingInteractionProposal?.id === event.proposalId
                        ? null
                        : context.pendingInteractionProposal
                ),
                currentInteraction: ({ context, event }) => (
                    event.type === EventType.EndChatInteraction &&
                        context.currentInteraction?.id === event.proposalId
                        ? null
                        : context.currentInteraction
                ),
            }),
            completePlayInteraction: assign({
                interactionCooldowns: ({ context, event }) => (
                    event.type === EventType.EndPlayInteraction &&
                        context.currentInteraction?.id === event.proposalId
                        ? applyInteractionCooldowns(
                            context.interactionCooldowns,
                            context.currentInteraction,
                            event.timestamp ?? Date.now(),
                            context.currentInteraction.role,
                        )
                        : context.interactionCooldowns
                ),
                status: ({ context, event }) => (
                    event.type === EventType.EndPlayInteraction &&
                        context.currentInteraction?.id === event.proposalId
                        ? {
                            ...context.status,
                            moodValue: Math.min(100, context.status.moodValue + 14),
                            playNeed: Math.max(
                                0,
                                context.status.playNeed - PLAY_NEED_REDUCTION_AFTER_PLAYING_TOGETHER,
                            ),
                        }
                        : context.status
                ),
                pendingInteractionProposal: ({ context, event }) => (
                    event.type === EventType.EndPlayInteraction &&
                        context.pendingInteractionProposal?.id === event.proposalId
                        ? null
                        : context.pendingInteractionProposal
                ),
                currentInteraction: ({ context, event }) => (
                    event.type === EventType.EndPlayInteraction &&
                        context.currentInteraction?.id === event.proposalId
                        ? null
                        : context.currentInteraction
                ),
                currentMotivation: () => 'idle',
            }),
            recordInteractionCooldown: assign({
                interactionCooldowns: ({ context, event }) => {
                    if (event.type !== EventType.RecordInteractionCooldown) {
                        return context.interactionCooldowns;
                    }

                    return applyInteractionCooldowns(
                        context.interactionCooldowns,
                        {
                            id: event.proposalId,
                            type: event.interactionType,
                            partnerCharId: event.partnerCharId,
                            role: event.role,
                            sourceEventId: event.sourceEventId,
                        },
                        event.timestamp ?? Date.now(),
                        event.role,
                    );
                },
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
                        return {
                            ...context.status,
                            moodValue: Math.min(100, context.status.moodValue + 18),
                            playNeed: Math.max(0, context.status.playNeed - PLAY_NEED_REDUCTION_AFTER_SOLO_PLAY),
                        };
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

function canMakeAutonomousDecision(context: CharacterContext): boolean {
    return (
        context.target === null &&
        context.pendingInteractionProposal === null &&
        context.pendingActivityJoin === null &&
        context.currentInteraction === null &&
        context.currentActivity === null &&
        context.currentMotivation !== 'controllingByGod' &&
        !isLocked(context, 'bodyAction') &&
        !isLocked(context, 'bodyMove') &&
        !isLocked(context, 'mind')
    );
}
