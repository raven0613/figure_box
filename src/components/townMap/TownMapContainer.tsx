import { useEffect, useRef, useState } from 'react';
import {
  getCharacterStateSummary,
} from '~/stateMachines/gameFlow/children/character';
import {
  createRelationshipStore,
  normalizeRelationshipPair,
  type RelationshipStore,
} from '~/stateMachines/gameFlow/relationships';
import {
  TownCharacterController,
  type CharacterSnapshot,
  type DialogueSnapshot,
} from '~/services/townCharacterController';
import { FabricTownMapWidget } from '~/widgets/fabricTownMapWidget';
import { CHARACTER_SEEDS, MemoryType, SocialStatus } from '~/constants/character';
import type { TownMapTile } from '~/widgets/townMapGrid';

import styles from './townMap.module.scss';

export function TownMapContainer() {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const characterControllerRef = useRef<TownCharacterController | null>(null);
  const [relationshipStore, setRelationshipStore] = useState<RelationshipStore>(createRelationshipStore);
  const [selectedTile, setSelectedTile] = useState<TownMapTile | null>(null);
  const [selectedMapObjects, setSelectedMapObjects] = useState<string[]>([]);
  // const [nearbyTiles, setNearbyTiles] = useState<TownMapTile[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>(CHARACTER_SEEDS[0].id);
  const [characterSnapshots, setCharacterSnapshots] = useState<Record<string, CharacterSnapshot>>({});
  const [dialogueSnapshot, setDialogueSnapshot] = useState<DialogueSnapshot | null>(null);

  useEffect(() => {
    if (!canvasHostRef.current) {
      return;
    }

    const canvasHost = canvasHostRef.current;
    const widget = FabricTownMapWidget.mount(canvasHost, {
      cellSize: 10,
      onTileClick: tile => {
        setSelectedTile(tile);
        setSelectedMapObjects(widget.getMapObjectsAt(tile.x, tile.y).map(object => object.label));
        // setNearbyTiles(widget.getNeighbors(tile.x, tile.y, 1));
      },
      onCharacterPickUp: characterId => {
        setSelectedCharacterId(characterId);
        characterControllerRef.current?.pickUpCharacter(characterId);
      },
      onCharacterDrop: (characterId, tile) => {
        characterControllerRef.current?.dropCharacter(characterId, tile);
      },
    });

    const characterController = new TownCharacterController({
      widget,
      onCharacterSnapshot: (characterId, snapshot) => {
        setCharacterSnapshots(current => ({
          ...current,
          [characterId]: snapshot,
        }));
      },
      onRelationshipStoreChange: setRelationshipStore,
      onDialogueSnapshot: setDialogueSnapshot,
    });

    characterControllerRef.current = characterController;
    characterController.start();

    return () => {
      characterController.dispose();
      characterControllerRef.current = null;
      setCharacterSnapshots({});
      setDialogueSnapshot(null);
      setSelectedMapObjects([]);
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
            <strong>{selectedMapObjects.length > 0 ? selectedMapObjects.join(', ') : '-'}</strong>
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
                characterControllerRef.current?.startInvitationDialogue();
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
                      characterControllerRef.current?.resolveDialogueChoice(choice.id);
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
