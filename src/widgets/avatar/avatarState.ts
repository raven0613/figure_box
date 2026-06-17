import { AVATAR_PORTRAIT_RIG_LAYOUT, AVATAR_RIG_COLORS } from '../../constants/avatarRig';
import { ACCESSORY_LAYER_SLOT_DEFINITIONS } from './avatarAccessoryDefinitions';
import {
  createDefaultAccessoryInstance,
  createDefaultAccessoryPoseState,
  createMirroredAccessoryPoseState,
} from './avatarAccessoryState';
import {
  AVATAR_PART_DEFINITIONS,
  getDefaultSecondaryColor,
} from './avatarDefinitions';
import type {
  AccessoryLayerSlot,
  AvatarAccessoryInstance,
  AvatarPartKey,
  AvatarPartState,
  AvatarState,
} from './avatarTypes';

const DEFAULT_SCALE = 1;
const DEFAULT_LINE_COLOR = AVATAR_RIG_COLORS.line;

export function createDefaultAvatarState(): AvatarState {
  const partState = AVATAR_PART_DEFINITIONS.reduce((state, definition) => {
    state[definition.key] = {
      optionId: definition.options[0]?.id ?? 1,
      color: definition.defaultColor,
      secondaryColor: getDefaultSecondaryColor(definition.key, definition.defaultColor),
      lineColor: definition.defaultLineColor ?? DEFAULT_LINE_COLOR,
      offsetX: 0,
      offsetY: 0,
      rotate: 0,
      scale: DEFAULT_SCALE,
      flipX: false,
      leftVisible: true,
      rightVisible: true,
      isVisible: true,
      layerOrder: getDefaultPartLayerOrder(definition.key),
      lightDistance: definition.key === 'mini.eyeLight'
        ? undefined
        : AVATAR_PORTRAIT_RIG_LAYOUT.mirrored.defaultEyeLightDistance,
    };
    return state;
  }, {} as Record<AvatarPartKey, AvatarPartState>);

  return {
    ...partState,
    accessories: [createDefaultAccessoryInstance('sideHair', 0)],
  };
}

export function normalizeAvatarState(initialState?: Partial<AvatarState>): AvatarState {
  const defaults = createDefaultAvatarState();

  if (!initialState) {
    return defaults;
  }

  AVATAR_PART_DEFINITIONS.forEach(definition => {
    defaults[definition.key] = {
      ...defaults[definition.key],
      ...initialState[definition.key],
    };
  });

  const initialAccessories = initialState.accessories;

  if (Array.isArray(initialAccessories)) {
    return {
      ...defaults,
      accessories: normalizeAccessoryOrders(initialAccessories.map(accessory => {
        const defaultAccessory = createDefaultAccessoryInstance(
          accessory.category ?? 'sideHair',
          accessory.order ?? 0,
          accessory.layerSlot,
        );
        const chibi = {
          ...createDefaultAccessoryPoseState(
            accessory.chibi?.layerSlot ?? accessory.layerSlot,
            accessory.chibi?.order ?? accessory.order ?? 0,
          ),
          ...accessory.chibi,
        };
        const isChibiBackFollowingFront = accessory.isChibiBackFollowingFront
          ?? accessory.chibiBack === undefined;
        const chibiBack = accessory.chibiBack
          ? {
            ...createDefaultAccessoryPoseState(
              accessory.chibiBack.layerSlot ?? accessory.layerSlot,
              accessory.chibiBack.order ?? accessory.order ?? 0,
            ),
            ...accessory.chibiBack,
          }
          : createMirroredAccessoryPoseState(chibi, defaultAccessory.category);
        const chibiSide = {
          ...createDefaultAccessoryPoseState(
            accessory.chibiSide?.layerSlot ?? accessory.layerSlot,
            accessory.chibiSide?.order ?? accessory.order ?? 0,
          ),
          ...chibi,
          ...accessory.chibiSide,
        };

        return {
          ...defaultAccessory,
          ...accessory,
          chibi,
          chibiBack: {
            ...createDefaultAccessoryPoseState(
              chibiBack.layerSlot ?? accessory.layerSlot,
              chibiBack.order ?? accessory.order ?? 0,
            ),
            ...chibiBack,
          },
          chibiSide,
          isChibiBackFollowingFront,
        };
      })),
    };
  }

  const legacySideHair = (initialState as Partial<Record<'hair.sideburns', AvatarPartState>>)['hair.sideburns'];

  if (legacySideHair) {
    return {
      ...defaults,
      accessories: [{
        ...createDefaultAccessoryInstance('sideHair', 0),
        ...legacySideHair,
        chibi: createDefaultAccessoryPoseState('frontFace', 0),
        chibiBack: createDefaultAccessoryPoseState('frontFace', 0),
        chibiSide: createDefaultAccessoryPoseState('frontFace', 0),
        isChibiBackFollowingFront: true,
      }],
    };
  }

  return defaults;
}

export function getNextAccessoryOrder(accessories: AvatarAccessoryInstance[], layerSlot: AccessoryLayerSlot): number {
  const sameSlotOrders = accessories
    .filter(accessory => accessory.layerSlot === layerSlot)
    .map(accessory => accessory.order);

  return sameSlotOrders.length === 0 ? 0 : Math.max(...sameSlotOrders) + 1;
}

export function normalizeAccessoryOrders(accessories: AvatarAccessoryInstance[]): AvatarAccessoryInstance[] {
  return ACCESSORY_LAYER_SLOT_DEFINITIONS.flatMap(slotDefinition => accessories
    .filter(accessory => accessory.layerSlot === slotDefinition.id)
    .sort((first, second) => first.order - second.order)
    .map((accessory, order) => ({
      ...accessory,
      order,
      chibi: {
        ...accessory.chibi,
        layerSlot: accessory.layerSlot,
        order,
      },
      chibiBack: {
        ...accessory.chibiBack,
        layerSlot: accessory.layerSlot,
        order,
      },
      chibiSide: {
        ...accessory.chibiSide,
        layerSlot: accessory.layerSlot,
        order,
      },
    })));
}

function getDefaultPartLayerOrder(key: AvatarPartKey): number {
  if (key === 'mini.clothingTop') {
    return 1;
  }

  return 0;
}
