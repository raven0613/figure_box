import rawGossipMemoryTopicDefinitions from './gossipMemoryTopics.json';
import rawGossipTopicDefinitions from './gossipTopics.json';
import {
  loadGossipMemoryTopicDefinitions,
  loadGossipTopicDefinitions,
} from '~/utils/jsonParser/gossipTopicSchema';

export const GOSSIP_TOPIC_DEFINITIONS = loadGossipTopicDefinitions(
  rawGossipTopicDefinitions,
);

export const GOSSIP_MEMORY_TOPIC_DEFINITIONS = loadGossipMemoryTopicDefinitions(
  rawGossipMemoryTopicDefinitions,
);
