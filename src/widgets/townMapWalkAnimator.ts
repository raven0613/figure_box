import type { Group } from 'fabric';
import type { GridCoordinate, TownMapGrid } from './townMapGrid';

interface WalkState {
  token: Group;
  allPoints: GridCoordinate[];
  segmentLengths: number[];
  currentSegment: number;
  segmentProgress: number;
  lastTimestamp: number | null;
  speed: number;
  path: GridCoordinate[];
  characterId: string;
  onArrive: (position: GridCoordinate) => void;
  onBlocked: (position: GridCoordinate) => void;
  pausedUntil: number | null;
}

interface TownMapWalkAnimatorOptions {
  grid: TownMapGrid;
  cellSize: number;
  getCharacterToken: (characterId: string) => Group | undefined;
  getCharacterTile: (characterId: string) => GridCoordinate | null;
  getCharacterPosition: (coordinate: GridCoordinate) => GridCoordinate;
  positionToken: (token: Group, position: GridCoordinate) => void;
  startAnimationLoop: () => void;
  stopAnimationLoopIfIdle: () => void;
}

// 走路狀態與步進動畫
export class TownMapWalkAnimator {
  private readonly grid: TownMapGrid;
  private readonly cellSize: number;
  private readonly getCharacterToken: (characterId: string) => Group | undefined;
  private readonly getCharacterTile: (characterId: string) => GridCoordinate | null;
  private readonly getCharacterPosition: (coordinate: GridCoordinate) => GridCoordinate;
  private readonly positionToken: (token: Group, position: GridCoordinate) => void;
  private readonly startAnimationLoop: () => void;
  private readonly stopAnimationLoopIfIdle: () => void;
  private readonly walkers = new Map<string, WalkState>();

  constructor(options: TownMapWalkAnimatorOptions) {
    this.grid = options.grid;
    this.cellSize = options.cellSize;
    this.getCharacterToken = options.getCharacterToken;
    this.getCharacterTile = options.getCharacterTile;
    this.getCharacterPosition = options.getCharacterPosition;
    this.positionToken = options.positionToken;
    this.startAnimationLoop = options.startAnimationLoop;
    this.stopAnimationLoopIfIdle = options.stopAnimationLoopIfIdle;
  }

  dispose(): void {
    this.walkers.clear();
  }

  hasActiveAnimations(): boolean {
    return this.walkers.size > 0;
  }

  walkCharacterAlongPath(
    characterId: string,
    path: GridCoordinate[],
    onArrive: (position: GridCoordinate) => void,
    onBlocked: (position: GridCoordinate) => void,
  ): void {
    this.cancelWalk(characterId);

    const token = this.getCharacterToken(characterId);

    if (!token || path.length === 0) {
      onArrive(path[path.length - 1] ?? { x: 0, y: 0 });
      return;
    }

    const moved = this.grid.moveOccupant(characterId, path[0]);

    if (!moved) {
      const currentTile = this.getCharacterTile(characterId);
      onBlocked(currentTile ?? path[0]);
      return;
    }

    this.walkers.set(characterId, this.createWalkState(characterId, token, path, onArrive, onBlocked));
    this.startAnimationLoop();
  }

  cancelWalk(characterId: string): void {
    this.walkers.delete(characterId);
    this.stopAnimationLoopIfIdle();
  }

  pauseWalk(characterId: string, durationMs: number): boolean {
    const walker = this.walkers.get(characterId);

    if (!walker) {
      return false;
    }

    const now = performance.now();
    walker.pausedUntil = Math.max(walker.pausedUntil ?? now, now + durationMs);
    this.startAnimationLoop();
    return true;
  }

  advanceWalkers(timestamp: number): void {
    const completedWalkers: { id: string; walker: WalkState }[] = [];

    this.walkers.forEach((walker, id) => {
      const result = this.advanceWalker(walker, timestamp);

      if (result !== 'continue') {
        completedWalkers.push({ id, walker });
      }
    });

    completedWalkers.forEach(({ id, walker }) => {
      if (this.walkers.get(id) === walker) {
        this.walkers.delete(id);
      }
    });
  }

  private createWalkState(
    characterId: string,
    token: Group,
    path: GridCoordinate[],
    onArrive: (position: GridCoordinate) => void,
    onBlocked: (position: GridCoordinate) => void,
  ): WalkState {
    const waypoints = path.map(point => this.getCharacterPosition(point));
    const startPosition = { x: token.left ?? 0, y: token.top ?? 0 };
    const allPoints = [startPosition, ...waypoints];

    return {
      token,
      allPoints,
      segmentLengths: getSegmentLengths(allPoints),
      currentSegment: 0,
      segmentProgress: 0,
      lastTimestamp: null,
      speed: this.cellSize / 300,
      path,
      characterId,
      onArrive,
      onBlocked,
      pausedUntil: null,
    };
  }

  private advanceWalker(walker: WalkState, timestamp: number): 'continue' | 'done' {
    if (walker.pausedUntil !== null) {
      if (timestamp < walker.pausedUntil) {
        walker.lastTimestamp = timestamp;
        return 'continue';
      }

      walker.pausedUntil = null;
    }

    if (walker.lastTimestamp === null) {
      walker.lastTimestamp = timestamp;
    }

    const delta = timestamp - walker.lastTimestamp;
    walker.lastTimestamp = timestamp;
    walker.segmentProgress += walker.speed * delta;

    while (
      walker.currentSegment < walker.segmentLengths.length
      && walker.segmentProgress >= walker.segmentLengths[walker.currentSegment]
    ) {
      walker.segmentProgress -= walker.segmentLengths[walker.currentSegment];
      walker.currentSegment++;

      if (walker.currentSegment < walker.path.length && !this.moveToNextTile(walker)) {
        return 'done';
      }
    }

    if (walker.currentSegment >= walker.segmentLengths.length) {
      const final = walker.allPoints[walker.allPoints.length - 1];

      this.positionToken(walker.token, final);
      walker.onArrive(walker.path[walker.path.length - 1]);
      return 'done';
    }

    this.positionToken(walker.token, getInterpolatedPosition(walker));
    return 'continue';
  }

  private moveToNextTile(walker: WalkState): boolean {
    const nextMoved = this.grid.moveOccupant(walker.characterId, walker.path[walker.currentSegment]);

    if (nextMoved) {
      return true;
    }

    const snapPoint = walker.allPoints[walker.currentSegment];

    this.positionToken(walker.token, snapPoint);
    walker.onBlocked(this.getCharacterTile(walker.characterId) ?? walker.path[walker.currentSegment]);
    return false;
  }
}

function getSegmentLengths(points: readonly GridCoordinate[]): number[] {
  const segmentLengths: number[] = [];

  for (let index = 0; index < points.length - 1; index++) {
    const dx = points[index + 1].x - points[index].x;
    const dy = points[index + 1].y - points[index].y;
    segmentLengths.push(Math.sqrt(dx * dx + dy * dy));
  }

  return segmentLengths;
}

function getInterpolatedPosition(walker: WalkState): GridCoordinate {
  const progress = walker.segmentProgress / walker.segmentLengths[walker.currentSegment];
  const from = walker.allPoints[walker.currentSegment];
  const to = walker.allPoints[walker.currentSegment + 1];

  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  };
}
