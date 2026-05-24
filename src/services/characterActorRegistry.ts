import { createActor } from 'xstate';
import { characterMachine } from '~/stateMachines/gameFlow/children/character';
import type { CharacterMachineInput } from '~/stateMachines/gameFlow/context';
import type { CharacterEvent } from '~/stateMachines/gameFlow/events';
import type {
  CharacterActor,
  CharacterSeed,
  CharacterSnapshot,
} from '~/services/townCharacterTypes';

type Subscription = {
  unsubscribe: () => void;
};

interface CharacterActorRegistryOptions {
  onSnapshot: (characterId: string, snapshot: CharacterSnapshot) => void;
}

export class CharacterActorRegistry {
  private readonly actors = new Map<string, CharacterActor>();
  private readonly subscriptions = new Map<string, Subscription>();
  private readonly onSnapshot: (characterId: string, snapshot: CharacterSnapshot) => void;

  constructor(options: CharacterActorRegistryOptions) {
    this.onSnapshot = options.onSnapshot;
  }

  spawn(character: CharacterSeed, input: CharacterMachineInput): CharacterActor {
    this.stopActor(character.id);

    const actor = createActor(characterMachine, { input });

    this.actors.set(character.id, actor);
    this.subscriptions.set(character.id, actor.subscribe(snapshot => {
      this.onSnapshot(character.id, snapshot);
    }));
    actor.start();

    return actor;
  }

  getActor(characterId: string): CharacterActor | null {
    return this.actors.get(characterId) ?? null;
  }

  getActors(): ReadonlyMap<string, CharacterActor> {
    return this.actors;
  }

  getSnapshot(characterId: string): CharacterSnapshot | null {
    return this.actors.get(characterId)?.getSnapshot() ?? null;
  }

  getSnapshotsById(): Record<string, CharacterSnapshot> {
    return Object.fromEntries(
      Array.from(this.actors.entries())
        .map(([characterId, actor]) => [characterId, actor.getSnapshot()]),
    );
  }

  isActive(characterId: string): boolean {
    return this.actors.get(characterId)?.getSnapshot().status === 'active';
  }

  send(characterId: string, event: CharacterEvent): boolean {
    const actor = this.actors.get(characterId);

    if (!actor || actor.getSnapshot().status !== 'active') {
      return false;
    }

    actor.send(event);
    return true;
  }

  dispose(): void {
    this.subscriptions.forEach(subscription => {
      subscription.unsubscribe();
    });
    this.subscriptions.clear();

    this.actors.forEach(actor => {
      actor.stop();
    });
    this.actors.clear();
  }

  private stopActor(characterId: string): void {
    this.subscriptions.get(characterId)?.unsubscribe();
    this.subscriptions.delete(characterId);

    const actor = this.actors.get(characterId);

    if (actor) {
      actor.stop();
      this.actors.delete(characterId);
    }
  }
}
