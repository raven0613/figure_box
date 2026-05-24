import type { JoinableActivity } from '~/services/characterEvents/joinableActivities';
import { itemHoldingService, type ItemHoldingService } from '~/services/items/itemHoldingService';
import { itemService, type ItemService } from '~/services/items/itemService';
import type { CharacterSnapshot, SendCharacterEvent } from '~/services/townCharacterTypes';
import type { CharacterHeldItem } from '~/stateMachines/gameFlow/context';
import { EventType } from '~/stateMachines/gameFlow/events';
import type { ItemDefinition, ItemDefinitionId, ItemInstanceId } from '~/typing/item';
import type { FabricTownMapWidget } from '~/widgets/fabricTownMapWidget';

type HeldItemWidget = Pick<FabricTownMapWidget, 'holdItem' | 'releaseHeldItem'>;

interface ActivityHeldItemRecord {
  itemInstanceId: ItemInstanceId;
}

interface CharacterHeldItemCoordinatorOptions {
  widget: HeldItemWidget;
  getActivityById: (activityId: string) => JoinableActivity | null;
  getCurrentHeldItem: (characterId: string) => CharacterHeldItem | null;
  sendToCharacter: SendCharacterEvent;
  items?: ItemService;
  itemHolding?: ItemHoldingService;
}

export class CharacterHeldItemCoordinator {
  private readonly widget: HeldItemWidget;
  private readonly getActivityById: (activityId: string) => JoinableActivity | null;
  private readonly getCurrentHeldItem: (characterId: string) => CharacterHeldItem | null;
  private readonly sendToCharacter: SendCharacterEvent;
  private readonly items: ItemService;
  private readonly itemHolding: ItemHoldingService;
  private readonly renderedHeldItemInstanceIdByCharacterId = new Map<string, string>();
  private readonly activityHeldItemsByCharacterId = new Map<string, ActivityHeldItemRecord>();

  constructor(options: CharacterHeldItemCoordinatorOptions) {
    this.widget = options.widget;
    this.getActivityById = options.getActivityById;
    this.getCurrentHeldItem = options.getCurrentHeldItem;
    this.sendToCharacter = options.sendToCharacter;
    this.items = options.items ?? itemService;
    this.itemHolding = options.itemHolding ?? itemHoldingService;
  }

  holdStoredItemForCharacter(characterId: string, definitionId: ItemDefinitionId): CharacterHeldItem {
    const itemInstance = this.itemHolding.holdItemForActor({
      actorId: characterId,
      definitionId,
    });

    return {
      itemInstanceId: itemInstance.id,
      definitionId: itemInstance.definitionId,
    };
  }

  restoreHeldItemForCharacter(characterId: string): CharacterHeldItem | null {
    const heldItemInstance = this.itemHolding.restoreHeldItemForActor(characterId);

    if (!heldItemInstance) {
      return null;
    }

    return {
      itemInstanceId: heldItemInstance.id,
      definitionId: heldItemInstance.definitionId,
    };
  }

  syncSnapshot(characterId: string, snapshot: CharacterSnapshot): void {
    if (this.syncActivityHeldItem(characterId, snapshot)) {
      return;
    }

    this.syncCharacterHeldItemWithWidget(characterId, snapshot.context.heldItem);
  }

  showTemporaryHeldItem(characterId: string, itemDefinition: ItemDefinition): void {
    this.widget.holdItem(characterId, itemDefinition);
  }

  releaseTemporaryHeldItem(characterId: string): void {
    this.widget.releaseHeldItem(characterId);
    this.syncCharacterHeldItemWithWidget(characterId, this.getCurrentHeldItem(characterId), true);
  }

  clear(): void {
    this.itemHolding.clear();
    this.renderedHeldItemInstanceIdByCharacterId.clear();
    this.activityHeldItemsByCharacterId.clear();
  }

  private syncCharacterHeldItemWithWidget(
    characterId: string,
    heldItem: CharacterHeldItem | null,
    force = false,
  ): void {
    const renderedHeldItemInstanceId = this.renderedHeldItemInstanceIdByCharacterId.get(characterId);

    if (!heldItem) {
      if (renderedHeldItemInstanceId || force) {
        this.renderedHeldItemInstanceIdByCharacterId.delete(characterId);
        this.widget.releaseHeldItem(characterId);
      }
      return;
    }

    if (!force && renderedHeldItemInstanceId === heldItem.itemInstanceId) {
      return;
    }

    const itemDefinition = this.items.getDefinition(heldItem.definitionId);

    if (!itemDefinition) {
      return;
    }

    this.widget.holdItem(characterId, itemDefinition);
    this.renderedHeldItemInstanceIdByCharacterId.set(characterId, heldItem.itemInstanceId);
  }

  private syncActivityHeldItem(characterId: string, snapshot: CharacterSnapshot): boolean {
    const requiredItemId = this.getRequiredActivityItemId(snapshot);
    const activityHeldItem = this.activityHeldItemsByCharacterId.get(characterId);

    if (!requiredItemId) {
      if (!activityHeldItem) {
        return false;
      }

      this.activityHeldItemsByCharacterId.delete(characterId);

      if (snapshot.context.heldItem?.itemInstanceId !== activityHeldItem.itemInstanceId) {
        return false;
      }

      this.releaseHeldItemForCharacter(characterId);
      return true;
    }

    if (snapshot.context.heldItem?.definitionId === requiredItemId) {
      return false;
    }

    const heldItem = this.holdItemForCharacter(characterId, requiredItemId, true);

    if (!heldItem) {
      return false;
    }

    this.activityHeldItemsByCharacterId.set(characterId, {
      itemInstanceId: heldItem.itemInstanceId,
    });
    return true;
  }

  private getRequiredActivityItemId(snapshot: CharacterSnapshot): ItemDefinitionId | null {
    const activityId = snapshot.context.currentActivity?.activityId;

    if (!activityId) {
      return null;
    }

    const activity = this.getActivityById(activityId);

    if (
      !activity ||
      activity.type !== 'playWithItem' ||
      activity.joinRequirements.type !== 'hasItem'
    ) {
      return null;
    }

    return activity.joinRequirements.itemId;
  }

  private holdItemForCharacter(
    characterId: string,
    definitionId: ItemDefinitionId,
    shouldNotifyCharacter: boolean,
  ): CharacterHeldItem | null {
    try {
      const itemInstance = this.itemHolding.holdItemForActor({
        actorId: characterId,
        definitionId,
      });
      const heldItem = {
        itemInstanceId: itemInstance.id,
        definitionId: itemInstance.definitionId,
      };

      if (shouldNotifyCharacter) {
        this.sendToCharacter(characterId, {
          type: EventType.HoldItem,
          itemInstanceId: heldItem.itemInstanceId,
          definitionId: heldItem.definitionId,
        });
        this.syncCharacterHeldItemWithWidget(characterId, heldItem, true);
      }

      return heldItem;
    } catch {
      return null;
    }
  }

  private releaseHeldItemForCharacter(characterId: string): void {
    this.itemHolding.releaseHeldItemForActor(characterId);
    this.sendToCharacter(characterId, { type: EventType.ReleaseHeldItem });
    this.syncCharacterHeldItemWithWidget(characterId, null, true);
  }
}
