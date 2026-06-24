import { DEFAULT_EXPRESSION_PRESET_ID } from '~/constants/expressionCatalog';
import {
  formatDialogueTextWithNameHighlights,
  type FormattedDialogueText,
} from '~/services/dialogueTextFormatter';
import type { DialogueViewInputLine, DialogueViewScript } from '~/typing/dialogueView';
import type { AvatarState } from '~/widgets/avatarCanvas';

export const CHARACTER_CREATION_WAY_OF_SAYING_ACTION_ID = 'characterCreation.setWayOfSaying';

export type CharacterCreationWayOfSayingField =
  | 'selfReference'
  | 'beginning'
  | 'ending';

interface CreateCharacterCreationSuccessDialogueScriptInput {
  characterId: string;
  name: string;
  color: string;
  label: string;
  avatarState: AvatarState;
  onWayOfSayingInput?: (input: {
    field: CharacterCreationWayOfSayingField;
    value: string;
  }) => void | Promise<void>;
}

export function createCharacterCreationSuccessDialogueScript({
  characterId,
  name,
  color,
  label,
  avatarState,
  onWayOfSayingInput,
}: CreateCharacterCreationSuccessDialogueScriptInput): DialogueViewScript {
  const selfReferencePrompt = formatDialogueTextWithNameHighlights(
    '{characterName}怎麼自稱呢？',
    { characterName: name },
  );
  const beginningPrompt = formatDialogueTextWithNameHighlights('他有習慣的開頭嗎？', {});
  const endingPrompt = formatDialogueTextWithNameHighlights('他有習慣的語尾嗎？', {});
  const greeting = formatDialogueTextWithNameHighlights(
    '{beginningPhrase}{selfReference}是 {characterName}。今天起在這裡展開新生活，以後請多指教！{ending}',
    { characterName: name },
  );

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
      createWayOfSayingInputLine({
        characterId,
        id: 'character-self-reference',
        field: 'selfReference',
        variable: 'selfReference',
        prompt: selfReferencePrompt,
        fallbackValue: '我',
      }),
      createWayOfSayingInputLine({
        characterId,
        id: 'character-speaking-beginning',
        field: 'beginning',
        variable: 'beginningPhrase',
        prompt: beginningPrompt,
        fallbackValue: '',
        valueSuffix: '、',
      }),
      createWayOfSayingInputLine({
        characterId,
        id: 'character-speaking-ending',
        field: 'ending',
        variable: 'ending',
        prompt: endingPrompt,
        fallbackValue: '',
      }),
      {
        id: 'character-creation-greeting',
        type: 'SAY',
        speakerId: characterId,
        text: greeting.text,
        textSegments: greeting.textSegments,
        expressionPresetId: DEFAULT_EXPRESSION_PRESET_ID,
      },
    ],
    handleInputAction: input => {
      if (
        input.action.type !== 'custom' ||
        input.action.actionId !== CHARACTER_CREATION_WAY_OF_SAYING_ACTION_ID
      ) {
        return;
      }

      const field = input.action.parameters?.field;

      if (!isCharacterCreationWayOfSayingField(field)) {
        return;
      }

      return onWayOfSayingInput?.({
        field,
        value: input.value,
      });
    },
  };
}

function createWayOfSayingInputLine(input: {
  characterId: string;
  id: string;
  field: CharacterCreationWayOfSayingField;
  variable: string;
  prompt: FormattedDialogueText;
  fallbackValue: string;
  valueSuffix?: string;
}): DialogueViewInputLine {
  return {
    id: input.id,
    type: 'INPUT',
    speakerId: input.characterId,
    prompt: input.prompt.text,
    promptSegments: input.prompt.textSegments,
    variable: input.variable,
    fallbackValue: input.fallbackValue,
    submitLabel: '確定',
    skipLabel: '稍後設定',
    expressionPresetId: DEFAULT_EXPRESSION_PRESET_ID,
    submitActions: [
      {
        type: 'replaceTemplate',
        valueSuffix: input.valueSuffix,
      },
      {
        type: 'custom',
        actionId: CHARACTER_CREATION_WAY_OF_SAYING_ACTION_ID,
        parameters: {
          field: input.field,
        },
      },
    ],
    skipActions: [
      {
        type: 'replaceTemplate',
        value: input.field === 'selfReference' ? input.fallbackValue : '',
      },
    ],
  };
}

function isCharacterCreationWayOfSayingField(
  value: unknown,
): value is CharacterCreationWayOfSayingField {
  return value === 'selfReference' ||
    value === 'beginning' ||
    value === 'ending';
}
