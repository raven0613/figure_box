import rawWorldEventDefinitions from '~/constants/events/worldEvents.json';
import { loadWorldEventDefinitions } from '~/utils/jsonParser/worldEventDefinitionSchema';

export const WORLD_EVENT_DEFINITIONS = loadWorldEventDefinitions(rawWorldEventDefinitions);

export const WORLD_EVENT_DEFINITIONS_BY_ID = WORLD_EVENT_DEFINITIONS.reduce(
  (definitionsById, definition) => ({
    ...definitionsById,
    [definition.id]: definition,
  }),
  {} as Record<string, typeof WORLD_EVENT_DEFINITIONS[number]>,
);
