import { getSeedPlayableCharacters } from '~/services/playableCharacterService';
import type { JoinableActivity } from '~/services/characterEvents/joinableActivities';
import type {
  CharacterEventNearbyRelationship,
  CharacterEventNearbyVisibleItem,
} from '~/services/characterEvents/types';
import type { CharacterRequestService } from '~/services/characterRequests/characterRequestService';
import type { CharacterRequestCharacterTarget } from '~/services/characterRequests/types';
import type {
  CharacterActor,
  CharacterSeed,
  CharacterSnapshot,
  SendCharacterEvent,
} from '~/services/townCharacterTypes';
import { EventType } from '~/stateMachines/gameFlow/events';

interface TownCharacterTickCoordinatorOptions {
  characterSeeds?: readonly CharacterSeed[];
  requestService: CharacterRequestService;
  getCharacterSnapshot: (characterId: string) => CharacterSnapshot | null;
  isCharacterActive: (characterId: string) => boolean;
  spawnCharacterActor: (character: CharacterSeed) => void;
  maybeLeaveApartmentForOutsideNeed: (characterId: string) => boolean;
  getNearbyCharacterIds: (characterId: string, range: number) => string[];
  getNearbyVisibleItems: (characterId: string, radius: number) => CharacterEventNearbyVisibleItem[];
  getNearbyRelationships: (
    characterId: string,
    nearbyCharacterIds: readonly string[],
  ) => readonly CharacterEventNearbyRelationship[];
  getNearbyJoinableActivities: (characterId: string, timestamp: number) => readonly JoinableActivity[];
  getAvailableActorItemDefinitionIds: (characterId: string) => readonly string[];
  getRelationshipTargets: (characterId: string) => readonly CharacterRequestCharacterTarget[];
  getCharacterActors: () => ReadonlyMap<string, CharacterActor>;
  sendToCharacter: SendCharacterEvent;
  tickPassByRelationships: (characterActors: ReadonlyMap<string, CharacterActor>, timestamp: number) => void;
  pruneEndedActivities: (timestamp: number) => void;
  notifyRequestsChanged: () => void;
}

const INITIAL_DECISION_STAGGER_MIN_MS = 500;
const INITIAL_DECISION_STAGGER_MAX_MS = 4500;
const DECISION_INTERVAL_MIN_MS = 2500;
const DECISION_INTERVAL_MAX_MS = 5500;
const ITEM_VISIBILITY_RADIUS = 10;
const NEARBY_CHARACTER_RANGE = 2;
const TICK_INTERVAL_MS = 1000;

export class TownCharacterTickCoordinator {
  private readonly characterSeeds: readonly CharacterSeed[];
  private readonly requestService: CharacterRequestService;
  private readonly getCharacterSnapshot: TownCharacterTickCoordinatorOptions['getCharacterSnapshot'];
  private readonly isCharacterActive: TownCharacterTickCoordinatorOptions['isCharacterActive'];
  private readonly spawnCharacterActor: TownCharacterTickCoordinatorOptions['spawnCharacterActor'];
  private readonly maybeLeaveApartmentForOutsideNeed: TownCharacterTickCoordinatorOptions['maybeLeaveApartmentForOutsideNeed'];
  private readonly getNearbyCharacterIds: TownCharacterTickCoordinatorOptions['getNearbyCharacterIds'];
  private readonly getNearbyVisibleItems: TownCharacterTickCoordinatorOptions['getNearbyVisibleItems'];
  private readonly getNearbyRelationships: TownCharacterTickCoordinatorOptions['getNearbyRelationships'];
  private readonly getNearbyJoinableActivities: TownCharacterTickCoordinatorOptions['getNearbyJoinableActivities'];
  private readonly getAvailableActorItemDefinitionIds: TownCharacterTickCoordinatorOptions['getAvailableActorItemDefinitionIds'];
  private readonly getRelationshipTargets: TownCharacterTickCoordinatorOptions['getRelationshipTargets'];
  private readonly getCharacterActors: TownCharacterTickCoordinatorOptions['getCharacterActors'];
  private readonly sendToCharacter: SendCharacterEvent;
  private readonly tickPassByRelationships: TownCharacterTickCoordinatorOptions['tickPassByRelationships'];
  private readonly pruneEndedActivities: TownCharacterTickCoordinatorOptions['pruneEndedActivities'];
  private readonly notifyRequestsChanged: TownCharacterTickCoordinatorOptions['notifyRequestsChanged'];
  private readonly nextDecisionAtByCharacterId = new Map<string, number>();
  private tickTimer: number | null = null;

  constructor(options: TownCharacterTickCoordinatorOptions) {
    this.characterSeeds = options.characterSeeds ?? getSeedPlayableCharacters();
    this.requestService = options.requestService;
    this.getCharacterSnapshot = options.getCharacterSnapshot;
    this.isCharacterActive = options.isCharacterActive;
    this.spawnCharacterActor = options.spawnCharacterActor;
    this.maybeLeaveApartmentForOutsideNeed = options.maybeLeaveApartmentForOutsideNeed;
    this.getNearbyCharacterIds = options.getNearbyCharacterIds;
    this.getNearbyVisibleItems = options.getNearbyVisibleItems;
    this.getNearbyRelationships = options.getNearbyRelationships;
    this.getNearbyJoinableActivities = options.getNearbyJoinableActivities;
    this.getAvailableActorItemDefinitionIds = options.getAvailableActorItemDefinitionIds;
    this.getRelationshipTargets = options.getRelationshipTargets;
    this.getCharacterActors = options.getCharacterActors;
    this.sendToCharacter = options.sendToCharacter;
    this.tickPassByRelationships = options.tickPassByRelationships;
    this.pruneEndedActivities = options.pruneEndedActivities;
    this.notifyRequestsChanged = options.notifyRequestsChanged;
  }

  start(): void {
    const timestamp = Date.now();

    this.characterSeeds.forEach(character => {
      this.spawnCharacterIfNeeded(character, timestamp);
    });
    this.stop();
    this.tickTimer = window.setInterval(() => {
      this.tick();
    }, TICK_INTERVAL_MS);
  }

  stop(): void {
    if (this.tickTimer === null) {
      return;
    }

    window.clearInterval(this.tickTimer);
    this.tickTimer = null;
  }

  clear(): void {
    this.stop();
    this.nextDecisionAtByCharacterId.clear();
  }

  deferCharacterDecision(characterId: string, durationMs: number): void {
    this.nextDecisionAtByCharacterId.set(characterId, Date.now() + durationMs);
  }

  deferCharactersDecision(characterIds: readonly string[], durationMs: number): void {
    const nextDecisionAt = Date.now() + durationMs;

    characterIds.forEach(characterId => {
      this.nextDecisionAtByCharacterId.set(characterId, nextDecisionAt);
    });
  }

  private tick(): void {
    const timestamp = Date.now();

    this.characterSeeds.forEach(character => {
      this.spawnCharacterIfNeeded(character, timestamp);
      this.tickCharacter(character.id, timestamp);
    });

    this.tickPassByRelationships(this.getCharacterActors(), timestamp);
    this.pruneEndedActivities(timestamp);
  }

  private spawnCharacterIfNeeded(character: CharacterSeed, timestamp: number): void {
    if (this.isCharacterActive(character.id)) {
      return;
    }

    this.ensureInitialDecisionDelay(character.id, timestamp);
    this.spawnCharacterActor(character);
  }

  private ensureInitialDecisionDelay(characterId: string, timestamp: number): void {
    if (this.nextDecisionAtByCharacterId.has(characterId)) {
      return;
    }

    this.nextDecisionAtByCharacterId.set(characterId, timestamp + randomBetween(
      INITIAL_DECISION_STAGGER_MIN_MS,
      INITIAL_DECISION_STAGGER_MAX_MS,
    ));
  }

  private tickCharacter(characterId: string, timestamp: number): void {
    const snapshot = this.getCharacterSnapshot(characterId);
    const isParticipatingInActivity = Boolean(
      snapshot?.context.currentActivity ||
      snapshot?.context.pendingActivityJoin,
    );

    if (isParticipatingInActivity) {
      this.scheduleNextDecision(characterId, timestamp);
      this.sendToCharacter(characterId, {
        type: EventType.Tick,
        timestamp,
        allowAutonomousDecision: false,
      });
      return;
    }

    const allowAutonomousDecision = this.canCharacterDecideNow(characterId, timestamp);
    const didLeaveApartment = allowAutonomousDecision &&
      this.maybeLeaveApartmentForOutsideNeed(characterId);
    const nearbyCharacterIds = this.getNearbyCharacterIds(characterId, NEARBY_CHARACTER_RANGE);
    const nearbyVisibleItems = this.getNearbyVisibleItems(characterId, ITEM_VISIBILITY_RADIUS);

    this.sendToCharacter(characterId, {
      type: EventType.Tick,
      nearbyCharacterIds,
      nearbyRelationships: this.getNearbyRelationships(characterId, nearbyCharacterIds),
      nearbyJoinableActivities: this.getNearbyJoinableActivities(characterId, timestamp),
      nearbyVisibleItems,
      ownItemIds: this.getAvailableActorItemDefinitionIds(characterId),
      timestamp,
      allowAutonomousDecision: allowAutonomousDecision && !didLeaveApartment,
    });
    this.tickCharacterRequest(characterId, nearbyCharacterIds, timestamp);
  }

  private tickCharacterRequest(
    characterId: string,
    nearbyCharacterIds: readonly string[],
    timestamp: number,
  ): void {
    const snapshot = this.getCharacterSnapshot(characterId);

    if (!snapshot) {
      return;
    }

    const result = this.requestService.tickCharacter({
      context: snapshot.context,
      nearbyCharacterIds: [...nearbyCharacterIds],
      nearbyRelationships: this.getNearbyRelationships(characterId, nearbyCharacterIds),
      relationshipTargets: this.getRelationshipTargets(characterId),
      nearbyJoinableActivities: this.getNearbyJoinableActivities(characterId, timestamp),
      timestamp,
    });

    if (result.didChange) {
      this.notifyRequestsChanged();
    }
  }

  private canCharacterDecideNow(characterId: string, timestamp: number): boolean {
    const nextDecisionAt = this.nextDecisionAtByCharacterId.get(characterId) ?? timestamp;

    if (timestamp < nextDecisionAt) {
      return false;
    }

    this.scheduleNextDecision(characterId, timestamp);
    return true;
  }

  private scheduleNextDecision(characterId: string, timestamp: number): void {
    this.nextDecisionAtByCharacterId.set(characterId, timestamp + randomBetween(
      DECISION_INTERVAL_MIN_MS,
      DECISION_INTERVAL_MAX_MS,
    ));
  }
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
