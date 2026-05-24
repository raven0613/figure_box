import { Expression, type Position } from '~/constants/character';
import { TOWN_APARTMENT_SPACE_ID } from '~/constants/townMap';
import { getCharacterStateSummary } from '~/stateMachines/gameFlow/children/character';
import { EventType } from '~/stateMachines/gameFlow/events';
import type { CharacterSnapshot, SendCharacterEvent } from '~/services/townCharacterTypes';
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

  placeCharacter(characterId: string, character: {
    position: Position;
    color: string;
    label: string;
  }, previousContext?: CharacterSnapshot['context']): void {
    this.characterRenderDataById.set(characterId, {
      color: character.color,
      label: character.label,
    });

    const placed = this.widget.placeCharacter({
      id: characterId,
      x: previousContext?.position.x ?? character.position.x,
      y: previousContext?.position.y ?? character.position.y,
      color: character.color,
      label: character.label,
      expression: previousContext?.status.expression ?? Expression.Normal,
    });

    if (placed) {
      this.visibleCharacterIds.add(characterId);
    }
  }

  syncCharacterWithWidget(characterId: string, snapshot: CharacterSnapshot): void {
    if (snapshot.context.presence.kind === 'contained') {
      this.cancelWalkIfNeeded(characterId);
      this.widget.removeCharacter(characterId);
      this.visibleCharacterIds.delete(characterId);
      return;
    }

    this.ensurePositionedCharacterVisible(characterId, snapshot);

    this.widget.updateCharacterStatus(characterId, snapshot.context.currentMotivation);
    this.widget.updateCharacterExpression(characterId, snapshot.context.status.expression);

    const summary = getCharacterStateSummary(snapshot.value);
    const target = snapshot.context.target;

    if (summary.bodyMove !== 'walking' || !target) {
      this.cancelWalkIfNeeded(characterId);
      return;
    }

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
      expression: snapshot.context.status.expression,
    });

    if (placed) {
      this.visibleCharacterIds.add(characterId);
    }
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
