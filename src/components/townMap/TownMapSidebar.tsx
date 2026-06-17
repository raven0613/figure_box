import {
  getCharacterStateSummary,
} from '~/stateMachines/gameFlow/children/character';
import type { RelationshipStore } from '~/stateMachines/gameFlow/relationships';
import type { CharacterSnapshot } from '~/services/townCharacterController';
import type { CharacterSeed } from '~/services/townCharacterTypes';
import type { GodDropOpportunity } from '~/services/godDropOpportunityService';
import type { JoinableActivity } from '~/services/characterEvents/joinableActivities';
import type { TownMapTile } from '~/widgets/townMapGrid';
import {
  ActivityDebugPanel,
  CharacterStatusPanel,
  DebugWindowActions,
  GodDropOpportunityPanel,
} from './TownMapDebugPanels';

import styles from './townMap.module.scss';

interface TownMapSidebarProps {
  allSnapshots: Record<string, CharacterSnapshot>;
  godDropOpportunity: GodDropOpportunity | null;
  isExpressionBubblePreviewOpen: boolean;
  isInventoryPanelOpen: boolean;
  isRequestPanelOpen: boolean;
  joinableActivities: readonly JoinableActivity[];
  playableCharacters: readonly CharacterSeed[];
  relationshipStore: RelationshipStore;
  selectedCharacterId: string;
  selectedMapObjects: readonly string[];
  selectedOccupantIds: readonly string[];
  selectedTile: TownMapTile | null;
  onOpenCharacterInventory: (characterId: string, characterName: string) => void;
  onOpenExpressionBubblePreview: () => void;
  onOpenInventory: () => void;
  onOpenRequests: () => void;
  onSelectCharacter: (characterId: string) => void;
  onSelectGodDropCandidate: (candidateId: string) => void;
}

export function TownMapSidebar({
  allSnapshots,
  godDropOpportunity,
  isExpressionBubblePreviewOpen,
  isInventoryPanelOpen,
  isRequestPanelOpen,
  joinableActivities,
  playableCharacters,
  relationshipStore,
  selectedCharacterId,
  selectedMapObjects,
  selectedOccupantIds,
  selectedTile,
  onOpenCharacterInventory,
  onOpenExpressionBubblePreview,
  onOpenInventory,
  onOpenRequests,
  onSelectCharacter,
  onSelectGodDropCandidate,
}: TownMapSidebarProps) {
  const selectedCharacterSnapshot = allSnapshots[selectedCharacterId];

  return (
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
          <strong>{selectedOccupantIds.length > 0 ? selectedOccupantIds.join(', ') : '-'}</strong>
        </div>
        <div className={styles.detailRow}>
          <span>Object</span>
          <strong>{selectedMapObjects.length > 0 ? selectedMapObjects.join(', ') : '-'}</strong>
        </div>

        <div className={styles.characterList}>
          {playableCharacters.map(character => {
            const snapshot = allSnapshots[character.id];
            const summary = snapshot ? getCharacterStateSummary(snapshot.value) : null;
            const isSelected = selectedCharacterId === character.id;

            return (
              <div className={styles.characterRow} key={character.id}>
                <button
                  className={`${styles.characterButton} ${isSelected ? styles.characterButtonActive : ''}`}
                  type="button"
                  onClick={() => onSelectCharacter(character.id)}
                >
                  <span className={styles.characterButtonName}>{character.name}</span>
                  <strong>{summary ? summary.bodyAction : '-'}</strong>
                </button>
                <button
                  className={styles.characterInventoryButton}
                  type="button"
                  onClick={() => onOpenCharacterInventory(character.id, character.name)}
                  aria-label={`打開${character.name}的物品欄`}
                >
                  物
                </button>
              </div>
            );
          })}
        </div>

        <ActivityDebugPanel activities={joinableActivities} allSnapshots={allSnapshots} />
        <DebugWindowActions
          isInventoryPanelOpen={isInventoryPanelOpen}
          isRequestPanelOpen={isRequestPanelOpen}
          isExpressionBubblePreviewOpen={isExpressionBubblePreviewOpen}
          onOpenInventory={onOpenInventory}
          onOpenRequests={onOpenRequests}
          onOpenExpressionBubblePreview={onOpenExpressionBubblePreview}
        />
        <GodDropOpportunityPanel
          opportunity={godDropOpportunity}
          onSelectCandidate={onSelectGodDropCandidate}
        />
      </div>

      {selectedCharacterSnapshot ? (
        <CharacterStatusPanel
          snapshot={selectedCharacterSnapshot}
          allSnapshots={allSnapshots}
          activities={joinableActivities}
          relationshipStore={relationshipStore}
        />
      ) : null}
    </aside>
  );
}
