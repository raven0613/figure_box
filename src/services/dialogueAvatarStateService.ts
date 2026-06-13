import { characterAvatarSaveService } from '~/services/save/characterAvatarSaveService';
import {
  createDefaultAvatarState,
  normalizeAvatarState,
  type AvatarState,
} from '~/widgets/avatarCanvas';

export function getDialogueAvatarState(characterId: string): AvatarState {
  const savedAvatarState = characterAvatarSaveService.getRecord(characterId)?.avatarState;

  if (!isAvatarStateInput(savedAvatarState)) {
    return createDefaultAvatarState();
  }

  return normalizeAvatarState(savedAvatarState);
}

function isAvatarStateInput(value: unknown): value is Partial<AvatarState> {
  return typeof value === 'object' && value !== null;
}
