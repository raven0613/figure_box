import { createActor, type ActorRefFrom, type SnapshotFrom } from 'xstate';
import { CHARACTER_SEEDS, Expression, type Position } from '~/constants/character';
import { DESTINATION_MAP } from '~/constants/townMap';
import {
  characterMachine,
  getCharacterStateSummary,
} from '~/stateMachines/gameFlow/children/character';
import {
  CHARACTER_EVENT_DEFINITIONS_BY_ID,
  type CharacterEventActivity,
  type CharacterEventDefinition,
} from '~/services/characterEvents/definitions';
import {
  CharacterPerformanceRunner,
  type CharacterPerformanceBubble,
  type CharacterPerformanceSelection,
} from '~/services/characterEvents/characterPerformanceRunner';
import { shouldAcceptInteraction } from '~/services/characterEvents/interactionAcceptance';
import { canStartInteractionWithTarget } from '~/services/characterEvents/interactionCooldowns';
import {
  createJoinableActivityManager,
  type JoinableActivity,
  type JoinableActivityManager,
} from '~/services/characterEvents/joinableActivities';
import {
  type CharacterPerformancePhase,
  type CharacterPerformanceTarget,
} from '~/services/characterEvents/performances';
import { EventType, type CharacterEvent } from '~/stateMachines/gameFlow/events';
import {
  createRelationshipStore,
  recordPassByPair,
  type RelationshipStore,
} from '~/stateMachines/gameFlow/relationships';
import type { EventDialoguePresentation } from '~/typing/eventDialoguePresentation';
import type { FabricTownMapWidget } from '~/widgets/fabricTownMapWidget';
import type { GridCoordinate } from '~/widgets/townMapGrid';

type CharacterActor = ActorRefFrom<typeof characterMachine>;
type CharacterSeed = typeof CHARACTER_SEEDS[number];
type Subscription = {
  unsubscribe: () => void;
};
type InteractionAcceptanceDecision =
  | { accepted: true }
  | { accepted: false; reason: 'busy' | 'mood' };

export type CharacterSnapshot = SnapshotFrom<typeof characterMachine>;

const INITIAL_DECISION_STAGGER_MIN_MS = 500;
const INITIAL_DECISION_STAGGER_MAX_MS = 4500;
const DECISION_INTERVAL_MIN_MS = 2500;
const DECISION_INTERVAL_MAX_MS = 5500;
const CHAT_INTERACTION_DURATION_MS = 20000;

interface TownCharacterControllerOptions {
  widget: FabricTownMapWidget;
  onCharacterSnapshot?: (characterId: string, snapshot: CharacterSnapshot) => void;
  onRelationshipStoreChange?: (relationshipStore: RelationshipStore) => void;
  onJoinableActivitiesChange?: (activities: readonly JoinableActivity[]) => void;
}

export class TownCharacterController {
  private readonly widget: FabricTownMapWidget;
  private readonly characterActors = new Map<string, CharacterActor>();
  private readonly characterSubscriptions = new Map<string, Subscription>();
  private readonly walkingCharacterIds = new Set<string>();
  private readonly processedInteractionProposalIds = new Set<string>();
  private readonly chatEndTimers = new Map<string, number>();
  private readonly playStartTimers = new Map<string, number>();
  private readonly playEndTimers = new Map<string, number>();
  private readonly performanceRunner: CharacterPerformanceRunner;
  private readonly activityManager: JoinableActivityManager;
  private readonly nextDecisionAtByCharacterId = new Map<string, number>();
  private relationshipStore = createRelationshipStore();
  private tickTimer: number | null = null;
  private readonly onCharacterSnapshot?: (characterId: string, snapshot: CharacterSnapshot) => void;
  private readonly onRelationshipStoreChange?: (relationshipStore: RelationshipStore) => void;
  private readonly onJoinableActivitiesChange?: (activities: readonly JoinableActivity[]) => void;

  constructor(options: TownCharacterControllerOptions) {
    this.widget = options.widget;
    this.activityManager = createJoinableActivityManager();
    this.performanceRunner = new CharacterPerformanceRunner({
      setCharacterExpression: (characterId, expression) => {
        this.setCharacterExpression(characterId, expression);
      },
      showCharacterEmote: (characterId, text, durationMs) => {
        this.widget.showCharacterEmote(characterId, text, durationMs);
      },
      showMapActivity: (activity, durationMs) => {
        this.widget.showMapActivity(activity, durationMs);
      },
    });
    this.onCharacterSnapshot = options.onCharacterSnapshot;
    this.onRelationshipStoreChange = options.onRelationshipStoreChange;
    this.onJoinableActivitiesChange = options.onJoinableActivitiesChange;
  }

  start(): void {
    CHARACTER_SEEDS.forEach(character => {
      this.spawnCharacterActor(character);
    });
    this.tickTimer = window.setInterval(() => {
      this.tick();
    }, 1000);
  }

  showMapDialoguePresentation(presentation: EventDialoguePresentation): (() => void) | undefined {
    if (presentation.activity) {
      this.widget.showMapActivity(presentation.activity);
    }

    if (!presentation.bubbleSequence) {
      return undefined;
    }

    return this.widget.playMapBubbleSequence(presentation.bubbleSequence, line => {
      if (line.expression) {
        this.setCharacterExpression(line.characterId, line.expression);
      }
    });
  }

  pickUpCharacter(characterId: string): void {
    if (this.isCharacterBodyFrozen(characterId)) {
      this.widget.showCharacterBubble(characterId, '對話中...');
      return;
    }

    this.sendToCharacter(characterId, { type: EventType.PickUp });
  }

  dropCharacter(characterId: string, tile: GridCoordinate | null): void {
    const actor = this.characterActors.get(characterId);

    if (!actor) {
      return;
    }

    if (this.isCharacterBodyFrozen(characterId)) {
      this.widget.showCharacterBubble(characterId, '等一下...');
      return;
    }

    if (tile && this.widget.moveCharacter(characterId, tile)) {
      this.sendToCharacter(characterId, { type: EventType.Drop, position: tile });
      return;
    }

    this.sendToCharacter(characterId, { type: EventType.Drop });
  }

  setCharacterExpression(characterId: string, expression: Expression): void {
    this.sendToCharacter(characterId, {
      type: EventType.SetExpression,
      expression,
    });
  }

  dispose(): void {
    if (this.tickTimer !== null) {
      window.clearInterval(this.tickTimer);
      this.tickTimer = null;
    }

    this.walkingCharacterIds.forEach(id => this.widget.cancelWalk(id));
    this.walkingCharacterIds.clear();
    this.chatEndTimers.forEach(timerId => window.clearTimeout(timerId));
    this.chatEndTimers.clear();
    this.playStartTimers.forEach(timerId => window.clearTimeout(timerId));
    this.playStartTimers.clear();
    this.playEndTimers.forEach(timerId => window.clearTimeout(timerId));
    this.playEndTimers.clear();
    this.performanceRunner.dispose();
    this.activityManager.clear();
    this.processedInteractionProposalIds.clear();
    this.nextDecisionAtByCharacterId.clear();

    this.characterSubscriptions.forEach(subscription => {
      subscription.unsubscribe();
    });
    this.characterSubscriptions.clear();

    this.characterActors.forEach(actor => {
      actor.stop();
    });
    this.characterActors.clear();

    this.relationshipStore = createRelationshipStore();
    this.onRelationshipStoreChange?.(this.relationshipStore);
    this.notifyJoinableActivitiesChanged();
  }

  private spawnCharacterActor(character: CharacterSeed, previousActor?: CharacterActor): CharacterActor {
    this.characterSubscriptions.get(character.id)?.unsubscribe();

    const previousContext = previousActor?.getSnapshot().context;
    const now = Date.now();

    if (!this.nextDecisionAtByCharacterId.has(character.id)) {
      this.nextDecisionAtByCharacterId.set(character.id, now + randomBetween(
        INITIAL_DECISION_STAGGER_MIN_MS,
        INITIAL_DECISION_STAGGER_MAX_MS,
      ));
    }

    this.widget.placeCharacter({
      id: character.id,
      x: previousContext?.position.x ?? character.position.x,
      y: previousContext?.position.y ?? character.position.y,
      color: character.color,
      label: character.label,
      expression: previousContext?.status.expression ?? Expression.Normal,
    });

    const actor = createActor(characterMachine, {
      input: {
        id: character.id,
        name: character.name,
        position: previousContext?.position ?? character.position,
        saturation: previousContext?.status.saturation ?? character.saturation,
        relationships: previousContext?.relationships,
      },
    });

    this.characterActors.set(character.id, actor);

    const subscription = actor.subscribe(snapshot => {
      this.onCharacterSnapshot?.(character.id, snapshot);
      this.syncCharacterWithWidget(character.id, snapshot);
      this.handlePendingInteractionProposal(character.id, snapshot);
      this.handlePendingActivityJoin(character.id, snapshot);
    });

    actor.start();
    this.characterSubscriptions.set(character.id, subscription);
    return actor;
  }

  private syncCharacterWithWidget(characterId: string, snapshot: CharacterSnapshot): void {
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
      arrivedPosition => {
        this.walkingCharacterIds.delete(characterId);
        const actor = this.characterActors.get(characterId);
        const motivation = actor?.getSnapshot().context.currentMotivation ?? '';

        this.sendToCharacter(characterId, { type: EventType.Arrive, position: arrivedPosition });

        if (DESTINATION_MAP[motivation]) {
          const dispersalTarget = this.findNearbyEmptyTile(arrivedPosition, characterId, 4);

          if (dispersalTarget) {
            this.sendToCharacter(characterId, { type: EventType.MoveTo, target: dispersalTarget });
          }
        }
      },
      blockedPosition => {
        this.walkingCharacterIds.delete(characterId);
        this.sendToCharacter(characterId, { type: EventType.MoveBlocked, position: blockedPosition });
      },
    );
  }

  private tick(): void {
    const timestamp = Date.now();

    CHARACTER_SEEDS.forEach(character => {
      const actor = this.characterActors.get(character.id);

      if (!actor || actor.getSnapshot().status !== 'active') {
        this.spawnCharacterActor(character, actor);
      }

      const allowAutonomousDecision = this.canCharacterDecideNow(character.id, timestamp);

      this.sendToCharacter(character.id, {
        type: EventType.Tick,
        nearbyCharacterIds: this.getNearbyCharacterIds(character.id, 2),
        nearbyJoinableActivities: this.getNearbyJoinableActivities(character.id, timestamp, 3),
        timestamp,
        allowAutonomousDecision,
      });
    });

    this.relationshipStore = this.triggerPassByRelationships(timestamp);
    this.onRelationshipStoreChange?.(this.relationshipStore);
    this.pruneEndedActivities(timestamp);
  }

  private canCharacterDecideNow(characterId: string, timestamp: number): boolean {
    const nextDecisionAt = this.nextDecisionAtByCharacterId.get(characterId) ?? timestamp;

    if (timestamp < nextDecisionAt) {
      return false;
    }

    this.nextDecisionAtByCharacterId.set(characterId, timestamp + randomBetween(
      DECISION_INTERVAL_MIN_MS,
      DECISION_INTERVAL_MAX_MS,
    ));
    return true;
  }

  private triggerPassByRelationships(timestamp: number): RelationshipStore {
    let nextRelationshipStore = this.relationshipStore;
    const processedPairs = new Set<string>();

    this.characterActors.forEach((_actor, characterId) => {
      const tile = this.widget.getCharacterTile(characterId);

      if (!tile) {
        return;
      }

      const nearbyIds = this.widget.getOccupiedNeighborIds(tile.x, tile.y, 2, characterId);

      nearbyIds.forEach(targetCharId => {
        const pairKey = characterId < targetCharId
          ? `${characterId}::${targetCharId}`
          : `${targetCharId}::${characterId}`;

        if (processedPairs.has(pairKey)) {
          return;
        }

        processedPairs.add(pairKey);

        this.sendToCharacter(characterId, { type: EventType.PassBy, targetCharId, timestamp });
        this.sendToCharacter(targetCharId, { type: EventType.PassBy, targetCharId: characterId, timestamp });

        nextRelationshipStore = recordPassByPair(
          nextRelationshipStore,
          characterId,
          targetCharId,
          timestamp,
        );
      });
    });

    return nextRelationshipStore;
  }

  private handlePendingInteractionProposal(characterId: string, snapshot: CharacterSnapshot): void {
    const proposal = snapshot.context.pendingInteractionProposal;

    if (!proposal || this.processedInteractionProposalIds.has(proposal.id)) {
      return;
    }

    this.processedInteractionProposalIds.add(proposal.id);

    if (proposal.type !== 'chat') {
      if (proposal.type === 'play') {
        this.handlePlayProposal(characterId, snapshot);
      }
      return;
    }

    const initiatorName = snapshot.context.name;
    const targetName = this.getCharacterName(proposal.targetCharId);
    const proposalBubble = this.getInteractionBubble(
      snapshot,
      'proposal',
      'initiator',
      '{initiator}：要不要聊一下？',
      3200,
      initiatorName,
      targetName,
    );

    const acceptanceDecision = this.evaluateChatProposal(proposal.targetCharId, characterId, proposal.sourceEventId);

    if (acceptanceDecision.accepted) {
      this.sendToCharacter(characterId, {
        type: EventType.ChatProposalAccepted,
        targetCharId: proposal.targetCharId,
        proposalId: proposal.id,
        sourceEventId: proposal.sourceEventId,
      });
      this.sendToCharacter(proposal.targetCharId, {
        type: EventType.AcceptChatProposal,
        fromCharacterId: characterId,
        proposalId: proposal.id,
        sourceEventId: proposal.sourceEventId,
      });
      this.playNonBubblePerformanceSteps(snapshot, 'proposal', characterId, proposal.targetCharId);
      this.playNonBubblePerformanceSteps(snapshot, 'accepted', characterId, proposal.targetCharId);
      const acceptedBubble = this.getInteractionBubble(
        snapshot,
        'accepted',
        'target',
        '{target}：好啊。',
        3200,
        initiatorName,
        targetName,
      );
      this.widget.showCharacterBubble(characterId, proposalBubble.text, proposalBubble.durationMs);
      this.widget.showCharacterBubble(proposal.targetCharId, acceptedBubble.text, acceptedBubble.durationMs);
      this.scheduleChatEnd(proposal.id, characterId, proposal.targetCharId);
      return;
    }

    const rejectedAt = Date.now();
    this.sendToCharacter(characterId, {
      type: EventType.ChatProposalRejected,
      targetCharId: proposal.targetCharId,
      proposalId: proposal.id,
      timestamp: rejectedAt,
    });
    this.sendToCharacter(proposal.targetCharId, {
      type: EventType.RecordInteractionCooldown,
      interactionType: 'chat',
      partnerCharId: characterId,
      proposalId: proposal.id,
      role: 'target',
      sourceEventId: proposal.sourceEventId,
      timestamp: rejectedAt,
    });
    const rejectedPhase = getRejectedPerformancePhase(acceptanceDecision.reason);
    this.playNonBubblePerformanceSteps(snapshot, 'proposal', characterId, proposal.targetCharId);
    this.playNonBubblePerformanceSteps(snapshot, rejectedPhase, characterId, proposal.targetCharId);
    const rejectedBubble = this.getInteractionBubble(
      snapshot,
      rejectedPhase,
      'target',
      acceptanceDecision.reason === 'busy'
        ? '{target}：抱歉，現在有事。'
        : '{target}：現在有點不想聊。',
      3200,
      initiatorName,
      targetName,
    );
    this.widget.showCharacterBubble(characterId, proposalBubble.text, proposalBubble.durationMs);
    this.widget.showCharacterBubble(proposal.targetCharId, rejectedBubble.text, rejectedBubble.durationMs);
  }

  private handlePendingActivityJoin(characterId: string, snapshot: CharacterSnapshot): void {
    const activityJoin = snapshot.context.pendingActivityJoin;

    if (!activityJoin) {
      return;
    }

    const timestamp = Date.now();
    const activity = this.activityManager.getActivity(activityJoin.activityId);

    if (!activity || activity.endsAt <= timestamp || !this.canCharacterJoinActivity(characterId, activity)) {
      this.sendToCharacter(characterId, {
        type: EventType.JoinActivityRejected,
        activityId: activityJoin.activityId,
      });
      return;
    }

    const joinedActivity = this.activityManager.joinActivity(activityJoin.activityId, characterId, timestamp);

    if (!joinedActivity) {
      this.sendToCharacter(characterId, {
        type: EventType.JoinActivityRejected,
        activityId: activityJoin.activityId,
      });
      return;
    }

    this.sendToCharacter(characterId, {
      type: EventType.JoinActivityAccepted,
      activityId: joinedActivity.id,
      sourceEventId: activityJoin.sourceEventId,
    });
    this.widget.showCharacterBubble(characterId, '我也要一起玩！', 2200);
    this.notifyJoinableActivitiesChanged();
  }

  private handlePlayProposal(characterId: string, snapshot: CharacterSnapshot): void {
    const proposal = snapshot.context.pendingInteractionProposal;

    if (!proposal || proposal.type !== 'play') {
      return;
    }

    const initiatorName = snapshot.context.name;
    const targetName = this.getCharacterName(proposal.targetCharId);
    const proposalBubble = this.getInteractionBubble(
      snapshot,
      'proposal',
      'initiator',
      '{initiator}：一起玩嗎？',
      2600,
      initiatorName,
      targetName,
    );

    const acceptanceDecision = this.evaluatePlayProposal(proposal.targetCharId, characterId, proposal.sourceEventId);

    if (acceptanceDecision.accepted) {
      this.sendToCharacter(characterId, {
        type: EventType.PlayProposalAccepted,
        targetCharId: proposal.targetCharId,
        proposalId: proposal.id,
        sourceEventId: proposal.sourceEventId,
      });
      this.sendToCharacter(proposal.targetCharId, {
        type: EventType.AcceptPlayProposal,
        fromCharacterId: characterId,
        proposalId: proposal.id,
        sourceEventId: proposal.sourceEventId,
      });
      this.playNonBubblePerformanceSteps(snapshot, 'proposal', characterId, proposal.targetCharId);
      this.playNonBubblePerformanceSteps(snapshot, 'accepted', characterId, proposal.targetCharId);
      const acceptedBubble = this.getInteractionBubble(
        snapshot,
        'accepted',
        'target',
        '{target}：好，一起玩！',
        2600,
        initiatorName,
        targetName,
      );
      this.widget.showCharacterBubble(characterId, proposalBubble.text, proposalBubble.durationMs);
      this.widget.showCharacterBubble(proposal.targetCharId, acceptedBubble.text, acceptedBubble.durationMs);
      this.schedulePlayTogether(proposal.id, characterId, proposal.targetCharId);
      return;
    }

    const rejectedAt = Date.now();
    this.sendToCharacter(characterId, {
      type: EventType.PlayProposalRejected,
      targetCharId: proposal.targetCharId,
      proposalId: proposal.id,
      timestamp: rejectedAt,
    });
    this.sendToCharacter(proposal.targetCharId, {
      type: EventType.RecordInteractionCooldown,
      interactionType: 'play',
      partnerCharId: characterId,
      proposalId: proposal.id,
      role: 'target',
      sourceEventId: proposal.sourceEventId,
      timestamp: rejectedAt,
    });
    const rejectedPhase = getRejectedPerformancePhase(acceptanceDecision.reason);
    this.playNonBubblePerformanceSteps(snapshot, 'proposal', characterId, proposal.targetCharId);
    this.playNonBubblePerformanceSteps(snapshot, rejectedPhase, characterId, proposal.targetCharId);
    const rejectedBubble = this.getInteractionBubble(
      snapshot,
      rejectedPhase,
      'target',
      acceptanceDecision.reason === 'busy'
        ? '{target}：抱歉，現在有事。'
        : '{target}：我現在不想玩。',
      2600,
      initiatorName,
      targetName,
    );
    this.widget.showCharacterBubble(characterId, proposalBubble.text, proposalBubble.durationMs);
    this.widget.showCharacterBubble(proposal.targetCharId, rejectedBubble.text, rejectedBubble.durationMs);
  }

  private getInteractionPresentation(snapshot: CharacterSnapshot) {
    const definitionId = snapshot.context.lastEventDecision?.selectedCandidateId;

    if (!definitionId) {
      return undefined;
    }

    return CHARACTER_EVENT_DEFINITIONS_BY_ID[definitionId]?.interactionPresentation;
  }

  private getInteractionBubble(
    snapshot: CharacterSnapshot,
    phase: CharacterPerformancePhase,
    target: CharacterPerformanceTarget,
    fallbackTemplate: string,
    fallbackDurationMs: number,
    initiatorName: string,
    targetName: string,
  ): CharacterPerformanceBubble {
    return this.performanceRunner.getInteractionBubble({
      selection: this.getPerformanceSelection(snapshot),
      phase,
      target,
      fallbackTemplate,
      fallbackDurationMs,
      initiatorName,
      targetName,
      legacyPresentation: this.getInteractionPresentation(snapshot),
    });
  }

  private getPerformanceSelection(snapshot: CharacterSnapshot): CharacterPerformanceSelection {
    return {
      definitionId: snapshot.context.lastEventDecision?.selectedCandidateId,
      variantId: snapshot.context.lastEventDecision?.selectedPresentationVariantId,
    };
  }

  private getSelectedActivityDefinition(snapshot: CharacterSnapshot): CharacterEventActivity | undefined {
    const definitionId = snapshot.context.lastEventDecision?.selectedCandidateId;
    const variantId = snapshot.context.lastEventDecision?.selectedPresentationVariantId;

    if (!definitionId || !variantId) {
      return undefined;
    }

    return CHARACTER_EVENT_DEFINITIONS_BY_ID[definitionId]?.presentationVariants
      ?.find(variant => variant.id === variantId)
      ?.activity;
  }

  private playNonBubblePerformanceSteps(
    snapshot: CharacterSnapshot,
    phase: CharacterPerformancePhase,
    initiatorId: string,
    targetId: string,
  ): void {
    this.performanceRunner.playNonBubblePerformanceSteps(
      this.getPerformanceSelection(snapshot),
      phase,
      initiatorId,
      targetId,
    );
  }

  private getCharacterName(characterId: string): string {
    return this.characterActors.get(characterId)?.getSnapshot().context.name ?? characterId;
  }

  private evaluateChatProposal(
    targetCharId: string,
    initiatorId: string,
    sourceEventId: string,
  ): InteractionAcceptanceDecision {
    const actor = this.characterActors.get(targetCharId);

    if (actor?.getSnapshot().status !== 'active') {
      return { accepted: false, reason: 'busy' };
    }

    const context = actor.getSnapshot().context;

    if (
      context.target ||
      context.pendingInteractionProposal ||
      context.currentInteraction ||
      context.currentMotivation !== 'idle' ||
      this.isCharacterBodyFrozen(targetCharId)
    ) {
      return { accepted: false, reason: 'busy' };
    }

    const definition = CHARACTER_EVENT_DEFINITIONS_BY_ID[sourceEventId];

    if (!definition || !this.canTargetStartInteraction(context, initiatorId, definition)) {
      return { accepted: false, reason: 'busy' };
    }

    return shouldAcceptInteraction(context, definition)
      ? { accepted: true }
      : { accepted: false, reason: 'mood' };
  }

  private evaluatePlayProposal(
    targetCharId: string,
    initiatorId: string,
    sourceEventId: string,
  ): InteractionAcceptanceDecision {
    const actor = this.characterActors.get(targetCharId);

    if (actor?.getSnapshot().status !== 'active') {
      return { accepted: false, reason: 'busy' };
    }

    const context = actor.getSnapshot().context;

    if (
      context.target ||
      context.pendingInteractionProposal ||
      context.currentInteraction ||
      context.currentMotivation !== 'idle' ||
      this.isCharacterBodyFrozen(targetCharId)
    ) {
      return { accepted: false, reason: 'busy' };
    }

    const definition = CHARACTER_EVENT_DEFINITIONS_BY_ID[sourceEventId];

    if (!definition || !this.canTargetStartInteraction(context, initiatorId, definition)) {
      return { accepted: false, reason: 'busy' };
    }

    return shouldAcceptInteraction(context, definition)
      ? { accepted: true }
      : { accepted: false, reason: 'mood' };
  }

  private canTargetStartInteraction(
    context: CharacterSnapshot['context'],
    initiatorId: string,
    definition: CharacterEventDefinition,
  ): boolean {
    return canStartInteractionWithTarget(context, definition, initiatorId, Date.now());
  }

  private createJoinableActivityForInteraction(
    proposalId: string,
    snapshot: CharacterSnapshot,
    initiatorId: string,
    targetId: string,
  ): string | null {
    const sourceEventId = snapshot.context.lastEventDecision?.selectedCandidateId;
    const activity = this.getSelectedActivityDefinition(snapshot);

    if (!sourceEventId || !activity?.joinable) {
      return null;
    }

    const activityId = `interaction.${proposalId}`;

    this.activityManager.createActivity({
      id: activityId,
      sourceEventId,
      activity,
      hostCharacterIds: [initiatorId],
      participantIds: [initiatorId, targetId],
      timestamp: Date.now(),
      phase: 'forming',
      location: this.getCharacterPosition(initiatorId) ?? snapshot.context.position,
    });
    this.notifyJoinableActivitiesChanged();

    return activityId;
  }

  private scheduleChatEnd(proposalId: string, initiatorId: string, targetId: string): void {
    const initiatorSnapshot = this.characterActors.get(initiatorId)?.getSnapshot();
    const initiatorName = this.getCharacterName(initiatorId);
    const targetName = this.getCharacterName(targetId);
    const activeBubble = initiatorSnapshot
      ? this.getInteractionBubble(
        initiatorSnapshot,
        'active',
        'both',
        '正在聊天',
        CHAT_INTERACTION_DURATION_MS,
        initiatorName,
        targetName,
      )
      : { text: '正在聊天', delayMs: 1200, durationMs: CHAT_INTERACTION_DURATION_MS };

    const startTimerId = window.setTimeout(() => {
      this.chatEndTimers.delete(`${proposalId}.active`);

      if (initiatorSnapshot) {
        this.playNonBubblePerformanceSteps(initiatorSnapshot, 'active', initiatorId, targetId);
      }
      this.widget.showCharacterBubble(initiatorId, activeBubble.text, activeBubble.durationMs);
      this.widget.showCharacterBubble(targetId, activeBubble.text, activeBubble.durationMs);
    }, activeBubble.delayMs ?? 1200);

    this.chatEndTimers.set(`${proposalId}.active`, startTimerId);

    const timerId = window.setTimeout(() => {
      const initiatorSnapshot = this.characterActors.get(initiatorId)?.getSnapshot();
      const initiatorName = this.getCharacterName(initiatorId);
      const targetName = this.getCharacterName(targetId);
      const endBubble = initiatorSnapshot
        ? this.getInteractionBubble(
          initiatorSnapshot,
          'end',
          'both',
          '聊完了。',
          1800,
          initiatorName,
          targetName,
        )
        : null;

      if (endBubble && initiatorSnapshot) {
        this.playNonBubblePerformanceSteps(initiatorSnapshot, 'end', initiatorId, targetId);
        this.widget.showCharacterBubble(initiatorId, endBubble.text, endBubble.durationMs);
        this.widget.showCharacterBubble(targetId, endBubble.text, endBubble.durationMs);
      }

      const activeTimerId = this.chatEndTimers.get(`${proposalId}.active`);

      if (activeTimerId) {
        window.clearTimeout(activeTimerId);
        this.chatEndTimers.delete(`${proposalId}.active`);
      }

      this.chatEndTimers.delete(proposalId);
      const timestamp = Date.now();
      this.sendToCharacter(initiatorId, { type: EventType.EndChatInteraction, proposalId, timestamp });
      this.sendToCharacter(targetId, { type: EventType.EndChatInteraction, proposalId, timestamp });
    }, CHAT_INTERACTION_DURATION_MS);

    this.chatEndTimers.set(proposalId, timerId);
  }

  private schedulePlayTogether(proposalId: string, initiatorId: string, targetId: string): void {
    const initiatorSnapshot = this.characterActors.get(initiatorId)?.getSnapshot();
    const initiatorName = this.getCharacterName(initiatorId);
    const targetName = this.getCharacterName(targetId);
    const activityId = initiatorSnapshot
      ? this.createJoinableActivityForInteraction(proposalId, initiatorSnapshot, initiatorId, targetId)
      : null;
    const playDurationMs = initiatorSnapshot
      ? this.getSelectedActivityDefinition(initiatorSnapshot)?.durationMs ?? 20000
      : 20000;
    const activeBubble = initiatorSnapshot
      ? this.getInteractionBubble(
        initiatorSnapshot,
        'active',
        'both',
        '正在一起玩',
        5000,
        initiatorName,
        targetName,
      )
      : { text: '正在一起玩', delayMs: 1200, durationMs: 5000 };

    const startTimerId = window.setTimeout(() => {
      this.playStartTimers.delete(proposalId);
      if (initiatorSnapshot) {
        if (activityId) {
          this.activityManager.updateActivityPhase(
            activityId,
            'active',
            this.getCharacterPosition(initiatorId) ?? initiatorSnapshot.context.position,
          );
          this.notifyJoinableActivitiesChanged();
        }
        this.playNonBubblePerformanceSteps(initiatorSnapshot, 'active', initiatorId, targetId);
      }
      this.widget.showCharacterBubble(initiatorId, activeBubble.text, activeBubble.durationMs);
      this.widget.showCharacterBubble(targetId, activeBubble.text, activeBubble.durationMs);
    }, activeBubble.delayMs ?? 1200);

    this.playStartTimers.set(proposalId, startTimerId);

    const timerId = window.setTimeout(() => {
      const endSnapshot = this.characterActors.get(initiatorId)?.getSnapshot();
      const endBubble = endSnapshot
        ? this.getInteractionBubble(
          endSnapshot,
          'end',
          'both',
          '一起玩完了。',
          1800,
          initiatorName,
          targetName,
        )
        : null;

      if (endBubble && endSnapshot) {
        this.playNonBubblePerformanceSteps(endSnapshot, 'end', initiatorId, targetId);
        this.widget.showCharacterBubble(initiatorId, endBubble.text, endBubble.durationMs);
        this.widget.showCharacterBubble(targetId, endBubble.text, endBubble.durationMs);
      }

      if (activityId) {
        const endedActivity = this.activityManager.endActivity(activityId);
        endedActivity?.participantIds
          .filter(participantId => participantId !== initiatorId && participantId !== targetId)
          .forEach(participantId => {
            this.sendToCharacter(participantId, {
              type: EventType.EndJoinedActivity,
              activityId,
              timestamp: Date.now(),
            });
          });
        this.notifyJoinableActivitiesChanged();
      }

      this.playEndTimers.delete(proposalId);
      const timestamp = Date.now();
      this.sendToCharacter(initiatorId, { type: EventType.EndPlayInteraction, proposalId, timestamp });
      this.sendToCharacter(targetId, { type: EventType.EndPlayInteraction, proposalId, timestamp });
    }, playDurationMs);

    this.playEndTimers.set(proposalId, timerId);
  }

  private getNearbyCharacterIds(characterId: string, range: number): string[] {
    const tile = this.widget.getCharacterTile(characterId);

    if (!tile) {
      return [];
    }

    return this.widget.getOccupiedNeighborIds(tile.x, tile.y, range, characterId);
  }

  private getNearbyJoinableActivities(
    characterId: string,
    timestamp: number,
  ): readonly JoinableActivity[] {
    const position = this.getCharacterPosition(characterId);

    if (!position) {
      return [];
    }

    return this.activityManager.findNearbyActivities({
      position,
      timestamp,
      phases: ['forming', 'active'],
    }).filter(activity => this.canCharacterJoinActivity(characterId, activity));
  }

  private getCharacterPosition(characterId: string): Position | null {
    const tile = this.widget.getCharacterTile(characterId);

    if (!tile) {
      return null;
    }

    return { x: tile.x, y: tile.y };
  }

  private pruneEndedActivities(timestamp: number): void {
    const endedActivities = this.activityManager.pruneEndedActivities(timestamp);

    if (endedActivities.length > 0) {
      endedActivities.forEach(activity => {
        activity.participantIds.forEach(participantId => {
          this.sendToCharacter(participantId, {
            type: EventType.EndJoinedActivity,
            activityId: activity.id,
            timestamp,
          });
        });
      });
      this.notifyJoinableActivitiesChanged();
    }
  }

  private notifyJoinableActivitiesChanged(): void {
    this.onJoinableActivitiesChange?.(this.activityManager.getActivities());
  }

  private canCharacterJoinActivity(characterId: string, activity: JoinableActivity): boolean {
    if (activity.participantIds.includes(characterId)) {
      return false;
    }

    const context = this.characterActors.get(characterId)?.getSnapshot().context;

    if (!context) {
      return false;
    }

    if (activity.joinRequirements.type === 'none') {
      return true;
    }

    return context.ownItems.some(item => item.id === activity.joinRequirements.itemId);
  }

  private sendToCharacter(characterId: string, event: CharacterEvent): boolean {
    const actor = this.characterActors.get(characterId);

    if (!actor || actor.getSnapshot().status !== 'active') {
      return false;
    }

    actor.send(event);
    return true;
  }

  private isCharacterBodyFrozen(characterId: string): boolean {
    const actor = this.characterActors.get(characterId);

    if (actor?.getSnapshot().status !== 'active') {
      return false;
    }

    const locks = actor.getSnapshot().context.locks;
    return locks.bodyAction.length > 0 || locks.bodyMove.length > 0;
  }

  private cancelWalkIfNeeded(characterId: string): void {
    if (!this.walkingCharacterIds.has(characterId)) {
      return;
    }

    this.widget.cancelWalk(characterId);
    this.walkingCharacterIds.delete(characterId);
  }

  private findNearbyEmptyTile(position: Position, occupantId: string, range: number): GridCoordinate | null {
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

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function getRejectedPerformancePhase(reason: 'busy' | 'mood'): CharacterPerformancePhase {
  return reason === 'busy' ? 'rejectedBusy' : 'rejectedMood';
}
