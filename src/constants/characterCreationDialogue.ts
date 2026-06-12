import { DEFAULT_EXPRESSION_PRESET_ID } from '~/constants/expressionCatalog';
import type { DialogueViewScript } from '~/typing/dialogueView';
import type { AvatarState } from '~/widgets/avatarCanvas';

interface CreateCharacterCreationSuccessDialogueScriptInput {
  characterId: string;
  name: string;
  color: string;
  label: string;
  avatarState: AvatarState;
}

export function createCharacterCreationSuccessDialogueScript({
  characterId,
  name,
  color,
  label,
  avatarState,
}: CreateCharacterCreationSuccessDialogueScriptInput): DialogueViewScript {
  return {
    id: `character-creation-success-${characterId}`,
    participants: [
      {
        id: characterId,
        name,
        color,
        label,
        slot: 'left',
        avatarState,
      },
    ],
    lines: [
      {
        id: 'character-created',
        type: 'SAY',
        speakerId: characterId,
        text: '創建成功！',
        expressionPresetId: DEFAULT_EXPRESSION_PRESET_ID,
      },
    ],
  };
}
