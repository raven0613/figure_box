import { Expression } from '~/constants/character';
import type { DialogueViewScript } from '~/typing/dialogueView';

interface CreateCharacterCreationSuccessDialogueScriptInput {
  characterId: string;
  name: string;
  color: string;
  label: string;
}

export function createCharacterCreationSuccessDialogueScript({
  characterId,
  name,
  color,
  label,
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
      },
    ],
    lines: [
      {
        id: 'character-created',
        type: 'SAY',
        speakerId: characterId,
        text: '創建成功！',
        expression: Expression.Normal,
      },
    ],
  };
}
