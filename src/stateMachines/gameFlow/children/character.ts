import { assign, createMachine, enqueueActions, StateValue } from 'xstate';
import {
    clampMoodValue,
    getMoodForMoodValue,
} from '~/constants/character';
import { DEFAULT_EXPRESSION_PRESET_ID } from '~/constants/expressionCatalog';
import {
    CharacterBodyActionState,
    CharacterBodyMoveState,
    CharacterCommunicationState,
    CharacterControlState,
    CharacterMindState,
    CharacterStateSummary,
} from '../states';
import { CharacterEvent, EventType } from '../events';
import {
    CharacterActivityCooldowns,
    CharacterContext,
    CharacterMachineInput,
    CharacterPresence,
    CharacterUtilityScores,
} from '../context';
import {
    changeRelationshipIntimacy,
    normalizeRomanticRelationshipFeelings,
    rememberPassBy,
    rememberRelationshipMemory,
    rememberSpokenLine,
    setRelationshipFeeling,
} from '../relationships';
import { decideCharacterEvent } from '~/services/characterEvents/decision';
import {
    calculateCharacterUtilityScores,
    LOW_SATURATION_THRESHOLD,
    PLAY_NEED_GAIN_PER_TICK,
    PLAY_NEED_REDUCTION_AFTER_SOLO_PLAY,
    SATURATION_GAIN_AFTER_EATING,
    SATURATION_GAIN_AFTER_HOME_FOOD,
    SATURATION_LOSS_PER_TICK,
} from '~/services/characterEvents/utility';
import { applyCompletedActivityStatusEffects } from '~/services/characterEvents/activityCompletionEffects';
import {
    getRandomMapTarget,
} from '~/services/characterEvents/targets';
import { TOWN_APARTMENT_ENTRANCE_TILES, TOWN_WORLD_SPACE_ID } from '~/constants/townMap';
import {
    createEmptyActivityCooldowns,
    recordActivityCooldowns,
} from '~/services/characterEvents/activityCooldowns';
import {
    CHARACTER_EVENT_DEFINITIONS_BY_ID,
    type CharacterEventActivity,
} from '~/constants/charactarEventsDefinitions';
import { CHARACTER_BEHAVIOR_DEFINITIONS_BY_ID } from '~/constants/characterBehaviorDefinitions';
import type { CharacterRequestSatisfiedEffect } from '~/services/characterRequests/types';

const INITIAL_UTILITY_SCORES: CharacterUtilityScores = {
    idle: 10,
    findFood: 0,
    play: 35,
    chat: 15,
    goHome: 0,
};
const FIND_FOOD_AT_APARTMENT_EVENT_ID = 'need.findFoodAtApartment';

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
            personality: { ...input.personality },
            ownItems: [...(input.ownItems ?? [])],
            status: input.runtime?.status ?? {
                mood: getMoodForMoodValue(65),
                expressionPresetId: DEFAULT_EXPRESSION_PRESET_ID,
                saturation: input.saturation ?? 70,
                moodValue: 65,
                playNeed: 35,
                hungerThreshold: LOW_SATURATION_THRESHOLD,
            },
            utilityScores: INITIAL_UTILITY_SCORES,
            lastEventDecision: null,
            currentMotivation: 'idle',
            currentBehavior: null,
            controlState: CharacterControlState.Normal,
            pendingActivityJoin: null,
            currentActivity: null,
            heldItem: input.runtime?.heldItem ?? input.heldItem ?? null,
            activityCooldowns: input.runtime?.activityCooldowns ?? createEmptyActivityCooldowns(),
            position: input.runtime?.position ?? input.position,
            presence: input.runtime?.presence ?? {
                kind: 'positioned',
                spaceId: TOWN_WORLD_SPACE_ID,
                position: input.position,
            },
            target: null,
            relationships: input.runtime?.relationships ?? input.relationships ?? [],
            locks: input.runtime?.locks ?? {
                bodyAction: [],
                bodyMove: [],
                mind: [],
                communication: [],
            },
        }),
        type: 'parallel',
        on: {
            [EventType.Tick]: {
                guard: 'canReceiveTick',
                actions: ['tickStatus', 'clearExpiredBehavior', 'clearIdleTarget', 'updateUtilityScores', 'decideAndRaiseEvent'],
            },
            [EventType.PassBy]: {
                guard: 'canReceiveLogicCommand',
                actions: 'rememberPassBy',
            },
            [EventType.RememberRelationshipMemory]: {
                actions: 'rememberRelationshipMemory',
            },
            [EventType.RememberSpokenLine]: {
                actions: 'rememberSpokenLine',
            },
            [EventType.NormalizeRomanceFeelings]: {
                actions: 'normalizeRomanceFeelings',
            },
            [EventType.GoEat]: {
                guard: 'shouldChangeToFindFood',
                target: [
                    '.bodyAction.observing',
                    '.bodyMove.walking',
                    '.mind.thinking',
                    '.communication.requesting',
                ],
                actions: ['setFoodMotivation', 'setNeedBehavior', 'setManualTarget'],
            },
            [EventType.GoHome]: {
                guard: 'shouldGoHome',
                target: [
                    '.bodyAction.observing',
                    '.bodyMove.walking',
                    '.mind.thinking',
                    '.communication.null',
                    '.control.spaceTransition',
                ],
                actions: ['setGoHomeMotivation', 'setNeedBehavior', 'chooseApartmentEntranceTarget', 'setSpaceTransitionControl'],
            },
            [EventType.EnterApartment]: {
                guard: 'shouldEnterApartment',
                target: [
                    '.bodyAction.idle',
                    '.bodyMove.stand',
                    '.mind.null',
                    '.communication.null',
                    '.control.normal',
                ],
                actions: [
                    'completeApartmentFood',
                    'enterApartment',
                    'setIdleMotivation',
                    'clearBehavior',
                    'clearTarget',
                    'setNormalControl',
                ],
            },
            [EventType.LeaveApartment]: {
                guard: 'shouldLeaveApartment',
                target: [
                    '.bodyAction.idle',
                    '.bodyMove.stand',
                    '.mind.null',
                    '.communication.null',
                    '.control.normal',
                ],
                actions: ['leaveApartment', 'setIdleMotivation', 'clearBehavior', 'clearTarget', 'setNormalControl'],
            },
            [EventType.StartBehavior]: [
                {
                    guard: 'shouldStartWalkingBehavior',
                    target: [
                        '.bodyAction.observing',
                        '.bodyMove.walking',
                        '.mind.thinking',
                        '.communication.null',
                    ],
                    actions: ['setBehaviorMotivation', 'startBehavior', 'setBehaviorTarget'],
                },
                {
                    guard: 'shouldStartSittingBehavior',
                    target: [
                        '.bodyAction.idle',
                        '.bodyMove.sit',
                        '.mind.null',
                        '.communication.null',
                    ],
                    actions: ['setBehaviorMotivation', 'startBehavior', 'clearTarget'],
                },
                {
                    guard: 'shouldStartBehavior',
                    target: [
                        '.bodyAction.observing',
                        '.bodyMove.stand',
                        '.mind.thinking',
                        '.communication.null',
                    ],
                    actions: ['setBehaviorMotivation', 'startBehavior', 'setBehaviorTarget'],
                },
            ],
            [EventType.StartActivity]: [
                {
                    guard: 'shouldStartPlayWithItemActivity',
                    target: [
                        '.bodyAction.operating',
                        '.bodyMove.stand',
                        '.mind.thinking',
                        '.communication.null',
                    ],
                    actions: ['setActivityMotivation', 'clearBehavior', 'startOwnActivity'],
                },
                {
                    guard: 'shouldStartActivity',
                    target: [
                        '.bodyAction.socializing',
                        '.bodyMove.stand',
                        '.mind.thinking',
                        '.communication.null',
                    ],
                    actions: ['setActivityMotivation', 'clearBehavior', 'startOwnActivity'],
                },
            ],
            [EventType.JoinActivity]: [
                {
                    guard: 'shouldJoinPlayWithItemActivity',
                    target: [
                        '.bodyAction.operating',
                        '.bodyMove.stand',
                        '.mind.thinking',
                        '.communication.null',
                    ],
                    actions: ['setActivityMotivation', 'clearBehavior', 'setPendingActivityJoin'],
                },
                {
                    guard: 'shouldJoinActivity',
                    target: [
                        '.bodyAction.socializing',
                        '.bodyMove.stand',
                        '.mind.thinking',
                        '.communication.null',
                    ],
                    actions: ['setActivityMotivation', 'clearBehavior', 'setPendingActivityJoin'],
                },
            ],
            [EventType.JoinActivityAccepted]: [
                {
                    guard: 'shouldAcceptPlayWithItemActivityJoin',
                    target: [
                        '.bodyAction.operating',
                        '.bodyMove.stand',
                        '.mind.thinking',
                        '.communication.null',
                    ],
                    actions: ['setActivityMotivation', 'clearBehavior', 'acceptActivityJoin', 'clearTarget'],
                },
                {
                    guard: 'shouldAcceptActivityJoin',
                    target: [
                        '.bodyAction.socializing',
                        '.bodyMove.stand',
                        '.mind.thinking',
                        '.communication.null',
                    ],
                    actions: ['setActivityMotivation', 'clearBehavior', 'acceptActivityJoin', 'clearTarget'],
                },
            ],
            [EventType.JoinActivityRejected]: {
                guard: 'shouldRejectActivityJoin',
                target: [
                    '.bodyAction.idle',
                    '.bodyMove.stand',
                    '.mind.null',
                    '.communication.null',
                ],
                actions: ['rejectActivityJoin', 'setIdleMotivation', 'clearBehavior', 'clearTarget'],
            },
            [EventType.EndJoinedActivity]: {
                guard: 'shouldEndJoinedActivity',
                target: [
                    '.bodyAction.idle',
                    '.bodyMove.stand',
                    '.mind.null',
                    '.communication.null',
                ],
                actions: ['completeJoinedActivity', 'clearBehavior', 'clearTarget'],
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
                    guard: 'shouldSetSpaceTransitionControl',
                    target: '.control.spaceTransition',
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
                actions: ['setIdleMotivation', 'clearBehavior', 'clearTarget'],
            },
            [EventType.PickUp]: {
                guard: 'canReceivePickUpCommand',
                target: [
                    '.bodyAction.pickedUp',
                    '.bodyMove.stand',
                    '.mind.thinking',
                    '.communication.null',
                    '.control.normal',
                ],
                actions: ['setPickedUpMotivation', 'clearBehavior', 'clearTarget', 'clearActivity', 'setNormalControl'],
            },
            [EventType.Drop]: {
                guard: 'canReceiveDropCommand',
                target: [
                    '.bodyAction.idle',
                    '.bodyMove.stand',
                    '.mind.null',
                    '.communication.null',
                    '.control.normal',
                ],
                actions: ['dropAtPosition', 'setIdleMotivation', 'clearBehavior', 'clearTarget', 'setNormalControl'],
            },
            [EventType.MoveTo]: {
                guard: 'canReceiveLogicCommand',
                target: [
                    '.bodyAction.observing',
                    '.bodyMove.walking',
                    '.mind.thinking',
                ],
                actions: ['setManualMoveBehavior', 'setManualTarget'],
            },
            [EventType.Arrive]: [
                {
                    guard: 'shouldStartBehaviorDwellOnArrive',
                    target: [
                        '.bodyAction.observing',
                        '.bodyMove.stand',
                        '.mind.thinking',
                        '.communication.null',
                    ],
                    actions: ['arriveAtTarget', 'startBehaviorDwell'],
                },
                {
                    target: [
                        '.bodyAction.idle',
                        '.bodyMove.stand',
                        '.mind.null',
                        '.communication.null',
                    ],
                    actions: ['arriveAtTarget', 'completeCurrentMotivation', 'clearBehavior'],
                },
            ],
            [EventType.MoveBlocked]: [
                {
                    guard: 'isSpaceTransitionControl',
                    target: [
                        '.bodyAction.idle',
                        '.bodyMove.stand',
                        '.mind.null',
                        '.communication.null',
                        '.control.normal',
                    ],
                    actions: ['syncPositionOnBlock', 'setIdleMotivation', 'clearBehavior', 'clearTarget', 'clearActivity', 'setNormalControl'],
                },
                {
                    target: [
                        '.bodyAction.idle',
                        '.bodyMove.stand',
                        '.mind.null',
                        '.communication.null',
                    ],
                    actions: ['syncPositionOnBlock', 'setIdleMotivation', 'clearBehavior', 'clearTarget', 'clearActivity'],
                },
            ],
            [EventType.ApplyOfflineRuntime]: {
                target: [
                    '.bodyAction.idle',
                    '.bodyMove.stand',
                    '.mind.null',
                    '.communication.null',
                    '.control.normal',
                ],
                actions: ['applyOfflineRuntime', 'setIdleMotivation', 'clearBehavior', 'clearTarget', 'clearActivity', 'setNormalControl'],
            },
            [EventType.StartThinking]: {
                guard: 'canReceiveLogicCommand',
                target: '.mind.thinking',
            },
            [EventType.StopThinking]: {
                guard: 'canReceiveLogicCommand',
                target: '.mind.null',
            },
            [EventType.SetExpressionPreset]: {
                actions: 'setExpressionPreset',
            },
            [EventType.HoldItem]: {
                actions: 'setHeldItem',
            },
            [EventType.ReleaseHeldItem]: {
                actions: 'clearHeldItem',
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
                    [CharacterControlState.SpaceTransition]: {},
                },
            },
        },
    },
    {
        guards: {
            canReceiveLogicCommand: ({ context }) => canReceiveNormalLogicCommand(context),
            canReceivePickUpCommand: ({ context }) => canReceivePickUpCommand(context),
            canReceiveDropCommand: ({ context }) => canReceiveDropCommand(context),
            canReceiveTick: ({ context }) => canReceiveNormalLogicCommand(context),
            shouldChangeToFindFood: ({ context }) => (
                canReceiveActivityIdleLogicCommand(context) &&
                context.currentMotivation !== 'controllingByGod' &&
                context.currentMotivation !== 'findFood'
            ),
            shouldGoHome: ({ context }) => (
                canReceiveActivityIdleLogicCommand(context) &&
                context.currentMotivation !== 'controllingByGod' &&
                context.presence.kind === 'positioned'
            ),
            shouldEnterApartment: ({ context, event }) => (
                event.type === EventType.EnterApartment &&
                context.controlState === CharacterControlState.SpaceTransition &&
                context.currentMotivation === 'goHome'
            ),
            shouldLeaveApartment: ({ context, event }) => (
                event.type === EventType.LeaveApartment &&
                context.presence.kind === 'contained'
            ),
            isSpaceTransitionControl: ({ context }) => (
                context.controlState === CharacterControlState.SpaceTransition
            ),
            shouldStartBehavior: ({ context }) => canStartBehavior(context),
            shouldStartWalkingBehavior: ({ context, event }) => (
                event.type === EventType.StartBehavior &&
                canStartBehavior(context) &&
                event.target !== undefined &&
                !isSamePosition(context.position, event.target)
            ),
            shouldStartSittingBehavior: ({ context, event }) => (
                event.type === EventType.StartBehavior &&
                canStartBehavior(context) &&
                getBehaviorDefinition(event.behaviorId)?.type === 'sit'
            ),
            shouldStartBehaviorDwellOnArrive: ({ context, event }) => (
                event.type === EventType.Arrive &&
                context.currentBehavior !== null &&
                context.currentBehavior.endsAt === undefined &&
                context.target !== null &&
                isSamePosition(context.target, event.position) &&
                getBehaviorDefinition(context.currentBehavior.id)?.durationMs !== undefined
            ),
            shouldStartActivity: ({ context }) => canStartOrJoinActivity(context),
            shouldStartPlayWithItemActivity: ({ context, event }) => (
                event.type === EventType.StartActivity &&
                canStartOrJoinActivity(context) &&
                isPlayWithItemActivityEvent(context, event)
            ),
            shouldJoinActivity: ({ context }) => canStartOrJoinActivity(context),
            shouldJoinPlayWithItemActivity: ({ context, event }) => (
                event.type === EventType.JoinActivity &&
                canStartOrJoinActivity(context) &&
                isPlayWithItemActivityEvent(context, event)
            ),
            shouldAcceptActivityJoin: ({ context, event }) => (
                canReceiveNormalLogicCommand(context) &&
                event.type === EventType.JoinActivityAccepted &&
                canAcceptActivityJoin(context, event.activityId)
            ),
            shouldAcceptPlayWithItemActivityJoin: ({ context, event }) => (
                event.type === EventType.JoinActivityAccepted &&
                canReceiveNormalLogicCommand(context) &&
                canAcceptActivityJoin(context, event.activityId) &&
                isPlayWithItemActivityEvent(context, event)
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
                canReceiveActivityIdleLogicCommand(context) &&
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
            shouldSetSpaceTransitionControl: ({ event }) => (
                event.type === EventType.SetControlState &&
                event.controlState === CharacterControlState.SpaceTransition
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
            setExpressionPreset: assign({
                status: ({ context, event }) => {
                    if (event.type !== EventType.SetExpressionPreset) return context.status;
                    return {
                        ...context.status,
                        expressionPresetId: event.expressionPresetId,
                    };
                },
            }),
            setHeldItem: assign({
                heldItem: ({ context, event }) => (
                    event.type === EventType.HoldItem
                        ? {
                            itemInstanceId: event.itemInstanceId,
                            definitionId: event.definitionId,
                        }
                        : context.heldItem
                ),
            }),
            clearHeldItem: assign({
                heldItem: () => null,
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
                    context.status.moodValue - 0.1,
                ),
            }),
            clearExpiredBehavior: assign({
                currentBehavior: ({ context, event }) => (
                    isBehaviorExpired(context, event) ? null : context.currentBehavior
                ),
                target: ({ context, event }) => (
                    isBehaviorExpired(context, event) ? null : context.target
                ),
                currentMotivation: ({ context, event }) => (
                    isBehaviorExpired(context, event) ? 'idle' : context.currentMotivation
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
                    nearbyCharacterDistances: event.nearbyCharacterDistances,
                    nearbyRelationships: event.nearbyRelationships,
                    nearbyJoinableActivities: event.nearbyJoinableActivities,
                    nearbyVisibleItems: event.nearbyVisibleItems,
                    nearbyObservableObjects: event.nearbyObservableObjects,
                    ownItemIds: event.ownItemIds,
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
            setGoHomeMotivation: assign({
                currentMotivation: () => 'goHome',
            }),
            setBehaviorMotivation: assign({
                currentMotivation: ({ context, event }) => (
                    event.type === EventType.StartBehavior
                        ? getBehaviorDefinition(event.behaviorId)?.motivation ?? context.currentMotivation
                        : context.currentMotivation
                ),
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
            setSpaceTransitionControl: assign({
                controlState: () => CharacterControlState.SpaceTransition,
            }),
            setNormalControl: assign({
                controlState: () => CharacterControlState.Normal,
            }),
            setPickedUpMotivation: assign({
                currentMotivation: () => 'controllingByGod',
            }),
            setNeedBehavior: assign({
                currentBehavior: ({ event }) => createNonTickableBehaviorState(
                    getNeedBehaviorId(event),
                    Date.now(),
                ),
            }),
            setManualMoveBehavior: assign({
                currentBehavior: () => createNonTickableBehaviorState('manual.moveTo', Date.now()),
            }),
            startBehavior: assign({
                currentBehavior: ({ context, event }) => (
                    event.type === EventType.StartBehavior
                        ? createBehaviorState(
                            event.behaviorId,
                            event.timestamp ?? Date.now(),
                            event.target !== undefined && !isSamePosition(context.position, event.target),
                        )
                        : null
                ),
            }),
            startBehaviorDwell: assign({
                currentBehavior: ({ context }) => {
                    const currentBehavior = context.currentBehavior;
                    const durationMs = currentBehavior
                        ? getBehaviorDefinition(currentBehavior.id)?.durationMs
                        : undefined;

                    if (!currentBehavior || durationMs === undefined) {
                        return currentBehavior;
                    }

                    const startedAt = Date.now();

                    return {
                        ...currentBehavior,
                        startedAt,
                        endsAt: startedAt + durationMs,
                    };
                },
            }),
            chooseRandomTarget: assign({
                target: ({ context }) => getRandomMapTarget(context.position),
            }),
            chooseApartmentEntranceTarget: assign({
                target: () => chooseRandomApartmentEntranceTile(),
            }),
            setBehaviorTarget: assign({
                target: ({ event }) => (
                    event.type === EventType.StartBehavior ? event.target ?? null : null
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
                        !event.cancelled &&
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
                        !event.cancelled &&
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
                activityCooldowns: ({ context, event }) => (
                    event.type === EventType.EndJoinedActivity &&
                        !event.cancelled &&
                        context.currentActivity?.activityId === event.activityId
                        ? recordActivityCooldowns(context.activityCooldowns, {
                            partnerCharIds: (event.participantIds ?? [])
                                .filter(participantId => participantId !== context.id),
                            role: event.activityRole ?? 'target',
                            sourceEventId: event.sourceEventId ?? context.currentActivity.sourceEventId,
                            timestamp: event.timestamp ?? Date.now(),
                        })
                        : context.activityCooldowns
                ),
                currentMotivation: () => 'idle',
            }),
            clearActivity: assign({
                pendingActivityJoin: () => null,
                currentActivity: () => null,
            }),
            clearBehavior: assign({
                currentBehavior: () => null,
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
            normalizeRomanceFeelings: assign({
                relationships: ({ context }) => normalizeRomanticRelationshipFeelings(context.relationships),
            }),
            applyOfflineRuntime: assign({
                status: ({ context, event }) => (
                    event.type === EventType.ApplyOfflineRuntime
                        ? { ...event.runtime.status }
                        : context.status
                ),
                position: ({ context, event }) => (
                    event.type === EventType.ApplyOfflineRuntime
                        ? { ...event.runtime.position }
                        : context.position
                ),
                presence: ({ context, event }) => (
                    event.type === EventType.ApplyOfflineRuntime
                        ? cloneCharacterPresence(event.runtime.presence)
                        : context.presence
                ),
                heldItem: ({ context, event }) => (
                    event.type === EventType.ApplyOfflineRuntime
                        ? event.runtime.heldItem ? { ...event.runtime.heldItem } : null
                        : context.heldItem
                ),
                activityCooldowns: ({ context, event }) => (
                    event.type === EventType.ApplyOfflineRuntime
                        ? cloneActivityCooldowns(event.runtime.activityCooldowns)
                        : context.activityCooldowns
                ),
                locks: ({ context, event }) => (
                    event.type === EventType.ApplyOfflineRuntime
                        ? {
                            bodyAction: [...event.runtime.locks.bodyAction],
                            bodyMove: [...event.runtime.locks.bodyMove],
                            mind: [...event.runtime.locks.mind],
                            communication: [...event.runtime.locks.communication],
                        }
                        : context.locks
                ),
                relationships: ({ context, event }) => (
                    event.type === EventType.ApplyOfflineRuntime
                        ? event.runtime.relationships.map(relationship => ({
                            ...relationship,
                            spokenLines: relationship.spokenLines.map(line => ({ ...line })),
                            memories: {
                                impression: { ...relationship.memories.impression },
                                argument: { ...relationship.memories.argument },
                                fight: { ...relationship.memories.fight },
                                kiss: { ...relationship.memories.kiss },
                                wallSlam: { ...relationship.memories.wallSlam },
                            },
                        }))
                        : context.relationships
                ),
                utilityScores: ({ context, event }) => (
                    event.type === EventType.ApplyOfflineRuntime
                        ? calculateCharacterUtilityScores({
                            ...context,
                            status: event.runtime.status,
                            position: event.runtime.position,
                            presence: event.runtime.presence,
                            heldItem: event.runtime.heldItem,
                            activityCooldowns: event.runtime.activityCooldowns,
                            locks: event.runtime.locks,
                            relationships: event.runtime.relationships,
                        })
                        : context.utilityScores
                ),
            }),
            clearTarget: assign({
                target: () => null,
            }),
            clearIdleTarget: assign({
                target: ({ context }) => (
                    context.currentMotivation === 'idle' &&
                        context.currentActivity === null &&
                        context.pendingActivityJoin === null &&
                        context.currentBehavior === null
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
                presence: ({ context, event }) => (
                    event.type === EventType.Drop && event.position
                        ? {
                            kind: 'positioned',
                            spaceId: TOWN_WORLD_SPACE_ID,
                            position: event.position,
                        }
                        : context.presence
                ),
            }),
            arriveAtTarget: assign({
                position: ({ event }) => (event.type === EventType.Arrive ? event.position : { x: 0, y: 0 }),
                presence: ({ context, event }) => (
                    event.type === EventType.Arrive
                        ? {
                            kind: 'positioned',
                            spaceId: context.presence.kind === 'positioned'
                                ? context.presence.spaceId
                                : TOWN_WORLD_SPACE_ID,
                            position: event.position,
                        }
                        : context.presence
                ),
                target: () => null,
            }),
            enterApartment: assign({
                presence: ({ context, event }) => (
                    event.type === EventType.EnterApartment
                        ? {
                            kind: 'contained',
                            spaceId: event.apartmentSpaceId,
                        }
                        : context.presence
                ),
            }),
            completeApartmentFood: assign({
                status: ({ context, event }) => (
                    event.type === EventType.EnterApartment &&
                        context.lastEventDecision?.selectedCandidateId === FIND_FOOD_AT_APARTMENT_EVENT_ID
                        ? {
                            ...context.status,
                            saturation: Math.min(
                                100,
                                context.status.saturation + SATURATION_GAIN_AFTER_HOME_FOOD,
                            ),
                        }
                        : context.status
                ),
            }),
            leaveApartment: assign({
                position: ({ context, event }) => (
                    event.type === EventType.LeaveApartment ? event.position : context.position
                ),
                presence: ({ context, event }) => (
                    event.type === EventType.LeaveApartment
                        ? {
                            kind: 'positioned',
                            spaceId: event.worldSpaceId,
                            position: event.position,
                        }
                        : context.presence
                ),
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
                currentMotivation: ({ context }) => {
                    if (context.currentActivity || context.currentMotivation === 'goHome') {
                        return context.currentMotivation;
                    }

                    return 'idle';
                },
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
            rememberRelationshipMemory: assign({
                relationships: ({ context, event }) => (
                    event.type === EventType.RememberRelationshipMemory
                        ? rememberRelationshipMemory(
                            context.relationships,
                            context.id,
                            event.targetCharId,
                            event.memoryType,
                            event.countDelta,
                            event.startedById,
                            event.timestamp ?? Date.now(),
                        )
                        : context.relationships
                ),
            }),
            rememberSpokenLine: assign({
                relationships: ({ context, event }) => (
                    event.type === EventType.RememberSpokenLine
                        ? rememberSpokenLine(
                            context.relationships,
                            context.id,
                            event.targetCharId,
                            event.memoryKey,
                            event.text,
                            event.timestamp ?? Date.now(),
                        )
                        : context.relationships
                ),
            }),
        },
    }
);

function cloneCharacterPresence(presence: CharacterPresence): CharacterPresence {
    return presence.kind === 'positioned'
        ? {
            kind: 'positioned',
            spaceId: presence.spaceId,
            position: { ...presence.position },
        }
        : {
            kind: 'contained',
            spaceId: presence.spaceId,
        };
}

function cloneActivityCooldowns(
    activityCooldowns: CharacterActivityCooldowns,
): CharacterActivityCooldowns {
    return {
        commonUntil: activityCooldowns.commonUntil,
        categoryUntilByKey: { ...activityCooldowns.categoryUntilByKey },
        pairUntilByKey: { ...activityCooldowns.pairUntilByKey },
        repeatByKey: Object.fromEntries(
            Object.entries(activityCooldowns.repeatByKey).map(([key, record]) => [
                key,
                { ...record },
            ]),
        ),
    };
}

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

function canStartOrJoinActivity(context: CharacterContext): boolean {
    return (
        canReceiveNormalLogicCommand(context) &&
        context.currentMotivation !== 'controllingByGod' &&
        context.currentActivity === null &&
        context.pendingActivityJoin === null &&
        context.currentBehavior?.tickable !== false
    );
}

function canStartBehavior(context: CharacterContext): boolean {
    return (
        canReceiveNormalLogicCommand(context) &&
        context.currentMotivation !== 'controllingByGod' &&
        context.presence.kind === 'positioned' &&
        context.currentActivity === null &&
        context.pendingActivityJoin === null &&
        context.currentBehavior?.tickable !== false &&
        !isLocked(context, 'bodyAction') &&
        !isLocked(context, 'bodyMove') &&
        !isLocked(context, 'mind')
    );
}

function canAcceptActivityJoin(
    context: CharacterContext,
    activityId: string,
): boolean {
    if (context.pendingActivityJoin?.activityId === activityId) {
        return true;
    }

    return (
        context.pendingActivityJoin === null &&
        context.currentActivity === null &&
        context.currentMotivation !== 'controllingByGod'
    );
}

function isPlayWithItemActivityEvent(context: CharacterContext, event: CharacterEvent): boolean {
    if (
        event.type !== EventType.StartActivity &&
        event.type !== EventType.JoinActivity &&
        event.type !== EventType.JoinActivityAccepted
    ) {
        return false;
    }

    const definition = CHARACTER_EVENT_DEFINITIONS_BY_ID[event.sourceEventId];

    if (!definition) {
        return false;
    }

    if (event.type === EventType.StartActivity) {
        const selectedVariantId = context.lastEventDecision?.selectedPresentationVariantId;
        const selectedVariant = definition.presentationVariants
            ?.find(variant => variant.id === selectedVariantId);

        return selectedVariant?.activity?.type === 'playWithItem';
    }

    return definition.presentationVariants
        ?.some(variant => variant.activity?.type === 'playWithItem') === true;
}

function isLocked(context: CharacterContext, part: keyof CharacterContext['locks']) {
    return context.locks[part].length > 0;
}

function canReceiveNormalLogicCommand(context: CharacterContext): boolean {
    return context.controlState === CharacterControlState.Normal;
}

function canReceivePickUpCommand(context: CharacterContext): boolean {
    if (canReceiveNormalLogicCommand(context)) {
        return true;
    }

    return (
        context.controlState === CharacterControlState.SpaceTransition &&
        context.currentMotivation === 'goHome' &&
        context.presence.kind === 'positioned' &&
        !isLocked(context, 'bodyAction') &&
        !isLocked(context, 'bodyMove')
    );
}

function canReceiveDropCommand(context: CharacterContext): boolean {
    if (canReceiveNormalLogicCommand(context)) {
        return true;
    }

    return (
        context.currentMotivation === 'controllingByGod' &&
        context.presence.kind === 'positioned' &&
        !isLocked(context, 'bodyAction') &&
        !isLocked(context, 'bodyMove')
    );
}

function canReceiveActivityIdleLogicCommand(context: CharacterContext): boolean {
    return (
        canReceiveNormalLogicCommand(context) &&
        context.currentActivity === null &&
        context.pendingActivityJoin === null &&
        context.currentBehavior?.tickable !== false
    );
}

function getBehaviorDefinition(behaviorId: string) {
    return CHARACTER_BEHAVIOR_DEFINITIONS_BY_ID[behaviorId];
}

function createBehaviorState(
    behaviorId: string,
    timestamp: number,
    isTravelingToTarget = false,
): CharacterContext['currentBehavior'] {
    const definition = getBehaviorDefinition(behaviorId);

    if (!definition) {
        return null;
    }

    return {
        id: behaviorId,
        tickable: definition.tickable,
        startedAt: timestamp,
        endsAt: isTravelingToTarget || definition.durationMs === undefined
            ? undefined
            : timestamp + definition.durationMs,
    };
}

function createNonTickableBehaviorState(
    behaviorId: string | null,
    timestamp: number,
): CharacterContext['currentBehavior'] {
    return behaviorId
        ? {
            id: behaviorId,
            tickable: false,
            startedAt: timestamp,
        }
        : null;
}

function getNeedBehaviorId(event: CharacterEvent): string | null {
    switch (event.type) {
        case EventType.GoEat:
            return 'need.findFood';
        case EventType.GoHome:
            return 'need.goHome';
        default:
            return null;
    }
}

function isBehaviorExpired(context: CharacterContext, event: CharacterEvent): boolean {
    return event.type === EventType.Tick &&
        context.currentBehavior?.endsAt !== undefined &&
        (event.timestamp ?? Date.now()) >= context.currentBehavior.endsAt;
}

function chooseRandomApartmentEntranceTile(): CharacterContext['position'] {
    const entranceTile = TOWN_APARTMENT_ENTRANCE_TILES[
        Math.floor(Math.random() * TOWN_APARTMENT_ENTRANCE_TILES.length)
    ];

    return { x: entranceTile.x, y: entranceTile.y };
}

function isSamePosition(
    left: CharacterContext['position'],
    right: CharacterContext['position'],
): boolean {
    return left.x === right.x && left.y === right.y;
}

function getCompletedActivityStatus(
    context: CharacterContext,
    activityEffects: CharacterEventActivity['effects'],
): CharacterContext['status'] {
    return applyCompletedActivityStatusEffects(context.status, activityEffects);
}

function updateCharacterMoodValue(
    status: CharacterContext['status'],
    moodValue: number,
): CharacterContext['status'] {
    const clampedMoodValue = Number(clampMoodValue(moodValue).toFixed(1));

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

                return setRelationshipFeeling(
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
        context.presence.kind === 'positioned' &&
        context.pendingActivityJoin === null &&
        context.currentActivity === null &&
        context.currentMotivation !== 'controllingByGod' &&
        context.currentBehavior?.tickable !== false &&
        !isLocked(context, 'bodyAction') &&
        !isLocked(context, 'bodyMove') &&
        !isLocked(context, 'mind')
    );
}
