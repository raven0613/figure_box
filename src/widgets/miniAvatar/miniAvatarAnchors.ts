import { MINI_PIXEL_SCALE } from './miniAvatarRig';
import type { MiniAnchorOffset, MiniPoint } from './miniAvatarTypes';

interface MiniAnchorOffsetDefinition {
  default: MiniAnchorOffset;
  byBodyType?: Record<number, MiniAnchorOffset | undefined>;
}

type MiniAnchorOffsetEntry = MiniAnchorOffset | MiniAnchorOffsetDefinition;
type MiniAnchorOffsetMap = Record<string, MiniAnchorOffsetEntry | undefined>;

const DEFAULT_ANCHOR_OFFSET: MiniPoint = { x: 0, y: 0 };

// Values are source-pixel offsets from the rotation anchor to the image center.
// If an asset is not listed here, it rotates around its own center.
export const MINI_AVATAR_ANCHOR_OFFSETS: MiniAnchorOffsetMap = {
  'arm_idle/01': {
    default: { x: 0, y: 0 },
    byBodyType: {
      1: { x: 0, y: 0 },
      2: { x: 0, y: 0 },
      3: { x: 1, y: 1 },
      4: { x: 2, y: 3 },
      5: { x: 2, y: 3 },
    },
  },
};

export function getMiniAvatarAnchorOffset(folder: string, optionId: string, bodyTypeId?: number): MiniPoint {
  const anchorOffset = resolveMiniAnchorOffset(MINI_AVATAR_ANCHOR_OFFSETS[`${folder}/${optionId}`], bodyTypeId);

  if (!anchorOffset) {
    return DEFAULT_ANCHOR_OFFSET;
  }

  return {
    x: anchorOffset.x * MINI_PIXEL_SCALE,
    y: anchorOffset.y * MINI_PIXEL_SCALE,
  };
}

function resolveMiniAnchorOffset(
  anchorOffsetEntry: MiniAnchorOffsetEntry | undefined,
  bodyTypeId: number | undefined,
): MiniAnchorOffset | undefined {
  if (!anchorOffsetEntry) {
    return undefined;
  }

  if (isMiniAnchorOffset(anchorOffsetEntry)) {
    return anchorOffsetEntry;
  }

  if (bodyTypeId !== undefined) {
    return anchorOffsetEntry.byBodyType?.[bodyTypeId] ?? anchorOffsetEntry.default;
  }

  return anchorOffsetEntry.default;
}

function isMiniAnchorOffset(anchorOffsetEntry: MiniAnchorOffsetEntry): anchorOffsetEntry is MiniAnchorOffset {
  return 'x' in anchorOffsetEntry && 'y' in anchorOffsetEntry;
}
