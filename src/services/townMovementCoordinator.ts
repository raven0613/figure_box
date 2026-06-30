import type { Position } from '~/constants/character';
import { CHARACTER_BEHAVIOR_DEFINITIONS_BY_ID } from '~/constants/characterBehaviorDefinitions';
import { DEFAULT_EXPRESSION_PRESET_ID } from '~/constants/expressionCatalog';
import { TOWN_APARTMENT_ENTRANCE_TILES, TOWN_APARTMENT_SPACE_ID } from '~/constants/townMap';
import { getCharacterStateSummary } from '~/stateMachines/gameFlow/children/character';
import { EventType } from '~/stateMachines/gameFlow/events';
import type { CharacterSnapshot, SendCharacterEvent } from '~/services/townCharacterTypes';
import type { CharacterRuntimeSnapshot } from '~/services/save/saveTypes';
import type { FabricTownMapWidget } from '~/widgets/fabricTownMapWidget';

interface TownMovementCoordinatorOptions {
  widget: FabricTownMapWidget;
  getCharacterSnapshot: (characterId: string) => CharacterSnapshot | null;
  sendToCharacter: SendCharacterEvent;
}

// 角色放置、走路同步、路徑 blocked/arrived
export class TownMovementCoordinator {
  private readonly widget: FabricTownMapWidget;
  private readonly getCharacterSnapshot: (characterId: string) => CharacterSnapshot | null;
  private readonly sendToCharacter: SendCharacterEvent;
  private readonly walkingCharacterIds = new Set<string>();
  private readonly visibleCharacterIds = new Set<string>();
  private readonly characterRenderDataById = new Map<string, {
    color: string;
    label: string;
  }>();
  private readonly pendingSyncCharacterIds = new Set<string>();
  private isWorldPaused = false;

  constructor(options: TownMovementCoordinatorOptions) {
    this.widget = options.widget;
    this.getCharacterSnapshot = options.getCharacterSnapshot;
    this.sendToCharacter = options.sendToCharacter;
  }

  dispose(): void {
    this.walkingCharacterIds.forEach(id => this.widget.cancelWalk(id));
    this.walkingCharacterIds.clear();
    this.visibleCharacterIds.clear();
    this.characterRenderDataById.clear();
    this.pendingSyncCharacterIds.clear();
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
      this.sendToCharacter(characterId, { type: EventType.Arrive, position: target });
      this.enterApartmentIfGoingHome(characterId, snapshot.context.currentMotivation);
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

  private handleWalkArrived(characterId: string, arrivedPosition: Position): void {
    this.walkingCharacterIds.delete(characterId);

    const context = this.getCharacterSnapshot(characterId)?.context;
    const motivation = context?.currentMotivation ?? '';

    this.sendToCharacter(characterId, { type: EventType.Arrive, position: arrivedPosition });

    if (this.enterApartmentIfGoingHome(characterId, motivation)) {
      return;
    }
  }

  private handleWalkBlocked(characterId: string, blockedPosition: Position): void {
    this.walkingCharacterIds.delete(characterId);
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
