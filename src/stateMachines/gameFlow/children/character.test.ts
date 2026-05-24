import { createActor } from 'xstate';
import { describe, expect, test } from 'vitest';
import {
    TOWN_APARTMENT_ENTRANCE_TILES,
    TOWN_APARTMENT_SPACE_ID,
    TOWN_WORLD_SPACE_ID,
} from '~/constants/townMap';
import { CharacterControlReason } from '../controlReasons';
import { EventType } from '../events';
import {
    CharacterBodyActionState,
    CharacterBodyMoveState,
    CharacterControlState,
} from '../states';
import { characterMachine, getCharacterStateSummary } from './character';

function createTestCharacterActor() {
    return createActor(characterMachine, {
        input: {
            id: 'character-a',
            name: '測試角色',
            position: { x: 1, y: 1 },
            saturation: 50,
        },
    }).start();
}

describe('character space transition control', () => {
    test('blocks normal need-driven movement while allowing transition arrival updates', () => {
        const actor = createTestCharacterActor();

        actor.send({
            type: EventType.SetControlState,
            controlState: CharacterControlState.SpaceTransition,
            reason: CharacterControlReason.SpaceTransition,
        });

        expect(actor.getSnapshot().context.controlState).toBe(CharacterControlState.SpaceTransition);

        actor.send({ type: EventType.GoEat, target: { x: 8, y: 41 } });
        actor.send({ type: EventType.MoveTo, target: { x: 10, y: 41 } });

        const blockedSnapshot = actor.getSnapshot();

        expect(blockedSnapshot.context.currentMotivation).toBe('idle');
        expect(blockedSnapshot.context.target).toBeNull();
        expect(blockedSnapshot.context.position).toEqual({ x: 1, y: 1 });
        expect(getCharacterStateSummary(blockedSnapshot.value).bodyMove).toBe(CharacterBodyMoveState.Stand);

        actor.send({ type: EventType.Arrive, position: { x: 62, y: 13 } });

        const arrivedSnapshot = actor.getSnapshot();

        expect(arrivedSnapshot.context.position).toEqual({ x: 62, y: 13 });
        expect(arrivedSnapshot.context.controlState).toBe(CharacterControlState.SpaceTransition);
    });

    test('goes home through an apartment entrance before entering the apartment space', () => {
        const actor = createTestCharacterActor();

        actor.send({ type: EventType.GoHome });

        const goingHomeSnapshot = actor.getSnapshot();

        expect(goingHomeSnapshot.context.controlState).toBe(CharacterControlState.SpaceTransition);
        expect(goingHomeSnapshot.context.currentMotivation).toBe('goHome');
        expect(goingHomeSnapshot.context.presence).toEqual({
            kind: 'positioned',
            spaceId: TOWN_WORLD_SPACE_ID,
            position: { x: 1, y: 1 },
        });
        expect(TOWN_APARTMENT_ENTRANCE_TILES).toContainEqual(goingHomeSnapshot.context.target);
        expect(getCharacterStateSummary(goingHomeSnapshot.value).bodyMove).toBe(CharacterBodyMoveState.Walking);

        actor.send({ type: EventType.GoEat, target: { x: 8, y: 41 } });
        actor.send({ type: EventType.MoveTo, target: { x: 10, y: 41 } });

        const uninterruptedSnapshot = actor.getSnapshot();

        expect(uninterruptedSnapshot.context.currentMotivation).toBe('goHome');
        expect(uninterruptedSnapshot.context.target).toEqual(goingHomeSnapshot.context.target);

        actor.send({ type: EventType.Arrive, position: goingHomeSnapshot.context.target! });

        const arrivedSnapshot = actor.getSnapshot();

        expect(arrivedSnapshot.context.controlState).toBe(CharacterControlState.SpaceTransition);
        expect(arrivedSnapshot.context.position).toEqual(goingHomeSnapshot.context.target);
        expect(arrivedSnapshot.context.presence).toEqual({
            kind: 'positioned',
            spaceId: TOWN_WORLD_SPACE_ID,
            position: goingHomeSnapshot.context.target,
        });

        actor.send({ type: EventType.EnterApartment, apartmentSpaceId: TOWN_APARTMENT_SPACE_ID });

        const insideSnapshot = actor.getSnapshot();

        expect(insideSnapshot.context.controlState).toBe(CharacterControlState.Normal);
        expect(insideSnapshot.context.currentMotivation).toBe('idle');
        expect(insideSnapshot.context.target).toBeNull();
        expect(insideSnapshot.context.presence).toEqual({
            kind: 'contained',
            spaceId: TOWN_APARTMENT_SPACE_ID,
        });
    });

    test('returns to normal control after a space transition completes', () => {
        const actor = createTestCharacterActor();

        actor.send({
            type: EventType.SetControlState,
            controlState: CharacterControlState.SpaceTransition,
            reason: CharacterControlReason.SpaceTransition,
        });
        actor.send({
            type: EventType.SetControlState,
            controlState: CharacterControlState.Normal,
            reason: CharacterControlReason.SpaceTransition,
        });
        actor.send({ type: EventType.MoveTo, target: { x: 8, y: 41 } });

        const snapshot = actor.getSnapshot();

        expect(snapshot.context.controlState).toBe(CharacterControlState.Normal);
        expect(snapshot.context.target).toEqual({ x: 8, y: 41 });
        expect(getCharacterStateSummary(snapshot.value).bodyMove).toBe(CharacterBodyMoveState.Walking);
    });
});

describe('character activity body action', () => {
    test('uses operating body action while joining a play-with-item activity', () => {
        const actor = createTestCharacterActor();

        actor.send({
            type: EventType.JoinActivity,
            activityId: 'activity-play-item',
            sourceEventId: 'need.playWithItem',
        });

        const snapshot = actor.getSnapshot();

        expect(getCharacterStateSummary(snapshot.value).bodyAction).toBe(CharacterBodyActionState.Operating);
    });

    test('keeps socializing body action while joining a chat activity', () => {
        const actor = createTestCharacterActor();

        actor.send({
            type: EventType.JoinActivity,
            activityId: 'activity-chat',
            sourceEventId: 'environment.nearbyCharacter.chat',
        });

        const snapshot = actor.getSnapshot();

        expect(getCharacterStateSummary(snapshot.value).bodyAction).toBe(CharacterBodyActionState.Socializing);
    });
});

describe('character held item context', () => {
    test('records and clears the item currently held by the character', () => {
        const actor = createTestCharacterActor();

        actor.send({
            type: EventType.HoldItem,
            itemInstanceId: 'item-toy-ball-1',
            definitionId: 'toy-ball',
        });

        expect(actor.getSnapshot().context.heldItem).toEqual({
            itemInstanceId: 'item-toy-ball-1',
            definitionId: 'toy-ball',
        });

        actor.send({ type: EventType.ReleaseHeldItem });

        expect(actor.getSnapshot().context.heldItem).toBeNull();
    });
});

describe('character request fulfillment movement recovery', () => {
    test('resumes the original need target after request fulfillment control ends', () => {
        const actor = createTestCharacterActor();
        const originalTarget = { x: 8, y: 41 };
        const interruptedTarget = { x: 10, y: 41 };

        actor.send({ type: EventType.GoEat, target: originalTarget });

        actor.send({
            type: EventType.SetControlState,
            controlState: CharacterControlState.RequestFulfillment,
            reason: CharacterControlReason.RequestFulfillment,
        });
        actor.send({
            type: EventType.AddLock,
            parts: ['bodyAction', 'bodyMove', 'mind', 'communication'],
            reason: CharacterControlReason.RequestFulfillment,
        });
        actor.send({ type: EventType.MoveTo, target: interruptedTarget });

        const lockedSnapshot = actor.getSnapshot();

        expect(lockedSnapshot.context.currentMotivation).toBe('findFood');
        expect(lockedSnapshot.context.target).toEqual(originalTarget);

        actor.send({
            type: EventType.RemoveLock,
            parts: ['bodyAction', 'bodyMove', 'mind', 'communication'],
            reason: CharacterControlReason.RequestFulfillment,
        });
        actor.send({
            type: EventType.SetControlState,
            controlState: CharacterControlState.Normal,
            reason: CharacterControlReason.RequestFulfillment,
        });
        actor.send({ type: EventType.MoveTo, target: originalTarget });

        const resumedSnapshot = actor.getSnapshot();

        expect(resumedSnapshot.context.controlState).toBe(CharacterControlState.Normal);
        expect(resumedSnapshot.context.currentMotivation).toBe('findFood');
        expect(resumedSnapshot.context.target).toEqual(originalTarget);
        expect(getCharacterStateSummary(resumedSnapshot.value).bodyMove).toBe(CharacterBodyMoveState.Walking);
    });
});
