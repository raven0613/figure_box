import { CHARACTER_SEEDS } from './character';
import { DIALOGUE_SCRIPT_DEFINITIONS_BY_ID } from './dialogueScripts';
import { getDialogueAvatarState } from '~/services/dialogueAvatarStateService';
import { createDialogueViewScript } from '~/services/dialogueScriptResolver';

const DEMO_SCRIPT_ID = 'demo-court-invite';
const demoCharacters = CHARACTER_SEEDS.slice(0, 4);
const demoDefinition = DIALOGUE_SCRIPT_DEFINITIONS_BY_ID[DEMO_SCRIPT_ID];

if (!demoDefinition || demoCharacters.length < 4) {
  throw new Error(`Unable to create dialogue demo "${DEMO_SCRIPT_ID}".`);
}

export const DIALOGUE_DEMO_SCRIPT = createDialogueViewScript(
  demoDefinition,
  {
    participants: {
      coach: createDemoParticipant(demoCharacters[0]),
      responder: createDemoParticipant(demoCharacters[1]),
      enthusiast: createDemoParticipant(demoCharacters[2]),
      observer: createDemoParticipant(demoCharacters[3]),
    },
    traitsByParticipant: {
      coach: ['strict', 'leader'],
      responder: ['playful', 'observer'],
      enthusiast: ['energetic'],
      observer: ['careful'],
    },
    relationships: [
      {
        source: 'responder',
        target: 'coach',
        intimacy: 64,
      },
      {
        source: 'coach',
        target: 'responder',
        intimacy: 58,
      },
    ],
  },
);

function createDemoParticipant(
  character: typeof CHARACTER_SEEDS[number],
) {
  return {
    id: character.id,
    name: character.name,
    color: character.color,
    label: character.label,
    avatarState: getDialogueAvatarState(character.id),
  };
}
