import type { Position } from '~/constants/character';
import { CHARACTER_BEHAVIOR_DEFINITIONS_BY_ID } from '~/constants/characterBehaviorDefinitions';
import { DEFAULT_EXPRESSION_PRESET_ID } from '~/constants/expressionCatalog';
import { DESTINATION_MAP, TOWN_APARTMENT_ENTRANCE_TILES, TOWN_APARTMENT_SPACE_ID } from '~/constants/townMap';
import { getCharacterStateSummary } from '~/stateMachines/gameFlow/children/character';
import { EventType } from '~/stateMachines/gameFlow/events';
import type { CharacterSnapshot, SendCharacterEvent } from '~/services/townCharacterTypes';
import type { CharacterRuntimeSnapshot } from '~/services/save/saveTypes';
import type { FabricTownMapWidget } from '~/widgets/fabricTownMapWidget';

interface TownMovementCoordinatorOptions {
  widget: FabricTownMapWidget;
  getCharacterSnapshot: (characterId: string) => CharacterSnapshot | null;
  sendToCharacter: SendCharacterEvent;
  onActivityRouteCompleted?: (activityId: string) => void;
}

export interface JoggingRouteInput {
  activityId: string;
  participantIds: readonly string[];
  location: Position;
}

export interface CancelActivityRouteOptions {
  forgetCompleted?: boolean;
  keepPairFinishFormation?: boolean;
}

interface ActivityRouteWalk {
  activityId: string;
  characterIds: readonly string[];
  waypoints: readonly Position[];
  nextWaypointIndex: number;
  pendingCharacterIds: Set<string>;
  isRaceStarted: boolean;
  raceLeaderIndex: number;
  raceSwapTimeoutId: ReturnType<typeof setTimeout> | null;
}

interface CharacterRoutePlan {
  characterId: string;
  waypoints: readonly Position[];
  presentationOffsetCells?: Position;
}

const MIN_JOGGING_ROUTE_PARTICIPANT_COUNT = 1;
const MAX_JOGGING_ROUTE_PARTICIPANT_COUNT = 2;
const JOGGING_HORIZONTAL_SIDE_OFFSET_CELLS = 0.32;
const JOGGING_HORIZONTAL_STAGGER_OFFSET_CELLS = -0.2;
const JOGGING_VERTICAL_SIDE_OFFSET_CELLS = 0.5;
const JOGGING_FINISH_X_OFFSET_CELLS = 0.5;
const JOGGING_FINISH_Y_OFFSET_CELLS = 0.35;
const JOGGING_ROUTE_OFFSET_TRANSITION_MS = 0;
const JOGGING_RACE_FAST_SPEED_MULTIPLIER = 1.3;
const JOGGING_RACE_SLOW_SPEED_MULTIPLIER = 0.8;
const JOGGING_RACE_FIRST_SWAP_DELAY_MS = 1200;
const JOGGING_RACE_SWAP_INTERVAL_MS = 2400;

// 角色放置、走路同步、路徑 blocked/arrived
export class TownMovementCoordinator {
  private readonly widget: FabricTownMapWidget;
  private readonly getCharacterSnapshot: (characterId: string) => CharacterSnapshot | null;
  private readonly sendToCharacter: SendCharacterEvent;
  private readonly onActivityRouteCompleted?: TownMovementCoordinatorOptions['onActivityRouteCompleted'];
  private readonly walkingCharacterIds = new Set<string>();
  private readonly visibleCharacterIds = new Set<string>();
  private readonly characterRenderDataById = new Map<string, {
    color: string;
    label: string;
  }>();
  private readonly pendingSyncCharacterIds = new Set<string>();
  private readonly activeRouteWalksByActivityId = new Map<string, ActivityRouteWalk>();
  private readonly completedRouteWalkActivityIds = new Set<string>();
  private readonly routePresentationCharacterIdsByActivityId = new Map<string, readonly string[]>();
  private isWorldPaused = false;

  constructor(options: TownMovementCoordinatorOptions) {
    this.widget = options.widget;
    this.getCharacterSnapshot = options.getCharacterSnapshot;
    this.sendToCharacter = options.sendToCharacter;
    this.onActivityRouteCompleted = options.onActivityRouteCompleted;
  }

  dispose(): void {
    this.activeRouteWalksByActivityId.forEach(routeWalk => {
      this.stopJoggingRace(routeWalk);
      routeWalk.characterIds.forEach(characterId => this.widget.cancelWalk(characterId));
    });
    this.activeRouteWalksByActivityId.clear();
    this.completedRouteWalkActivityIds.clear();
    this.routePresentationCharacterIdsByActivityId.forEach(characterIds => {
      characterIds.forEach(characterId => {
        void this.widget.clearCharacterPresentationOffset(characterId, 0);
        this.widget.setCharacterTileOverlapOffsetSuppressed(characterId, false);
      });
    });
    this.routePresentationCharacterIdsByActivityId.clear();
    this.walkingCharacterIds.forEach(id => this.widget.cancelWalk(id));
    this.walkingCharacterIds.clear();
    this.visibleCharacterIds.clear();
    this.characterRenderDataById.clear();
    this.pendingSyncCharacterIds.clear();
  }

  startJoggingRoute(input: JoggingRouteInput): void {
    if (
      input.participantIds.length < MIN_JOGGING_ROUTE_PARTICIPANT_COUNT ||
      input.participantIds.length > MAX_JOGGING_ROUTE_PARTICIPANT_COUNT ||
      this.activeRouteWalksByActivityId.has(input.activityId) ||
      this.completedRouteWalkActivityIds.has(input.activityId)
    ) {
      return;
    }

    const routePlans = this.createJoggingRoutePlans(input);
    const routeWaypoints = routePlans?.[0]?.waypoints;

    if (!routePlans || !routeWaypoints) {
      return;
    }

    const routeWalk: ActivityRouteWalk = {
      activityId: input.activityId,
      characterIds: routePlans.map(plan => plan.characterId),
      waypoints: routeWaypoints,
      nextWaypointIndex: 0,
      pendingCharacterIds: new Set(),
      isRaceStarted: false,
      raceLeaderIndex: 0,
      raceSwapTimeoutId: null,
    };

    this.activeRouteWalksByActivityId.set(input.activityId, routeWalk);
    this.applyRoutePresentationOffsets(input.activityId, routePlans);
    this.sendRouteWalkToNextWaypoint(routeWalk);
  }

  startJoggingRace(activityId: string): void {
    const routeWalk = this.activeRouteWalksByActivityId.get(activityId);

    if (
      !routeWalk ||
      routeWalk.characterIds.length !== MAX_JOGGING_ROUTE_PARTICIPANT_COUNT ||
      routeWalk.isRaceStarted
    ) {
      return;
    }

    routeWalk.isRaceStarted = true;
    routeWalk.raceLeaderIndex = 0;
    this.applyJoggingRacePaces(routeWalk);
    this.scheduleJoggingRaceLeaderSwap(routeWalk, JOGGING_RACE_FIRST_SWAP_DELAY_MS);
  }

  cancelActivityRoute(
    activityId: string,
    options: CancelActivityRouteOptions = {},
  ): void {
    const routeWalk = this.activeRouteWalksByActivityId.get(activityId);
    const presentationCharacterIds = this.routePresentationCharacterIdsByActivityId.get(activityId);

    if (routeWalk) {
      this.activeRouteWalksByActivityId.delete(activityId);
      this.stopJoggingRace(routeWalk);
      routeWalk.characterIds.forEach(characterId => {
        const currentTile = this.widget.getCharacterTile(characterId);

        this.widget.cancelWalk(characterId);
        this.walkingCharacterIds.delete(characterId);

        if (currentTile) {
          this.sendToCharacter(characterId, {
            type: EventType.Arrive,
            position: currentTile,
          });
        }
      });
    }

    if (
      options.keepPairFinishFormation &&
      presentationCharacterIds?.length === MAX_JOGGING_ROUTE_PARTICIPANT_COUNT
    ) {
      this.applyJoggingFinishFormation(presentationCharacterIds);
    } else {
      presentationCharacterIds?.forEach(characterId => {
        void this.widget.clearCharacterPresentationOffset(characterId, 0);
        this.widget.setCharacterTileOverlapOffsetSuppressed(characterId, false);
      });
      this.routePresentationCharacterIdsByActivityId.delete(activityId);
    }

    if (options.forgetCompleted) {
      this.completedRouteWalkActivityIds.delete(activityId);
    }
  }

  pauseWorld(): void {
    if (this.isWorldPaused) {
      return;
    }

    this.isWorldPaused = true;
    this.widget.setWalkAnimationsPaused(true);
  }

  resumeWorld(): void {
    if (!this.isWorldPaused) {
      return;
    }

    this.isWorldPaused = false;
    this.widget.setWalkAnimationsPaused(false);

    const pendingCharacterIds = [...this.pendingSyncCharacterIds];

    this.pendingSyncCharacterIds.clear();
    pendingCharacterIds.forEach(characterId => {
      const snapshot = this.getCharacterSnapshot(characterId);

      if (snapshot) {
        this.syncCharacterWithWidget(characterId, snapshot);
      }
    });
  }

  pauseCharacterWalk(characterId: string, durationMs: number): void {
    if (!this.walkingCharacterIds.has(characterId)) {
      return;
    }

    const paused = this.widget.pauseWalk(characterId, durationMs);

    if (!paused) {
      this.walkingCharacterIds.delete(characterId);
    }
  }

  resumeCharacterWalk(characterId: string): void {
    this.widget.cancelWalk(characterId);
    this.walkingCharacterIds.delete(characterId);

    const snapshot = this.getCharacterSnapshot(characterId);

    if (!snapshot) {
      return;
    }

    this.syncCharacterWithWidget(characterId, snapshot);
  }

  registerCharacterRenderData(characterId: string, character: {
    color: string;
    label: string;
  }): void {
    this.characterRenderDataById.set(characterId, {
      color: character.color,
      label: character.label,
    });
  }

  placeCharacter(characterId: string, character: {
    position: Position;
    color: string;
    label: string;
  }, previousContext?: Pick<CharacterSnapshot['context'], 'position' | 'status'>): void {
    this.registerCharacterRenderData(characterId, character);

    const placed = this.widget.placeCharacter({
      id: characterId,
      x: previousContext?.position.x ?? character.position.x,
      y: previousContext?.position.y ?? character.position.y,
      color: character.color,
      label: character.label,
      expressionPresetId: previousContext?.status.expressionPresetId ?? DEFAULT_EXPRESSION_PRESET_ID,
    });

    if (placed) {
      this.visibleCharacterIds.add(characterId);
    }
  }

  resolveVisibleSpawnPosition(position: Position, fallbackPosition: Position): Position {
    if (this.isWalkablePosition(position)) {
      return { ...position };
    }

    const entrancePosition = TOWN_APARTMENT_ENTRANCE_TILES.find(tile => this.isWalkablePosition(tile));

    if (entrancePosition) {
      return { ...entrancePosition };
    }

    if (this.isWalkablePosition(fallbackPosition)) {
      return { ...fallbackPosition };
    }

    return { ...position };
  }

  syncCharacterWithWidget(characterId: string, snapshot: CharacterSnapshot): void {
    if (snapshot.context.presence.kind === 'contained') {
      this.cancelWalkIfNeeded(characterId);
      this.widget.removeCharacter(characterId);
      this.visibleCharacterIds.delete(characterId);
      return;
    }

    this.ensurePositionedCharacterVisible(characterId, snapshot);

    this.widget.updateCharacterStatus(characterId, getCharacterStatusText(snapshot));
    this.widget.updateCharacterExpressionPreset(characterId, snapshot.context.status.expressionPresetId);

    const summary = getCharacterStateSummary(snapshot.value);
    const target = snapshot.context.target;

    if (summary.bodyMove !== 'walking' || !target) {
      this.pendingSyncCharacterIds.delete(characterId);
      this.cancelWalkIfNeeded(characterId);
      return;
    }

    if (this.isWorldPaused) {
      this.pendingSyncCharacterIds.add(characterId);
      return;
    }

    this.pendingSyncCharacterIds.delete(characterId);

    if (this.walkingCharacterIds.has(characterId) && this.widget.isWalking(characterId)) {
      return;
    }

    this.walkingCharacterIds.delete(characterId);

    const currentPosition = this.widget.getCharacterTile(characterId) ?? snapshot.context.position;
    const path = this.widget.findPath(currentPosition, target);

    if (!path) {
      this.sendToCharacter(characterId, { type: EventType.MoveBlocked });
      return;
    }

    if (path.length === 0) {
      this.handleWalkArrived(characterId, target);
      return;
    }

    this.walkingCharacterIds.add(characterId);

    this.widget.walkCharacterAlongPath(
      characterId,
      path,
      arrivedPosition => this.handleWalkArrived(characterId, arrivedPosition),
      blockedPosition => this.handleWalkBlocked(characterId, blockedPosition),
    );
  }

  applyRuntimeSnapshot(snapshot: CharacterRuntimeSnapshot): void {
    this.cancelWalkIfNeeded(snapshot.id);

    if (snapshot.presence.kind === 'contained') {
      this.widget.removeCharacter(snapshot.id);
      this.visibleCharacterIds.delete(snapshot.id);
      return;
    }

    if (
      !this.visibleCharacterIds.has(snapshot.id) ||
      !this.widget.moveCharacter(snapshot.id, snapshot.position)
    ) {
      this.placePositionedRuntimeSnapshot(snapshot);
    }

    this.widget.updateCharacterStatus(snapshot.id, 'idle');
    this.widget.updateCharacterExpressionPreset(snapshot.id, snapshot.status.expressionPresetId);
  }

  private placePositionedRuntimeSnapshot(snapshot: CharacterRuntimeSnapshot): void {
    const renderData = this.characterRenderDataById.get(snapshot.id);
    const placed = this.widget.placeCharacter({
      id: snapshot.id,
      x: snapshot.position.x,
      y: snapshot.position.y,
      color: renderData?.color ?? '#f0cc5f',
      label: renderData?.label ?? snapshot.id,
      expressionPresetId: snapshot.status.expressionPresetId,
    });

    if (placed) {
      this.visibleCharacterIds.add(snapshot.id);
    }
  }

  private createJoggingRoutePlans(
    input: JoggingRouteInput,
  ): CharacterRoutePlan[] | null {
    const centerRouteWaypoints = this.resolveJoggingRouteWaypoints(input.location);

    if (!centerRouteWaypoints) {
      return null;
    }

    if (input.participantIds.length === 1) {
      return this.createJoggingRoutePlansFromWaypointSets(
        input.participantIds,
        [centerRouteWaypoints],
      );
    }

    return this.createVisualSideBySideJoggingRoutePlans(input, centerRouteWaypoints);
  }

  private createJoggingRoutePlansFromWaypointSets(
    participantIds: readonly string[],
    routeWaypointSets: readonly Position[][],
  ): CharacterRoutePlan[] | null {
    const routePlans = participantIds.map((characterId, index) => {
      const currentTile = this.widget.getCharacterTile(characterId);
      const routeWaypoints = routeWaypointSets[index];
      const routeStart = routeWaypoints?.[0];

      if (!currentTile || !routeStart) {
        return null;
      }

      if (!this.canReachRouteWaypoints(currentTile, routeWaypoints)) {
        return null;
      }

      return {
        characterId,
        waypoints: routeWaypoints,
      };
    });

    const validRoutePlans = routePlans.filter(isCharacterRoutePlan);

    if (validRoutePlans.length !== routePlans.length) {
      return null;
    }

    return validRoutePlans;
  }

  private createVisualSideBySideJoggingRoutePlans(
    input: JoggingRouteInput,
    centerRouteWaypoints: readonly Position[],
  ): CharacterRoutePlan[] | null {
    const routeStart = centerRouteWaypoints[0];
    const routeEnd = centerRouteWaypoints[centerRouteWaypoints.length - 1];

    if (!routeStart || !routeEnd) {
      return null;
    }

    const presentationOffsets = getSideBySideVisualOffsets(
      routeStart,
      centerRouteWaypoints[1] ?? routeEnd,
    );
    const routePlans = input.participantIds.map((characterId, index) => {
      const currentTile = this.widget.getCharacterTile(characterId);

      if (!currentTile) {
        return null;
      }

      if (!this.canReachRouteWaypoints(currentTile, centerRouteWaypoints)) {
        return null;
      }

      return {
        characterId,
        waypoints: centerRouteWaypoints,
        presentationOffsetCells: presentationOffsets[index],
      };
    });
    const validRoutePlans = routePlans.filter(isCharacterRoutePlan);

    if (validRoutePlans.length !== routePlans.length) {
      return null;
    }

    return validRoutePlans;
  }

  private resolveJoggingRouteWaypoints(location: Position): Position[] | null {
    const joggingTiles = DESTINATION_MAP.jogging.flatMap(destination => destination.serviceTiles);
    const routeColumns = getUniqueSortedNumbers(joggingTiles.map(tile => tile.x));
    const routeRows = getUniqueSortedNumbers(joggingTiles.map(tile => tile.y));
    const turnColumn = getFarthestNumber(routeColumns, location.x);
    const turnRow = getFarthestNumber(routeRows, location.y);
    const finishColumnCandidates = routeColumns.filter(column => column !== turnColumn);
    const finishColumn = getFarthestNumber(finishColumnCandidates, turnColumn);

    if (turnColumn === null || turnRow === null || finishColumn === null) {
      return null;
    }

    return dedupeConsecutivePositions([
      { ...location },
      { x: turnColumn, y: location.y },
      { x: turnColumn, y: turnRow },
      { x: finishColumn, y: turnRow },
    ]);
  }

  private canReachRouteWaypoints(
    currentTile: Position,
    routeWaypoints: readonly Position[],
  ): boolean {
    if (routeWaypoints.length === 0) {
      return false;
    }

    const routePoints = [currentTile, ...routeWaypoints];

    for (let index = 0; index < routePoints.length - 1; index++) {
      if (!this.widget.findPath(routePoints[index], routePoints[index + 1])) {
        return false;
      }
    }

    return true;
  }

  private applyRoutePresentationOffsets(
    activityId: string,
    routePlans: readonly CharacterRoutePlan[],
  ): void {
    const offsetPlans = routePlans.filter(hasPresentationOffset);

    if (offsetPlans.length === 0) {
      return;
    }

    this.routePresentationCharacterIdsByActivityId.set(
      activityId,
      offsetPlans.map(plan => plan.characterId),
    );
    offsetPlans.forEach(plan => {
      this.widget.setCharacterTileOverlapOffsetSuppressed(plan.characterId, true);
      void this.widget.setCharacterPresentationOffsetInCells(
        plan.characterId,
        plan.presentationOffsetCells,
        JOGGING_ROUTE_OFFSET_TRANSITION_MS,
      );
    });
  }

  private applyRoutePresentationOffsetsForSegment(
    routeWalk: ActivityRouteWalk,
    waypointIndex: number,
  ): void {
    if (
      routeWalk.characterIds.length !== MAX_JOGGING_ROUTE_PARTICIPANT_COUNT ||
      !this.routePresentationCharacterIdsByActivityId.has(routeWalk.activityId)
    ) {
      return;
    }

    const segmentStart = waypointIndex === 0
      ? routeWalk.waypoints[0]
      : routeWalk.waypoints[waypointIndex - 1];
    const segmentEnd = waypointIndex === 0
      ? routeWalk.waypoints[1]
      : routeWalk.waypoints[waypointIndex];

    if (!segmentStart || !segmentEnd || areSamePosition(segmentStart, segmentEnd)) {
      return;
    }

    const offsets = getSideBySideVisualOffsets(segmentStart, segmentEnd);

    routeWalk.characterIds.forEach((characterId, index) => {
      const offset = offsets[index];

      if (offset) {
        void this.widget.setCharacterPresentationOffsetInCells(
          characterId,
          offset,
          JOGGING_ROUTE_OFFSET_TRANSITION_MS,
        );
      }
    });
  }

  private applyJoggingRacePaces(routeWalk: ActivityRouteWalk): void {
    routeWalk.characterIds.forEach((characterId, index) => {
      this.widget.setCharacterWalkSpeedMultiplier(
        characterId,
        index === routeWalk.raceLeaderIndex
          ? JOGGING_RACE_FAST_SPEED_MULTIPLIER
          : JOGGING_RACE_SLOW_SPEED_MULTIPLIER,
      );
    });
  }

  private applyJoggingFinishFormation(characterIds: readonly string[]): void {
    const finishOffsets = getJoggingFinishVisualOffsets();

    characterIds.forEach((characterId, index) => {
      const offset = finishOffsets[index];

      if (offset) {
        void this.widget.setCharacterPresentationOffsetInCells(
          characterId,
          offset,
          JOGGING_ROUTE_OFFSET_TRANSITION_MS,
        );
      }
    });
  }

  private scheduleJoggingRaceLeaderSwap(
    routeWalk: ActivityRouteWalk,
    delayMs: number,
  ): void {
    routeWalk.raceSwapTimeoutId = setTimeout(() => {
      routeWalk.raceSwapTimeoutId = null;

      if (
        this.activeRouteWalksByActivityId.get(routeWalk.activityId) !== routeWalk ||
        !routeWalk.isRaceStarted
      ) {
        return;
      }

      routeWalk.raceLeaderIndex = routeWalk.raceLeaderIndex === 0 ? 1 : 0;
      this.applyJoggingRacePaces(routeWalk);
      this.scheduleJoggingRaceLeaderSwap(routeWalk, JOGGING_RACE_SWAP_INTERVAL_MS);
    }, delayMs);
  }

  private stopJoggingRace(routeWalk: ActivityRouteWalk): void {
    if (routeWalk.raceSwapTimeoutId !== null) {
      clearTimeout(routeWalk.raceSwapTimeoutId);
      routeWalk.raceSwapTimeoutId = null;
    }

    routeWalk.isRaceStarted = false;
    routeWalk.characterIds.forEach(characterId => {
      this.widget.clearCharacterWalkSpeedMultiplier(characterId);
    });
  }

  private sendRouteWalkToNextWaypoint(routeWalk: ActivityRouteWalk): void {
    if (this.activeRouteWalksByActivityId.get(routeWalk.activityId) !== routeWalk) {
      return;
    }

    while (routeWalk.nextWaypointIndex < routeWalk.waypoints.length) {
      const waypointIndex = routeWalk.nextWaypointIndex;
      const target = routeWalk.waypoints[waypointIndex];

      routeWalk.nextWaypointIndex += 1;

      const pendingCharacterIds = routeWalk.characterIds.filter(characterId => (
        !this.isCharacterAlreadyAtRouteTarget(characterId, target)
      ));

      if (pendingCharacterIds.length === 0) {
        continue;
      }

      routeWalk.pendingCharacterIds = new Set(pendingCharacterIds);
      this.applyRoutePresentationOffsetsForSegment(routeWalk, waypointIndex);
      pendingCharacterIds.forEach(characterId => {
        this.sendToCharacter(characterId, {
          type: EventType.MoveTo,
          target,
        });
      });
      return;
    }

    this.completeActivityRoute(routeWalk);
  }

  private markRouteCharacterAtWaypoint(
    routeWalk: ActivityRouteWalk,
    characterId: string,
  ): void {
    if (
      this.activeRouteWalksByActivityId.get(routeWalk.activityId) !== routeWalk ||
      !routeWalk.pendingCharacterIds.delete(characterId) ||
      routeWalk.pendingCharacterIds.size > 0
    ) {
      return;
    }

    this.sendRouteWalkToNextWaypoint(routeWalk);
  }

  private completeActivityRoute(routeWalk: ActivityRouteWalk): void {
    if (this.activeRouteWalksByActivityId.get(routeWalk.activityId) !== routeWalk) {
      return;
    }

    this.stopJoggingRace(routeWalk);
    this.activeRouteWalksByActivityId.delete(routeWalk.activityId);
    this.completedRouteWalkActivityIds.add(routeWalk.activityId);
    this.onActivityRouteCompleted?.(routeWalk.activityId);
  }

  private getActiveRouteWalkForCharacter(characterId: string): ActivityRouteWalk | null {
    for (const routeWalk of this.activeRouteWalksByActivityId.values()) {
      if (routeWalk.characterIds.includes(characterId)) {
        return routeWalk;
      }
    }

    return null;
  }

  private isCharacterAlreadyAtRouteTarget(characterId: string, target: Position): boolean {
    const currentPosition = this.widget.getCharacterTile(characterId)
      ?? this.getCharacterSnapshot(characterId)?.context.position;

    return currentPosition ? areSamePosition(currentPosition, target) : false;
  }

  private handleWalkArrived(characterId: string, arrivedPosition: Position): void {
    this.walkingCharacterIds.delete(characterId);
    const routeWalk = this.getActiveRouteWalkForCharacter(characterId);

    if (routeWalk) {
      this.sendToCharacter(characterId, { type: EventType.Arrive, position: arrivedPosition });
      this.markRouteCharacterAtWaypoint(routeWalk, characterId);
      return;
    }

    const context = this.getCharacterSnapshot(characterId)?.context;
    const motivation = context?.currentMotivation ?? '';

    this.sendToCharacter(characterId, { type: EventType.Arrive, position: arrivedPosition });

    if (this.enterApartmentIfGoingHome(characterId, motivation)) {
      return;
    }
  }

  private handleWalkBlocked(characterId: string, blockedPosition: Position): void {
    this.walkingCharacterIds.delete(characterId);
    const routeWalk = this.getActiveRouteWalkForCharacter(characterId);

    if (routeWalk) {
      this.sendToCharacter(characterId, { type: EventType.Arrive, position: blockedPosition });
      this.markRouteCharacterAtWaypoint(routeWalk, characterId);
      return;
    }

    this.sendToCharacter(characterId, { type: EventType.MoveBlocked, position: blockedPosition });
  }

  private ensurePositionedCharacterVisible(characterId: string, snapshot: CharacterSnapshot): void {
    if (this.visibleCharacterIds.has(characterId)) {
      return;
    }

    const renderData = this.characterRenderDataById.get(characterId);
    const placed = this.widget.placeCharacter({
      id: characterId,
      x: snapshot.context.position.x,
      y: snapshot.context.position.y,
      color: renderData?.color ?? '#f0cc5f',
      label: renderData?.label ?? snapshot.context.name,
      expressionPresetId: snapshot.context.status.expressionPresetId,
    });

    if (placed) {
      this.visibleCharacterIds.add(characterId);
    }
  }

  private isWalkablePosition(position: Position): boolean {
    return this.widget.getCell(position.x, position.y)?.walkable === true;
  }

  private enterApartmentIfGoingHome(characterId: string, motivation: string): boolean {
    if (motivation !== 'goHome') {
      return false;
    }

    this.sendToCharacter(characterId, {
      type: EventType.EnterApartment,
      apartmentSpaceId: TOWN_APARTMENT_SPACE_ID,
    });
    return true;
  }

  private cancelWalkIfNeeded(characterId: string): void {
    if (!this.walkingCharacterIds.has(characterId)) {
      return;
    }

    this.widget.cancelWalk(characterId);
    this.walkingCharacterIds.delete(characterId);
  }
}

function getCharacterStatusText(snapshot: CharacterSnapshot): string {
  const behaviorId = snapshot.context.currentBehavior?.id;

  if (!behaviorId) {
    return snapshot.context.currentMotivation;
  }

  return CHARACTER_BEHAVIOR_DEFINITIONS_BY_ID[behaviorId]?.label ?? behaviorId;
}

function isCharacterRoutePlan(plan: CharacterRoutePlan | null): plan is CharacterRoutePlan {
  return plan !== null;
}

function hasPresentationOffset(
  plan: CharacterRoutePlan,
): plan is CharacterRoutePlan & { presentationOffsetCells: Position } {
  return plan.presentationOffsetCells !== undefined;
}

function getSideBySideVisualOffsets(from: Position, to: Position): [Position, Position] {
  const isHorizontalRoute = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y);

  if (isHorizontalRoute) {
    const direction = Math.sign(to.x - from.x) || 1;

    return [
      {
        x: -JOGGING_HORIZONTAL_STAGGER_OFFSET_CELLS * direction,
        y: -JOGGING_HORIZONTAL_SIDE_OFFSET_CELLS,
      },
      {
        x: JOGGING_HORIZONTAL_STAGGER_OFFSET_CELLS * direction,
        y: JOGGING_HORIZONTAL_SIDE_OFFSET_CELLS,
      },
    ];
  }

  return [
    { x: -JOGGING_VERTICAL_SIDE_OFFSET_CELLS, y: 0 },
    { x: JOGGING_VERTICAL_SIDE_OFFSET_CELLS, y: 0 },
  ];
}

function getJoggingFinishVisualOffsets(): [Position, Position] {
  return [
    { x: -JOGGING_FINISH_X_OFFSET_CELLS, y: -JOGGING_FINISH_Y_OFFSET_CELLS },
    { x: JOGGING_FINISH_X_OFFSET_CELLS, y: JOGGING_FINISH_Y_OFFSET_CELLS },
  ];
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
