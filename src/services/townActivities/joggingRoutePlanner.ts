import type { Position } from '~/constants/character';
import { DESTINATION_MAP } from '~/constants/townMap';

export function resolveJoggingRouteWaypoints(location: Position): Position[] | null {
  const joggingTiles = DESTINATION_MAP.jogging.flatMap(destination => destination.serviceTiles);
  const routeColumns = getUniqueSortedNumbers(joggingTiles.map(tile => tile.x));
  const routeRows = getUniqueSortedNumbers(joggingTiles.map(tile => tile.y));
  const turnColumn = getFarthestNumber(routeColumns, location.x);
  const turnRow = getFarthestNumber(routeRows, location.y);

  if (turnColumn === null || turnRow === null) {
    return null;
  }

  const finishColumnCandidates = routeColumns.filter(column => column !== turnColumn);
  const finishColumn = getFarthestNumber(finishColumnCandidates, turnColumn);

  if (finishColumn === null) {
    return null;
  }

  return dedupeConsecutivePositions([
    { ...location },
    { x: turnColumn, y: location.y },
    { x: turnColumn, y: turnRow },
    { x: finishColumn, y: turnRow },
  ]);
}

function getUniqueSortedNumbers(values: readonly number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

function getFarthestNumber(values: readonly number[], target: number): number | null {
  return values.reduce<number | null>((farthestValue, value) => {
    if (farthestValue === null) {
      return value;
    }

    return Math.abs(value - target) > Math.abs(farthestValue - target)
      ? value
      : farthestValue;
  }, null);
}

function dedupeConsecutivePositions(positions: readonly Position[]): Position[] {
  return positions.reduce<Position[]>((result, position) => {
    const previousPosition = result[result.length - 1];

    if (!previousPosition || !areSamePosition(previousPosition, position)) {
      result.push({ ...position });
    }

    return result;
  }, []);
}

function areSamePosition(left: Position, right: Position): boolean {
  return left.x === right.x && left.y === right.y;
}
