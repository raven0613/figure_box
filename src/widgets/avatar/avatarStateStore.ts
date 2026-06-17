import { getAccessoryCategoryDefinition } from './avatarAccessoryDefinitions';
import {
  createDefaultAccessoryInstance,
  getAccessoryPoseState,
} from './avatarAccessoryState';
import {
  getNextAccessoryOrder,
  normalizeAccessoryOrders,
  normalizeAvatarState,
} from './avatarState';
import type {
  AccessoryCategory,
  AccessoryLayerSlot,
  AccessoryPoseKey,
  AvatarAccessoryInstance,
  AvatarAccessoryPoseState,
  AvatarPartKey,
  AvatarPartState,
  AvatarState,
} from './avatarTypes';

export class AvatarStateStore {
  private state: AvatarState;

  constructor(initialState?: Partial<AvatarState>) {
    this.state = this.mergeInitialState(initialState);
  }

  getSnapshot(): AvatarState {
    return structuredClone(this.state);
  }

  replaceState(nextState?: Partial<AvatarState>): void {
    this.state = this.mergeInitialState(nextState);
  }

  getPartState(key: AvatarPartKey): AvatarPartState {
    return { ...this.state[key] };
  }

  getAccessories(): AvatarAccessoryInstance[] {
    return this.state.accessories.map(accessory => ({ ...accessory }));
  }

  getAccessoryState(instanceId: string): AvatarAccessoryInstance | null {
    const accessory = this.state.accessories.find(item => item.instanceId === instanceId);
    return accessory ? { ...accessory } : null;
  }

  updatePart(key: AvatarPartKey, patch: Partial<AvatarPartState>): AvatarPartState {
    const nextState = {
      ...this.state[key],
      ...patch,
    };
    this.state = {
      ...this.state,
      [key]: nextState,
    };
    return { ...nextState };
  }

  addAccessory(category: AccessoryCategory): AvatarAccessoryInstance | null {
    const definition = getAccessoryCategoryDefinition(category);

    if (definition.options.length === 0) {
      return null;
    }

    const nextOrder = getNextAccessoryOrder(this.state.accessories, definition.defaultLayerSlot);
    const accessory = createDefaultAccessoryInstance(category, nextOrder, definition.defaultLayerSlot);

    this.state = {
      ...this.state,
      accessories: [...this.state.accessories, accessory],
    };

    return { ...accessory };
  }

  updateAccessory(instanceId: string, patch: Partial<AvatarAccessoryInstance>): AvatarAccessoryInstance | null {
    const nextAccessories = this.state.accessories.map(accessory => {
      if (accessory.instanceId !== instanceId) {
        return accessory;
      }

      return {
        ...accessory,
        ...patch,
      };
    });
    const nextAccessory = nextAccessories.find(accessory => accessory.instanceId === instanceId) ?? null;

    this.state = {
      ...this.state,
      accessories: normalizeAccessoryOrders(nextAccessories),
    };

    return nextAccessory ? { ...nextAccessory } : null;
  }

  updateAccessoryPose(
    instanceId: string,
    poseKey: AccessoryPoseKey,
    patch: Partial<AvatarAccessoryPoseState>,
  ): AvatarAccessoryInstance | null {
    if (poseKey === 'portrait') {
      return this.updateAccessory(instanceId, patch);
    }

    const nextAccessories = this.state.accessories.map(accessory => {
      if (accessory.instanceId !== instanceId) {
        return accessory;
      }

      const poseProperty = poseKey === 'chibiBack'
        ? 'chibiBack'
        : poseKey === 'chibiSide'
          ? 'chibiSide'
          : 'chibi';

      return {
        ...accessory,
        [poseProperty]: {
          ...getAccessoryPoseState(accessory, poseKey),
          ...patch,
        },
      };
    });
    const nextAccessory = nextAccessories.find(accessory => accessory.instanceId === instanceId) ?? null;

    this.state = {
      ...this.state,
      accessories: nextAccessories,
    };

    return nextAccessory ? { ...nextAccessory } : null;
  }

  removeAccessory(instanceId: string): void {
    this.state = {
      ...this.state,
      accessories: normalizeAccessoryOrders(
        this.state.accessories.filter(accessory => accessory.instanceId !== instanceId)
      ),
    };
  }

  setAccessoryLayerSlot(
    instanceId: string,
    layerSlot: AccessoryLayerSlot,
  ): AvatarAccessoryInstance | null {
    const current = this.state.accessories.find(accessory => accessory.instanceId === instanceId);

    if (!current) {
      return null;
    }

    const nextOrder = getNextAccessoryOrder(
      this.state.accessories.filter(accessory => accessory.instanceId !== instanceId),
      layerSlot
    );

    const nextAccessories = this.state.accessories.map(accessory => {
      if (accessory.instanceId !== instanceId) {
        return accessory;
      }

      return {
        ...accessory,
        layerSlot,
        order: nextOrder,
        chibi: {
          ...getAccessoryPoseState(accessory, 'chibi'),
          layerSlot,
          order: nextOrder,
        },
        chibiBack: {
          ...getAccessoryPoseState(accessory, 'chibiBack'),
          layerSlot,
          order: nextOrder,
        },
        chibiSide: {
          ...getAccessoryPoseState(accessory, 'chibiSide'),
          layerSlot,
          order: nextOrder,
        },
      };
    });
    const normalizedAccessories = normalizeAccessoryOrders(nextAccessories).map(accessory => (
      accessory.instanceId === instanceId
        ? {
          ...accessory,
          chibi: {
            ...accessory.chibi,
            layerSlot: accessory.layerSlot,
            order: accessory.order,
          },
          chibiBack: {
            ...accessory.chibiBack,
            layerSlot: accessory.layerSlot,
            order: accessory.order,
          },
          chibiSide: {
            ...accessory.chibiSide,
            layerSlot: accessory.layerSlot,
            order: accessory.order,
          },
        }
        : accessory
    ));
    const nextAccessory = normalizedAccessories.find(accessory => accessory.instanceId === instanceId) ?? null;

    this.state = {
      ...this.state,
      accessories: normalizedAccessories,
    };

    return nextAccessory ? { ...nextAccessory } : null;
  }

  reorderAccessoryWithinSlot(sourceInstanceId: string, targetInstanceId: string): void {
    const source = this.state.accessories.find(accessory => accessory.instanceId === sourceInstanceId);
    const target = this.state.accessories.find(accessory => accessory.instanceId === targetInstanceId);

    if (!source || !target || source.layerSlot !== target.layerSlot || source.instanceId === target.instanceId) {
      return;
    }

    const sameSlot = this.state.accessories
      .filter(accessory => accessory.layerSlot === source.layerSlot)
      .sort((first, second) => first.order - second.order);
    const withoutSource = sameSlot.filter(accessory => accessory.instanceId !== sourceInstanceId);
    const targetIndex = withoutSource.findIndex(accessory => accessory.instanceId === targetInstanceId);
    const nextSameSlot = [
      ...withoutSource.slice(0, targetIndex),
      source,
      ...withoutSource.slice(targetIndex),
    ].map((accessory, order) => ({
      ...accessory,
      order,
      chibi: {
        ...accessory.chibi,
        order,
      },
      chibiBack: {
        ...accessory.chibiBack,
        order,
      },
      chibiSide: {
        ...accessory.chibiSide,
        order,
      },
    }));
    const otherSlots = this.state.accessories.filter(accessory => accessory.layerSlot !== source.layerSlot);

    this.state = {
      ...this.state,
      accessories: [...otherSlots, ...nextSameSlot],
    };
  }

  private mergeInitialState(initialState?: Partial<AvatarState>): AvatarState {
    return normalizeAvatarState(initialState);
  }
}
