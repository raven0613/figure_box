import { useEffect, useRef, useState } from 'react';
import { createActor, type ActorRefFrom, type SnapshotFrom } from 'xstate';
import {
  characterMachine,
  formatCharacterStateValue,
  getCharacterStateSummary,
} from '~/stateMachines/gameFlow/children/character';
import { FabricTownMapWidget } from '~/widgets/fabricTownMapWidget';
import { EventType } from '~/stateMachines/gameFlow/events';
import type { TownMapTile } from '~/widgets/townMapGrid';

import styles from './townMap.module.scss';

const CHARACTER_SEEDS = [
  {
    id: 'friend-01',
    name: 'Tezuka',
    label: 'T',
    color: '#413636',
    position: { x: 3, y: 5 },
    saturation: 58,
  },
  {
    id: 'friend-02',
    name: 'Fuji',
    label: 'F',
    color: '#e57070',
    position: { x: 5, y: 5 },
    saturation: 32,
  },
] as const;

type CharacterActor = ActorRefFrom<typeof characterMachine>;
type CharacterSnapshot = SnapshotFrom<typeof characterMachine>;

export function TownMapContainer() {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<FabricTownMapWidget | null>(null);
  const characterActorsRef = useRef<Map<string, CharacterActor>>(new Map());
  const walkingCharactersRef = useRef<Set<string>>(new Set());
  const [selectedTile, setSelectedTile] = useState<TownMapTile | null>(null);
  const [nearbyTiles, setNearbyTiles] = useState<TownMapTile[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>(CHARACTER_SEEDS[0].id);
  const [characterSnapshots, setCharacterSnapshots] = useState<Record<string, CharacterSnapshot>>({});

  useEffect(() => {
    if (!canvasHostRef.current) {
      return;
    }

    const canvasHost = canvasHostRef.current;
    const widget = FabricTownMapWidget.mount(canvasHost, {
      cellSize: 48,
      onTileClick: tile => {
        setSelectedTile(tile);
        setNearbyTiles(widget.getNeighbors(tile.x, tile.y, 1));
      },
      onCharacterPickUp: characterId => {
        setSelectedCharacterId(characterId);
        characterActorsRef.current.get(characterId)?.send({ type: EventType.PickUp });
      },
      onCharacterDrop: (characterId, tile) => {
        const actor = characterActorsRef.current.get(characterId);

        if (!actor) {
          return;
        }

        if (tile && widget.moveCharacter(characterId, tile)) {
          actor.send({ type: EventType.Drop, position: tile });
          return;
        }

        actor.send({ type: EventType.Drop });
      },
    });

    widgetRef.current = widget;

    const subscriptions = CHARACTER_SEEDS.map(character => {
      widget.placeCharacter({
        id: character.id,
        x: character.position.x,
        y: character.position.y,
        color: character.color,
        label: character.label,
      });

      const actor = createActor(characterMachine, {
        input: {
          id: character.id,
          name: character.name,
          position: character.position,
          saturation: character.saturation,
        },
      });

      characterActorsRef.current.set(character.id, actor);

      const subscription = actor.subscribe(snapshot => {
        setCharacterSnapshots(current => ({
          ...current,
          [character.id]: snapshot,
        }));

        widget.updateCharacterStatus(character.id, formatCharacterStateValue(snapshot.value));

        const summary = getCharacterStateSummary(snapshot.value);
        const target = snapshot.context.target;

        if (summary.bodyMove !== 'walking' || !target) {
          if (walkingCharactersRef.current.has(character.id)) {
            widget.cancelWalk(character.id);
            walkingCharactersRef.current.delete(character.id);
          }
          return;
        }

        if (walkingCharactersRef.current.has(character.id)) {
          return;
        }

        const currentPos = snapshot.context.position;
        const path = widget.findPath(currentPos, target, character.id);

        if (!path) {
          const blockingTiles = widget.findBlockingTiles(currentPos, target);
          blockingTiles.forEach(tile => {
            console.log('最短距離受到阻擋，阻擋格子為', tile);
          });
          actor.send({ type: EventType.MoveBlocked });
          return;
        }

        if (path.length === 0) {
          actor.send({ type: EventType.Arrive, position: target });
          return;
        }

        walkingCharactersRef.current.add(character.id);

        widget.walkCharacterAlongPath(
          character.id,
          path,
          arrivedPosition => {
            walkingCharactersRef.current.delete(character.id);
            actor.send({ type: EventType.Arrive, position: arrivedPosition });
          },
          blockedPosition => {
            walkingCharactersRef.current.delete(character.id);
            actor.send({ type: EventType.MoveBlocked, position: blockedPosition });
          },
        );
      });

      actor.start();
      return subscription;
    });

    const tickTimer = window.setInterval(() => {
      characterActorsRef.current.forEach(actor => {
        actor.send({ type: EventType.Tick });
      });
    }, 1000);

    return () => {
      window.clearInterval(tickTimer);
      walkingCharactersRef.current.forEach(id => widget.cancelWalk(id));
      walkingCharactersRef.current.clear();
      subscriptions.forEach(subscription => {
        subscription.unsubscribe();
      });
      characterActorsRef.current.forEach(actor => {
        actor.stop();
      });
      characterActorsRef.current.clear();
      widgetRef.current = null;
      void widget.destroy();
      canvasHost.replaceChildren();
    };
  }, []);

  return (
    <section className={styles.container}>
      <div className={styles.mapShell}>
        <div className={styles.canvasHost} ref={canvasHostRef} />
      </div>

      <aside className={styles.panel}>
        <div className={styles.panelTitle}>Town Grid</div>
        <div className={styles.detailRow}>
          <span>Selected</span>
          <strong>{selectedTile ? `${selectedTile.x}, ${selectedTile.y}` : '-'}</strong>
        </div>
        <div className={styles.detailRow}>
          <span>Terrain</span>
          <strong>{selectedTile?.cell.terrain ?? '-'}</strong>
        </div>
        <div className={styles.detailRow}>
          <span>Walkable</span>
          <strong>{selectedTile ? String(selectedTile.cell.walkable) : '-'}</strong>
        </div>
        <div className={styles.detailRow}>
          <span>Occupant</span>
          <strong>{selectedTile?.cell.occupantId ?? '-'}</strong>
        </div>
        <div className={styles.detailRow}>
          <span>Object</span>
          <strong>{selectedTile?.cell.interactableObject?.label ?? '-'}</strong>
        </div>
        <div className={styles.neighborList}>
          {nearbyTiles.map(tile => (
            <span key={tile.index}>
              {tile.x},{tile.y}
            </span>
          ))}
        </div>

        <div className={styles.characterList}>
          {CHARACTER_SEEDS.map(character => {
            const snapshot = characterSnapshots[character.id];
            const summary = snapshot ? getCharacterStateSummary(snapshot.value) : null;
            const isSelected = selectedCharacterId === character.id;

            return (
              <button
                className={`${styles.characterButton} ${isSelected ? styles.characterButtonActive : ''}`}
                key={character.id}
                type="button"
                onClick={() => setSelectedCharacterId(character.id)}
              >
                <span>{character.name}</span>
                <strong>{summary ? summary.bodyAction : '-'}</strong>
              </button>
            );
          })}
        </div>

        {characterSnapshots[selectedCharacterId] ? (
          <CharacterStatusPanel snapshot={characterSnapshots[selectedCharacterId]} />
        ) : null}
      </aside>
    </section>
  );
}

function CharacterStatusPanel({ snapshot }: { snapshot: CharacterSnapshot }) {
  const summary = getCharacterStateSummary(snapshot.value);

  return (
    <div className={styles.characterPanel}>
      <div className={styles.panelTitle}>{snapshot.context.name}</div>
      <div className={styles.detailRow}>
        <span>Body action</span>
        <strong>{summary.bodyAction}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Body move</span>
        <strong>{summary.bodyMove}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Mind</span>
        <strong>{summary.mind}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Comm</span>
        <strong>{summary.communication}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Motivation</span>
        <strong>{snapshot.context.currentMotivation}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Saturation</span>
        <strong>{snapshot.context.status.saturation}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Eat score</span>
        <strong>{snapshot.context.utilityScores.findFood}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Play score</span>
        <strong>{snapshot.context.utilityScores.play}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Rest score</span>
        <strong>{snapshot.context.utilityScores.rest}</strong>
      </div>
    </div>
  );
}
