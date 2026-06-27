import { TOWN_MAP_HEIGHT, TOWN_MAP_WIDTH, DESTINATION_MAP } from '~/constants/townMap';
import type { Position } from '~/constants/character';
import type { CharacterEventActivityDestination } from '~/constants/charactarEventsDefinitions';

export function getRandomDestinationTarget(motivation: string): Position | null {
  const destinations = DESTINATION_MAP[motivation];

  if (!destinations || destinations.length === 0) {
    return null;
  }

  const destination = destinations[Math.floor(Math.random() * destinations.length)];
  const tiles = destination.serviceTiles;
  return tiles[Math.floor(Math.random() * tiles.length)];
}

export function resolveActivityDestination(
  destination: CharacterEventActivityDestination | undefined,
): Position | null {
  if (!destination) {
    return null;
  }

  if (typeof destination === 'string') {
    return getRandomDestinationTarget(destination.replace('randomDestination.', ''));
  }

  return destination;
}

export function getRandomMapTarget(
  position: Position,
  random: () => number = Math.random,
): Position {
  const target = {
    x: Math.floor(random() * TOWN_MAP_WIDTH),
    y: Math.floor(random() * TOWN_MAP_HEIGHT),
  };

  if (target.x === position.x && target.y === position.y) {
    return {
      x: (target.x + 1) % TOWN_MAP_WIDTH,
      y: target.y,
    };
  }

  return target;
}
