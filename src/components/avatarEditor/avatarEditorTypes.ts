import type {
  AccessoryPoseKey,
  AvatarGradientCoordinateSpace,
  AvatarPartKey,
} from '~/widgets/avatarCanvas';
import type { AvatarAppearanceTemplateRecord } from '~/services/save/avatarAppearanceSaveService';

export type SelectedTarget =
  | { type: 'part'; key: AvatarPartKey }
  | { type: 'accessory'; instanceId: string };

export type DraftSaveStatus = 'idle' | 'pending' | 'saved' | 'error';

export type TemplateAction =
  | { type: 'load'; template: AvatarAppearanceTemplateRecord }
  | { type: 'overwrite'; template: AvatarAppearanceTemplateRecord }
  | { type: 'delete'; template: AvatarAppearanceTemplateRecord }
  | { type: 'reset' };

export type HairApplyKind = 'color' | 'line';

export type PortraitChibiPoseKey = Extract<AccessoryPoseKey, 'portrait' | 'chibi'>;

export type HairLightPoseKey = 'portrait' | 'front' | 'back' | 'side';

export type HairApplyTarget =
  | { id: string; type: 'part'; key: AvatarPartKey; label: string }
  | { id: string; type: 'accessory'; instanceId: string; label: string };

export type ApplyHairSettings = (colorGradientSpace?: AvatarGradientCoordinateSpace) => void;
