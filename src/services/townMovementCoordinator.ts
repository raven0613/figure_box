import { Expression, type Position } from '~/constants/character';
import { DESTINATION_MAP } from '~/constants/townMap';
import { getCharacterStateSummary } from '~/stateMachines/gameFlow/children/character';
import { EventType } from '~/stateMachines/gameFlow/events';
import type { CharacterSnapshot, SendCharacterEvent } from '~/services/townCharacterTypes';
import type { FabricTownMapWidget } from '~/widgets/fabricTownMapWidget';
import type { GridCoordinate } from '~/widgets/townMapGrid';

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

  constructor(options: TownMovementCoordinatorOptions) {
    this.widget = options.widget;
    this.getCharacterSnapshot = options.getCharacterSnapshot;
    this.sendToCharacter = options.sendToCharacter;
  }

  dispose(): void {
    this.walkingCharacterIds.forEach(id => this.widget.cancelWalk(id));
    this.walkingCharacterIds.clear();
  }

  placeCharacter(characterId: string, character: {
    position: Position;
    color: string;
    label: string;
  }, previousContext?: CharacterSnapshot['context']): void {
    this.widget.placeCharacter({
      id: characterId,
      x: previousContext?.position.x ?? character.position.x,
      y: previousContext?.position.y ?? character.position.y,
      color: character.color,
      label: character.label,
      expression: previousContext?.status.expression ?? Expression.Normal,
    });
  }

  syncCharacterWithWidget(characterId: string, snapshot: CharacterSnapshot): void {
    this.widget.updateCharacterStatus(characterId, snapshot.context.currentMotivation);
    this.widget.updateCharacterExpression(characterId, snapshot.context.status.expression);

    const summary = getCharacterStateSummary(snapshot.value);
    const target = snapshot.context.target;

    if (summary.bodyMove !== 'walking' || !target) {
      this.cancelWalkIfNeeded(characterId);
      return;
    }

    if (this.walkingCharacterIds.has(characterId)) {
      return;
    }

    const currentPosition = snapshot.context.position;
    const path = this.widget.findPath(currentPosition, target, characterId);

    if (!path) {
      this.sendToCharacter(characterId, { type: EventType.MoveBlocked });
      return;
    }

    if (path.length === 0) {
      this.sendToCharacter(characterId, { type: EventType.Arrive, position: target });
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

    if (context?.currentActivity || !DESTINATION_MAP[motivation]) {
      return;
    }

    const dispersalTarget = this.findNearbyEmptyTile(arrivedPosition, characterId, 4);

    if (dispersalTarget) {
      this.sendToCharacter(characterId, { type: EventType.MoveTo, target: dispersalTarget });
    }
  }

  private handleWalkBlocked(characterId: string, blockedPosition: Position): void {
    this.walkingCharacterIds.delete(characterId);
    this.sendToCharacter(characterId, { type: EventType.MoveBlocked, position: blockedPosition });
  }

  private cancelWalkIfNeeded(characterId: string): void {
    if (!this.walkingCharacterIds.has(characterId)) {
      return;
    }

    this.widget.cancelWalk(characterId);
    this.walkingCharacterIds.delete(characterId);
  }

  findNearbyEmptyTile(position: Position, occupantId: string, range: number): GridCoordinate | null {
    const neighbors = this.widget.getNeighbors(position.x, position.y, range);
    const candidates = neighbors.filter(tile =>
      tile.cell.walkable && (!tile.cell.occupantId || tile.cell.occupantId === occupantId)
    );

    if (candidates.length === 0) {
      return null;
    }

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    return { x: chosen.x, y: chosen.y };
  }
}
