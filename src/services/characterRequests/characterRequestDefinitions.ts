import rawCharacterRequestDefinitions from '~/constants/requests/characterRequests.json';
import { loadCharacterRequestDefinitions } from '~/utils/jsonParser/characterRequestDefinitionSchema';

export const CHARACTER_REQUEST_DEFINITIONS = loadCharacterRequestDefinitions(rawCharacterRequestDefinitions);
