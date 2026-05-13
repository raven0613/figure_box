import { useEffect, useRef, useState } from 'react';
import { createActor, ActorRefFrom, SnapshotFrom } from 'xstate';
import { gameFlowMachine } from '~/stateMachines/gameFlow';
import {
  characterMachine,
  getCharacterStateSummary,
} from '~/stateMachines/gameFlow/children/character';
import {
  dialogueManagerMachine,
} from '~/stateMachines/gameFlow/children/dialogue';
import {
  createRelationshipStore,
  normalizeRelationshipPair,
  recordPassByPair,
  RelationshipStore,
} from '~/stateMachines/gameFlow/relationships';
import { FabricTownMapWidget } from '~/widgets/fabricTownMapWidget';
import { EventType } from '~/stateMachines/gameFlow/events';
import type { CharacterEvent, DialogueManagerEmittedEvent } from '~/stateMachines/gameFlow/events';
import { MemoryType, SocialStatus } from '~/constants/character';
import type { TownMapTile, GridCoordinate } from '~/widgets/townMapGrid';
import { DESTINATION_MAP } from '~/constants/townMap';

import styles from './townMap.module.scss';
import { INVITATION_DIALOGUE } from '~/constants/dialogue';

const CHARACTER_SEEDS = [
  {
    id: 'friend-01',
    name: 'Tezuka',
    label: 'T',
    color: '#413636',
    position: { x: 10, y: 16 },
    saturation: 58,
  },
  {
    id: 'friend-02',
    name: 'Fuji',
    label: 'F',
    color: '#e57070',
    position: { x: 16, y: 16 },
    saturation: 32,
  },
  {
    id: 'friend-03',
    name: 'Eiji',
    label: 'E',
    color: '#ff9900',
    position: { x: 7, y: 1 },
    saturation: 80,
  },
  {
    id: 'friend-04',
    name: 'Oishi',
    label: 'O',
    color: '#33cc33',
    position: { x: 10, y: 1 },
    saturation: 60,
  },
  {
    id: 'friend-05',
    name: 'Kikumaru',
    label: 'K',
    color: '#ff3333',
    position: { x: 16, y: 1 },
    saturation: 90,
  },
  {
    id: 'friend-06',
    name: 'Inui',
    label: 'I',
    color: '#333399',
    position: { x: 19, y: 1 },
    saturation: 50,
  },
  {
    id: 'friend-07',
    name: 'Kawamura',
    label: 'Ka',
    color: '#996633',
    position: { x: 4, y: 4 },
    saturation: 75,
  },
  {
    id: 'friend-08',
    name: 'Momoshiro',
    label: 'M',
    color: '#ff66cc',
    position: { x: 7, y: 4 },
    saturation: 85,
  },
  {
    id: 'friend-09',
    name: 'Kaidoh',
    label: 'Kd',
    color: '#339933',
    position: { x: 10, y: 4 },
    saturation: 65,
  },
  {
    id: 'friend-10',
    name: 'Atobe',
    label: 'A',
    color: '#cc99ff',
    position: { x: 16, y: 4 },
    saturation: 95,
  },
  {
    id: 'friend-11',
    name: 'Oshitari',
    label: 'Os',
    color: '#0066cc',
    position: { x: 1, y: 7 },
    saturation: 55,
  },
  {
    id: 'friend-12',
    name: 'Mukahi',
    label: 'Mu',
    color: '#ff0066',
    position: { x: 4, y: 7 },
    saturation: 70,
  },
  {
    id: 'friend-13',
    name: 'Shishido',
    label: 'S',
    color: '#ffcc00',
    position: { x: 10, y: 7 },
    saturation: 65,
  },
  {
    id: 'friend-14',
    name: 'Akutagawa',
    label: 'Ak',
    color: '#ff99cc',
    position: { x: 16, y: 7 },
    saturation: 80,
  },
  {
    id: 'friend-15',
    name: 'Jiro',
    label: 'J',
    color: '#ffcc99',
    position: { x: 19, y: 7 },
    saturation: 85,
  },
  {
    id: 'friend-16',
    name: 'Niou',
    label: 'N',
    color: '#99ccff',
    position: { x: 22, y: 7 },
    saturation: 45,
  },
  {
    id: 'friend-17',
    name: 'Yagyu',
    label: 'Y',
    color: '#cc6699',
    position: { x: 25, y: 7 },
    saturation: 40,
  },
  {
    id: 'friend-18',
    name: 'Marui',
    label: 'Ma',
    color: '#ff3399',
    position: { x: 28, y: 7 },
    saturation: 90,
  },
  {
    id: 'friend-19',
    name: 'Sanada',
    label: 'Sa',
    color: '#333333',
    position: { x: 1, y: 10 },
    saturation: 60,
  },
  {
    id: 'friend-20',
    name: 'Yukimura',
    label: 'Yu',
    color: '#6699ff',
    position: { x: 10, y: 10 },
    saturation: 80,
  },
  {
    id: 'friend-21',
    name: 'Kirihara',
    label: 'Ki',
    color: '#660000',
    position: { x: 16, y: 10 },
    saturation: 75,
  },
  {
    id: 'friend-22',
    name: 'Ryoma',
    label: 'R',
    color: '#cc0000',
    position: { x: 28, y: 10 },
    saturation: 100,
  },
] as const;

type CharacterActor = ActorRefFrom<typeof characterMachine>;
type CharacterSnapshot = SnapshotFrom<typeof characterMachine>;
type GameFlowActor = ActorRefFrom<typeof gameFlowMachine>;
type DialogueActor = ActorRefFrom<typeof dialogueManagerMachine>;
type DialogueSnapshot = SnapshotFrom<typeof dialogueManagerMachine>;
type CharacterSubscription = {
  unsubscribe: () => void;
};

export function TownMapContainer() {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<FabricTownMapWidget | null>(null);
  const characterActorsRef = useRef<Map<string, CharacterActor>>(new Map());
  const gameFlowActorRef = useRef<GameFlowActor | null>(null);
  const dialogueActorRef = useRef<DialogueActor | null>(null);
  const [relationshipStore, setRelationshipStore] = useState<RelationshipStore>(createRelationshipStore);
  const walkingCharactersRef = useRef<Set<string>>(new Set());
  const [selectedTile, setSelectedTile] = useState<TownMapTile | null>(null);
  // const [nearbyTiles, setNearbyTiles] = useState<TownMapTile[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>(CHARACTER_SEEDS[0].id);
  const [characterSnapshots, setCharacterSnapshots] = useState<Record<string, CharacterSnapshot>>({});
  const [dialogueSnapshot, setDialogueSnapshot] = useState<DialogueSnapshot | null>(null);

  // TODO: 把角色相關的狀態移出去，react只負責渲染
  useEffect(() => {
    if (!canvasHostRef.current) {
      return;
    }

    const canvasHost = canvasHostRef.current;
    const characterSubscriptions = new Map<string, CharacterSubscription>();
    const widget = FabricTownMapWidget.mount(canvasHost, {
      cellSize: 20,
      onTileClick: tile => {
        setSelectedTile(tile);
        // setNearbyTiles(widget.getNeighbors(tile.x, tile.y, 1));
      },
      onCharacterPickUp: characterId => {
        if (isCharacterBodyFrozen(characterActorsRef.current.get(characterId))) {
          widget.showCharacterBubble(characterId, '對話中...');
          return;
        }

        setSelectedCharacterId(characterId);
        sendToCharacter(characterActorsRef.current, characterId, { type: EventType.PickUp });
      },
      onCharacterDrop: (characterId, tile) => {
        const actor = characterActorsRef.current.get(characterId);

        if (!actor) {
          return;
        }

        if (isCharacterBodyFrozen(actor)) {
          widget.showCharacterBubble(characterId, '等一下...');
          return;
        }

        if (tile && widget.moveCharacter(characterId, tile)) {
          sendToCharacter(characterActorsRef.current, characterId, { type: EventType.Drop, position: tile });
          return;
        }

        sendToCharacter(characterActorsRef.current, characterId, { type: EventType.Drop });
      },
    });

    widgetRef.current = widget;

    const spawnCharacterActor = (character: typeof CHARACTER_SEEDS[number], previousActor?: CharacterActor) => {
      characterSubscriptions.get(character.id)?.unsubscribe();

      const previousContext = previousActor?.getSnapshot().context;

      widget.placeCharacter({
        id: character.id,
        x: previousContext?.position.x ?? character.position.x,
        y: previousContext?.position.y ?? character.position.y,
        color: character.color,
        label: character.label,
      });

      const actor = createActor(characterMachine, {
        input: {
          id: character.id,
          name: character.name,
          position: previousContext?.position ?? character.position,
          saturation: previousContext?.status.saturation ?? character.saturation,
          relationships: previousContext?.relationships,
        },
      });

      characterActorsRef.current.set(character.id, actor);

      const subscription = actor.subscribe(snapshot => {
        setCharacterSnapshots(current => ({
          ...current,
          [character.id]: snapshot,
        }));

        widget.updateCharacterStatus(character.id, snapshot.context.currentMotivation);

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
          // const blockingTiles = widget.findBlockingTiles(currentPos, target);
          // blockingTiles.forEach(tile => {
          //   console.log('最短距離受到阻擋，阻擋格子為', tile);
          // });
          sendToCharacter(characterActorsRef.current, character.id, { type: EventType.MoveBlocked });
          return;
        }

        if (path.length === 0) {
          sendToCharacter(characterActorsRef.current, character.id, { type: EventType.Arrive, position: target });
          return;
        }

        walkingCharactersRef.current.add(character.id);

        widget.walkCharacterAlongPath(
          character.id,
          path,
          arrivedPosition => {
            walkingCharactersRef.current.delete(character.id);
            const currentActor = characterActorsRef.current.get(character.id);
            const motivation = currentActor?.getSnapshot().context.currentMotivation ?? '';

            sendToCharacter(characterActorsRef.current, character.id, { type: EventType.Arrive, position: arrivedPosition });

            if (DESTINATION_MAP[motivation]) {
              const dispersalTarget = findNearbyEmptyTile(widget, arrivedPosition, character.id, 4); // 4格內附近
              if (dispersalTarget) {
                sendToCharacter(characterActorsRef.current, character.id, { type: EventType.MoveTo, target: dispersalTarget });
              }
            }
          },
          blockedPosition => {
            walkingCharactersRef.current.delete(character.id);
            sendToCharacter(characterActorsRef.current, character.id, { type: EventType.MoveBlocked, position: blockedPosition });
          },
        );
      });

      actor.start();
      const characterSubscription = {
        unsubscribe: () => {
          subscription.unsubscribe();
        },
      };

      characterSubscriptions.set(character.id, characterSubscription);
      return actor;
    };

    CHARACTER_SEEDS.forEach(character => {
      spawnCharacterActor(character);
    });

    const gameFlowActor = createActor(gameFlowMachine);
    gameFlowActorRef.current = gameFlowActor;
    gameFlowActor.start();

    const dialogueActor = gameFlowActor.getSnapshot().children.dialogueManager as DialogueActor | undefined;

    if (!dialogueActor) {
      throw new Error('Dialogue manager actor was not created by gameFlowMachine.');
    }

    dialogueActorRef.current = dialogueActor;

    const dialogueSubscription = dialogueActor.subscribe(snapshot => {
      setDialogueSnapshot(snapshot);
    });

    const emittedSubscription = dialogueActor.on('*', event => {
      handleDialogueEmission(
        event as DialogueManagerEmittedEvent,
        characterActorsRef.current,
        widget,
      );
    });
    const tickTimer = window.setInterval(() => {
      const timestamp = Date.now();

      CHARACTER_SEEDS.forEach(character => {
        const actor = characterActorsRef.current.get(character.id);

        if (!actor || actor.getSnapshot().status !== 'active') {
          spawnCharacterActor(character, actor);
        }

        sendToCharacter(characterActorsRef.current, character.id, { type: EventType.Tick });
      });

      setRelationshipStore(current => triggerPassByRelationships(
        widget,
        characterActorsRef.current,
        current,
        timestamp,
      ));
    }, 1000);

    return () => {
      window.clearInterval(tickTimer);
      walkingCharactersRef.current.forEach(id => widget.cancelWalk(id));
      walkingCharactersRef.current.clear();
      characterSubscriptions.forEach(subscription => {
        subscription.unsubscribe();
      });
      characterSubscriptions.clear();
      dialogueSubscription.unsubscribe();
      emittedSubscription.unsubscribe();
      gameFlowActor.stop();
      gameFlowActorRef.current = null;
      dialogueActorRef.current = null;
      characterActorsRef.current.forEach(actor => {
        actor.stop();
      });
      characterActorsRef.current.clear();
      setRelationshipStore(createRelationshipStore);
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
        <div className={styles.info}>
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
          {/* <div className={styles.neighborList}>
          {nearbyTiles.map(tile => (
            <span key={tile.index}>
              {tile.x},{tile.y}
            </span>
          ))}
        </div> */}

          <div className={styles.characterList}>
            <button
              className={styles.dialogueButton}
              type="button"
              onClick={() => {
                gameFlowActorRef.current?.send({
                  type: 'START_DIALOGUE',
                  script: INVITATION_DIALOGUE,
                  participants: [
                    {
                      id: CHARACTER_SEEDS[0].id,
                      role: 'initiator',
                      name: CHARACTER_SEEDS[0].name,
                    },
                    {
                      id: CHARACTER_SEEDS[1].id,
                      role: 'target',
                      name: CHARACTER_SEEDS[1].name,
                    },
                  ],
                });
              }}
            >
              Start Invite
            </button>

            {dialogueSnapshot?.context.activeChoice ? (
              <div className={styles.choicePanel}>
                <strong>{dialogueSnapshot.context.activeChoice.text}</strong>
                {dialogueSnapshot.context.activeChoice.choices.map(choice => (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => {
                      gameFlowActorRef.current?.send({
                        type: 'RESOLVE',
                        choiceId: choice.id,
                      });
                    }}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
            ) : null}

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
        </div>

        {characterSnapshots[selectedCharacterId] ? (
          <CharacterStatusPanel
            snapshot={characterSnapshots[selectedCharacterId]}
            allSnapshots={characterSnapshots}
            relationshipStore={relationshipStore}
          />
        ) : null}
      </aside>
    </section>
  );
}

function handleDialogueEmission(
  event: DialogueManagerEmittedEvent,
  characterActors: Map<string, CharacterActor>,
  widget: FabricTownMapWidget,
): void {
  switch (event.type) {
    case 'DIALOGUE_CHARACTER_EVENT':
      sendToCharacter(characterActors, event.characterId, event.event);
      return;
    case 'DIALOGUE_LINE':
      widget.showCharacterBubble(event.speakerId, event.text, 1800);
      return;
    case 'DIALOGUE_CHOICE_REQUESTED':
      if (event.choice.text) {
        event.participantIds.forEach(characterId => {
          widget.showCharacterBubble(characterId, event.choice.text ?? '', 4200);
        });
      }
      return;
    case 'DIALOGUE_CHOICE_RESOLVED':
    case 'DIALOGUE_ENDED':
      return;
  }
}

function isCharacterBodyFrozen(actor: CharacterActor | undefined): boolean {
  if (actor?.getSnapshot().status !== 'active') return false;
  const locks = actor.getSnapshot().context.locks;
  return locks.bodyAction.length > 0 || locks.bodyMove.length > 0;
}

function sendToCharacter(
  characterActors: Map<string, CharacterActor>,
  characterId: string,
  event: CharacterEvent,
): boolean {
  const actor = characterActors.get(characterId);

  if (!actor || actor.getSnapshot().status !== 'active') {
    return false;
  }

  actor.send(event);
  return true;
}

function CharacterStatusPanel({ snapshot, allSnapshots, relationshipStore }: {
  snapshot: CharacterSnapshot;
  allSnapshots: Record<string, CharacterSnapshot>;
  relationshipStore: RelationshipStore;
}) {
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
      {snapshot.context.relationships.map(relationship => {
        const targetName = allSnapshots[relationship.targetCharId]?.context.name ?? relationship.targetCharId;
        const pair = normalizeRelationshipPair(snapshot.context.id, relationship.targetCharId);
        const mutualStatus = pair
          ? relationshipStore.mutualRelationships.find(
            m => m.charIds[0] === pair[0] && m.charIds[1] === pair[1],
          )?.status ?? SocialStatus.Stranger
          : SocialStatus.Stranger;

        return (
          <div className={styles.relationshipRow} key={relationship.targetCharId}>
            <div className={styles.detailRow}>
              <span>{targetName}</span>
            </div>
            <div className={styles.detailRow}>
              <span>Feeling</span>
              <strong>{relationship.feeling}</strong>
            </div>
            <div className={styles.detailRow}>
              <span>Relationship</span>
              <strong>{mutualStatus}</strong>
            </div>
            <div className={styles.detailRow}>
              <span>Impression</span>
              <strong>{relationship.memories[MemoryType.Impression].counts}</strong>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function triggerPassByRelationships(
  widget: FabricTownMapWidget,
  characterActors: Map<string, CharacterActor>,
  relationshipStore: RelationshipStore,
  timestamp: number,
): RelationshipStore {
  let nextRelationshipStore = relationshipStore;
  const processedPairs = new Set<string>();

  characterActors.forEach((_actor, characterId) => {
    const tile = widget.getCharacterTile(characterId);

    if (!tile) {
      return;
    }

    const nearbyIds = widget.getOccupiedNeighborIds(tile.x, tile.y, 2, characterId);

    nearbyIds.forEach(targetCharId => {
      const pairKey = characterId < targetCharId
        ? `${characterId}::${targetCharId}`
        : `${targetCharId}::${characterId}`;

      if (processedPairs.has(pairKey)) {
        return;
      }

      processedPairs.add(pairKey);

      sendToCharacter(characterActors, characterId, { type: EventType.PassBy, targetCharId, timestamp });
      sendToCharacter(characterActors, targetCharId, { type: EventType.PassBy, targetCharId: characterId, timestamp });

      nextRelationshipStore = recordPassByPair(
        nextRelationshipStore,
        characterId,
        targetCharId,
        timestamp,
      );
    });
  });

  return nextRelationshipStore;
}

function findNearbyEmptyTile(
  widget: FabricTownMapWidget,
  position: GridCoordinate,
  occupantId: string,
  range: number
): GridCoordinate | null {
  const neighbors = widget.getNeighbors(position.x, position.y, range);
  const candidates = neighbors.filter(tile =>
    tile.cell.walkable && (!tile.cell.occupantId || tile.cell.occupantId === occupantId)
  );

  if (candidates.length === 0) {
    return null;
  }

  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
  return { x: chosen.x, y: chosen.y };
}
