import {
  createRelationshipStore,
  updateMutualRelationshipStatus,
  type RelationshipStore,
} from '~/stateMachines/gameFlow/relationships';
import { SocialStatus } from '~/constants/character';

class RelationshipStoreService {
  private relationshipStore: RelationshipStore = createRelationshipStore();

  load(relationshipStore: RelationshipStore): void {
    this.relationshipStore = cloneRelationshipStore(relationshipStore);
  }

  getSnapshot(): RelationshipStore {
    return cloneRelationshipStore(this.relationshipStore);
  }

  toggleDebugRelationship(): RelationshipStore {
    const relationship = this.relationshipStore.mutualRelationships.find(item => (
      item.charIds[0] === 'friend-01' && item.charIds[1] === 'friend-02'
    ));
    const nextStatus = relationship?.status === SocialStatus.Acquaintance
      ? SocialStatus.Stranger
      : SocialStatus.Acquaintance;

    this.relationshipStore = updateMutualRelationshipStatus(
      this.relationshipStore,
      'friend-01',
      'friend-02',
      nextStatus,
      Date.now(),
    );

    return this.getSnapshot();
  }
}

function cloneRelationshipStore(relationshipStore: RelationshipStore): RelationshipStore {
  return {
    mutualRelationships: relationshipStore.mutualRelationships.map(relationship => ({
      ...relationship,
      charIds: [...relationship.charIds],
    })),
    relationshipRecords: relationshipStore.relationshipRecords.map(record => ({
      ...record,
      charIds: [...record.charIds],
      records: record.records.map(entry => ({ ...entry })),
    })),
  };
}

export const relationshipStoreService = new RelationshipStoreService();
