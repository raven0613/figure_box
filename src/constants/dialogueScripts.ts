import rawDialogueScriptDefinitions from './dialogueScripts.json';
import { loadDialogueScriptDefinitions } from '~/utils/jsonParser/dialogueScriptSchema';

export const DIALOGUE_SCRIPT_DEFINITIONS = loadDialogueScriptDefinitions(
  rawDialogueScriptDefinitions,
);

export const DIALOGUE_SCRIPT_DEFINITIONS_BY_ID = Object.fromEntries(
  DIALOGUE_SCRIPT_DEFINITIONS.map(definition => [definition.id, definition]),
);
