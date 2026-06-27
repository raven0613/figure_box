import type { Group } from 'fabric';
import type { GridCoordinate } from './townMapGrid';
import type { TownMapCharacterSpriteDirection } from './townMapCharacterSpriteRenderer';

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
  cellSize: number;
  getCharacterToken: (characterId: string) => Group | undefined;
  getCharacterTile: (characterId: string) => GridCoordinate | null;
  getCharacterPosition: (characterId: string, coordinate: GridCoordinate) => GridCoordinate;
  moveCharacterToTile: (characterId: string, target: GridCoordinate) => GridCoordinate | null;
  positionToken: (token: Group, position: GridCoordinate) => void;
  startAnimationLoop: () => void;
  stopAnimationLoopIfIdle: () => void;
  setCharacterDirection: (characterId: string, direction: TownMapCharacterSpriteDirection) => void;
  onWalkStopped: (characterId: string) => void;
}

const MAX_WALK_FRAME_DELTA_MS = 50;

// 走路狀態與步進動畫
export class TownMapWalkAnimator {
  private readonly cellSize: number;
  private readonly getCharacterToken: (characterId: string) => Group | undefined;
  private readonly getCharacterTile: (characterId: string) => GridCoordinate | null;
  private readonly getCharacterPosition: (characterId: string, coordinate: GridCoordinate) => GridCoordinate;
  private readonly moveCharacterToTile: (characterId: string, target: GridCoordinate) => GridCoordinate | null;
  private readonly positionToken: (token: Group, position: GridCoordinate) => void;
  private readonly startAnimationLoop: () => void;
  private readonly stopAnimationLoopIfIdle: () => void;
  private readonly setCharacterDirection: (characterId: string, direction: TownMapCharacterSpriteDirection) => void;
  private readonly onWalkStopped: (characterId: string) => void;
  private readonly walkers = new Map<string, WalkState>();
  private isPaused = false;

  constructor(options: TownMapWalkAnimatorOptions) {
    this.cellSize = options.cellSize;
    this.getCharacterToken = options.getCharacterToken;
    this.getCharacterTile = options.getCharacterTile;
    this.getCharacterPosition = options.getCharacterPosition;
    this.moveCharacterToTile = options.moveCharacterToTile;
    this.positionToken = options.positionToken;
    this.startAnimationLoop = options.startAnimationLoop;
    this.stopAnimationLoopIfIdle = options.stopAnimationLoopIfIdle;
    this.setCharacterDirection = options.setCharacterDirection;
    this.onWalkStopped = options.onWalkStopped;
  }

  dispose(): void {
    this.walkers.clear();
  }

  hasActiveAnimations(): boolean {
    return !this.isPaused && this.walkers.size > 0;
  }

  isWalking(characterId: string): boolean {
    return this.walkers.has(characterId);
  }

  setPaused(isPaused: boolean): void {
    if (this.isPaused === isPaused) {
      return;
    }

    this.isPaused = isPaused;
    this.walkers.forEach(walker => {
      walker.lastTimestamp = null;
    });

    if (isPaused) {
      this.stopAnimationLoopIfIdle();
      return;
    }

    if (this.walkers.size > 0) {
      this.startAnimationLoop();
    }
  }

  walkCharacterAlongPath(
    characterId: string,
    path: GridCoordinate[],
    onArrive: (position: GridCoordinate) => void,
    onBlocked: (position: GridCoordinate) => void,
  ): void {
    this.cancelWalk(characterId);

    if (path.length === 0) {
      onArrive(this.getCharacterTile(characterId) ?? { x: 0, y: 0 });
      return;
    }

    const token = this.getCharacterToken(characterId);

    if (!token) {
      onBlocked(this.getCharacterTile(characterId) ?? path[0]);
      return;
    }

    const startingTile = this.getCharacterTile(characterId);
    const firstWaypoint = this.moveCharacterToTile(characterId, path[0]);

    if (!firstWaypoint) {
      const currentTile = this.getCharacterTile(characterId);
      onBlocked(currentTile ?? path[0]);
      return;
    }

    const walkState = this.createWalkState(
      characterId,
      token,
      path,
      firstWaypoint,
      onArrive,
      onBlocked,
    );

    this.setCharacterDirection(
      characterId,
      startingTile
        ? getDirectionForMovement(startingTile, path[0])
        : getDirectionForMovement(walkState.allPoints[0], walkState.allPoints[1]),
    );
    this.walkers.set(characterId, walkState);
    this.startAnimationLoop();
  }

  cancelWalk(characterId: string): void {
    if (this.walkers.delete(characterId)) {
      this.setCharacterDirection(characterId, 'front');
      this.onWalkStopped(characterId);
    }

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
    if (this.isPaused) {
      return;
    }

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
        this.onWalkStopped(id);
      }
    });
  }

  private createWalkState(
    characterId: string,
    token: Group,
    path: GridCoordinate[],
    firstWaypoint: GridCoordinate,
    onArrive: (position: GridCoordinate) => void,
    onBlocked: (position: GridCoordinate) => void,
  ): WalkState {
    const waypoints = path.map((point, index) => (
      index === 0 ? firstWaypoint : this.getCharacterPosition(characterId, point)
    ));
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
    const currentToken = this.getCharacterToken(walker.characterId);

    if (!currentToken) {
      walker.onBlocked(this.getCharacterTile(walker.characterId) ?? walker.path[walker.currentSegment]);
      return 'done';
    }

    walker.token = currentToken;

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

    const delta = Math.min(Math.max(0, timestamp - walker.lastTimestamp), MAX_WALK_FRAME_DELTA_MS);
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
      this.setCharacterDirection(walker.characterId, 'front');
      walker.onArrive(walker.path[walker.path.length - 1]);
      return 'done';
    }

    this.positionToken(walker.token, getInterpolatedPosition(walker));
    return 'continue';
  }

  private moveToNextTile(walker: WalkState): boolean {
    const nextWaypoint = this.moveCharacterToTile(walker.characterId, walker.path[walker.currentSegment]);

    if (nextWaypoint) {
      const nextPointIndex = walker.currentSegment + 1;

      this.setCharacterDirection(
        walker.characterId,
        getDirectionForMovement(
          walker.path[walker.currentSegment - 1],
          walker.path[walker.currentSegment],
        ),
      );
      walker.allPoints[nextPointIndex] = nextWaypoint;
      walker.segmentLengths[walker.currentSegment] = getSegmentLength(
        walker.allPoints[walker.currentSegment],
        nextWaypoint,
      );
      return true;
    }

    const snapPoint = walker.allPoints[walker.currentSegment];

    this.positionToken(walker.token, snapPoint);
    this.setCharacterDirection(walker.characterId, 'front');
    walker.onBlocked(this.getCharacterTile(walker.characterId) ?? walker.path[walker.currentSegment]);
    return false;
  }
}

function getSegmentLengths(points: readonly GridCoordinate[]): number[] {
  const segmentLengths: number[] = [];

  for (let index = 0; index < points.length - 1; index++) {
    segmentLengths.push(getSegmentLength(points[index], points[index + 1]));
  }

  return segmentLengths;
}

function getSegmentLength(from: GridCoordinate, to: GridCoordinate): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  return Math.sqrt(dx * dx + dy * dy);
}

function getInterpolatedPosition(walker: WalkState): GridCoordinate {
  const segmentLength = walker.segmentLengths[walker.currentSegment];
  const progress = segmentLength > 0
    ? Math.min(1, walker.segmentProgress / segmentLength)
    : 1;
  const from = walker.allPoints[walker.currentSegment];
  const to = walker.allPoints[walker.currentSegment + 1];

  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  };
}

function getDirectionForMovement(from: GridCoordinate, to: GridCoordinate): TownMapCharacterSpriteDirection {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;

  if (Math.abs(deltaX) <= Math.abs(deltaY)) {
    return deltaY < 0 ? 'back' : 'front';
  }

  return deltaX < 0 ? 'side-left' : 'side-right';
}
