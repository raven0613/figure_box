import { EventType } from '~/stateMachines/gameFlow/events';
import {
  CHARACTER_EVENT_DEFINITIONS_BY_ID,
  type CharacterEventActivity,
} from '~/constants/charactarEventsDefinitions';
import {
  CharacterPerformanceRunner,
  type CharacterPerformanceBubble,
  type CharacterPerformanceSelection,
} from '~/services/characterEvents/characterPerformanceRunner';
import type { JoinableActivityManager } from '~/services/characterEvents/joinableActivities';
import type {
  CharacterPerformancePhase,
  CharacterPerformanceTarget,
} from '~/services/characterEvents/performances';
import type { CharacterInteractionProposal } from '~/stateMachines/gameFlow/context';
import type { Position } from '~/constants/character';
import type { CharacterSnapshot, SendCharacterEvent } from '~/services/townCharacterTypes';
import { TownInteractionEvaluator } from '~/services/townInteractionEvaluator';
import { TownInteractionScheduler } from '~/services/townInteractionScheduler';
import {
  DEFAULT_ACTIVE_BUBBLE_DELAY_MS,
  INTERACTION_CONFIGS,
  type InteractionProposalConfig,
  type InteractionType,
} from '~/constants/townInteractionConfig';

interface TownInteractionProposalHandlerOptions {
  performanceRunner: CharacterPerformanceRunner;
  activityManager: JoinableActivityManager;
  getCharacterSnapshot: (characterId: string) => CharacterSnapshot | null;
  getCharacterName: (characterId: string) => string;
  getCharacterPosition: (characterId: string) => Position | null;
  isCharacterBodyFrozen: (characterId: string) => boolean;
  notifyActivitiesChanged: () => void;
  sendToCharacter: SendCharacterEvent;
  showCharacterBubble: (characterId: string, text: string, durationMs?: number) => void;
}

// chat/play proposal 接受與拒絕流程
export class TownInteractionProposalHandler {
  private readonly processedProposalIds = new Set<string>();
  private readonly evaluator: TownInteractionEvaluator;
  private readonly scheduler: TownInteractionScheduler;
  private readonly performanceRunner: CharacterPerformanceRunner;
  private readonly getCharacterName: (characterId: string) => string;
  private readonly sendToCharacter: SendCharacterEvent;
  private readonly showCharacterBubble: (characterId: string, text: string, durationMs?: number) => void;

  constructor(options: TownInteractionProposalHandlerOptions) {
    this.performanceRunner = options.performanceRunner;
    this.getCharacterName = options.getCharacterName;
    this.sendToCharacter = options.sendToCharacter;
    this.showCharacterBubble = options.showCharacterBubble;
    this.evaluator = new TownInteractionEvaluator({
      getCharacterSnapshot: options.getCharacterSnapshot,
      isCharacterBodyFrozen: options.isCharacterBodyFrozen,
    });
    this.scheduler = new TownInteractionScheduler({
      activityManager: options.activityManager,
      getCharacterSnapshot: options.getCharacterSnapshot,
      getCharacterPosition: options.getCharacterPosition,
      getSelectedActivityDefinition: snapshot => this.getSelectedActivityDefinition(snapshot),
      getBubbleOrFallback: (
        snapshot,
        phase,
        fallbackTemplate,
        fallbackDurationMs,
        initiatorId,
        targetId,
      ) => this.getBubbleOrFallback(
        snapshot,
        phase,
        fallbackTemplate,
        fallbackDurationMs,
        initiatorId,
        targetId,
      ),
      playPhaseIfSnapshotExists: (snapshot, phase, initiatorId, targetId) => {
        this.playPhaseIfSnapshotExists(snapshot, phase, initiatorId, targetId);
      },
      showSameBubbleToPair: (initiatorId, targetId, bubble) => {
        this.showSameBubbleToPair(initiatorId, targetId, bubble);
      },
      notifyActivitiesChanged: options.notifyActivitiesChanged,
      sendToCharacter: options.sendToCharacter,
    });
  }

  dispose(): void {
    this.scheduler.dispose();
    this.processedProposalIds.clear();
  }

  handlePendingInteractionProposal(characterId: string, snapshot: CharacterSnapshot): void {
    const proposal = snapshot.context.pendingInteractionProposal;

    if (!proposal || this.processedProposalIds.has(proposal.id)) {
      return;
    }

    this.processedProposalIds.add(proposal.id);

    if (proposal.type !== 'chat' && proposal.type !== 'play') {
      return;
    }

    this.handleInteractionProposal(characterId, snapshot, INTERACTION_CONFIGS[proposal.type]);
  }

  private handleInteractionProposal(
    characterId: string,
    snapshot: CharacterSnapshot,
    config: InteractionProposalConfig,
  ): void {
    const proposal = snapshot.context.pendingInteractionProposal;

    if (!proposal || proposal.type !== config.interactionType) {
      return;
    }

    const initiatorName = snapshot.context.name;
    const targetName = this.getCharacterName(proposal.targetCharId);
    const proposalBubble = this.getInteractionBubble(
      snapshot,
      'proposal',
      'initiator',
      config.copy.proposalTemplate,
      config.copy.proposalDurationMs,
      initiatorName,
      targetName,
    );
    const acceptanceDecision = this.evaluator.evaluateInteractionProposal(
      proposal.targetCharId,
      characterId,
      proposal.sourceEventId,
    );

    if (acceptanceDecision.accepted) {
      this.acceptInteractionProposal(characterId, snapshot, config, proposalBubble);
      return;
    }

    this.rejectInteractionProposal(characterId, snapshot, config, proposalBubble, acceptanceDecision.reason);
  }

  private acceptInteractionProposal(
    characterId: string,
    snapshot: CharacterSnapshot,
    config: InteractionProposalConfig,
    proposalBubble: CharacterPerformanceBubble,
  ): void {
    const proposal = snapshot.context.pendingInteractionProposal;

    if (!proposal) {
      return;
    }

    this.sendProposalAccepted(characterId, proposal, config.interactionType);
    this.playNonBubblePerformanceSteps(snapshot, 'proposal', characterId, proposal.targetCharId);
    this.playNonBubblePerformanceSteps(snapshot, 'accepted', characterId, proposal.targetCharId);

    const acceptedBubble = this.getInteractionBubble(
      snapshot,
      'accepted',
      'target',
      config.copy.acceptedTemplate,
      config.copy.proposalDurationMs,
      snapshot.context.name,
      this.getCharacterName(proposal.targetCharId),
    );

    this.showInteractionBubbles(characterId, proposal.targetCharId, proposalBubble, acceptedBubble);
    this.scheduler.scheduleInteractionEnd(proposal.id, characterId, proposal.targetCharId, config);
  }

  private rejectInteractionProposal(
    characterId: string,
    snapshot: CharacterSnapshot,
    config: InteractionProposalConfig,
    proposalBubble: CharacterPerformanceBubble,
    reason: 'busy' | 'mood',
  ): void {
    const proposal = snapshot.context.pendingInteractionProposal;

    if (!proposal) {
      return;
    }

    const rejectedAt = Date.now();

    this.sendProposalRejected(characterId, proposal, config.interactionType, rejectedAt);
    this.sendToCharacter(proposal.targetCharId, {
      type: EventType.RecordInteractionCooldown,
      interactionType: config.interactionType,
      partnerCharId: characterId,
      proposalId: proposal.id,
      role: 'target',
      sourceEventId: proposal.sourceEventId,
      timestamp: rejectedAt,
    });

    const rejectedPhase = getRejectedPerformancePhase(reason);

    this.playNonBubblePerformanceSteps(snapshot, 'proposal', characterId, proposal.targetCharId);
    this.playNonBubblePerformanceSteps(snapshot, rejectedPhase, characterId, proposal.targetCharId);

    const rejectedBubble = this.getInteractionBubble(
      snapshot,
      rejectedPhase,
      'target',
      reason === 'busy' ? '{target}：抱歉，現在有事。' : config.copy.rejectedMoodTemplate,
      config.copy.proposalDurationMs,
      snapshot.context.name,
      this.getCharacterName(proposal.targetCharId),
    );

    this.showInteractionBubbles(characterId, proposal.targetCharId, proposalBubble, rejectedBubble);
  }

  private sendProposalAccepted(
    initiatorId: string,
    proposal: CharacterInteractionProposal,
    interactionType: InteractionType,
  ): void {
    if (interactionType === 'chat') {
      this.sendToCharacter(initiatorId, {
        type: EventType.ChatProposalAccepted,
        targetCharId: proposal.targetCharId,
        proposalId: proposal.id,
        sourceEventId: proposal.sourceEventId,
      });
      this.sendToCharacter(proposal.targetCharId, {
        type: EventType.AcceptChatProposal,
        fromCharacterId: initiatorId,
        proposalId: proposal.id,
        sourceEventId: proposal.sourceEventId,
      });
      return;
    }

    this.sendToCharacter(initiatorId, {
      type: EventType.PlayProposalAccepted,
      targetCharId: proposal.targetCharId,
      proposalId: proposal.id,
      sourceEventId: proposal.sourceEventId,
    });
    this.sendToCharacter(proposal.targetCharId, {
      type: EventType.AcceptPlayProposal,
      fromCharacterId: initiatorId,
      proposalId: proposal.id,
      sourceEventId: proposal.sourceEventId,
    });
  }

  private sendProposalRejected(
    initiatorId: string,
    proposal: CharacterInteractionProposal,
    interactionType: InteractionType,
    timestamp: number,
  ): void {
    if (interactionType === 'chat') {
      this.sendToCharacter(initiatorId, {
        type: EventType.ChatProposalRejected,
        targetCharId: proposal.targetCharId,
        proposalId: proposal.id,
        timestamp,
      });
      return;
    }

    this.sendToCharacter(initiatorId, {
      type: EventType.PlayProposalRejected,
      targetCharId: proposal.targetCharId,
      proposalId: proposal.id,
      timestamp,
    });
  }

  private getBubbleOrFallback(
    snapshot: CharacterSnapshot | null,
    phase: CharacterPerformancePhase,
    fallbackTemplate: string,
    fallbackDurationMs: number,
    initiatorId: string,
    targetId: string,
  ): CharacterPerformanceBubble {
    if (!snapshot) {
      return {
        text: fallbackTemplate,
        delayMs: DEFAULT_ACTIVE_BUBBLE_DELAY_MS,
        durationMs: fallbackDurationMs,
      };
    }

    return this.getInteractionBubble(
      snapshot,
      phase,
      'both',
      fallbackTemplate,
      fallbackDurationMs,
      this.getCharacterName(initiatorId),
      this.getCharacterName(targetId),
    );
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

  private getInteractionPresentation(snapshot: CharacterSnapshot) {
    const definitionId = snapshot.context.lastEventDecision?.selectedCandidateId;

    if (!definitionId) {
      return undefined;
    }

    return CHARACTER_EVENT_DEFINITIONS_BY_ID[definitionId]?.interactionPresentation;
  }

  private getPerformanceSelection(snapshot: CharacterSnapshot): CharacterPerformanceSelection {
    const definitionId = snapshot.context.lastEventDecision?.selectedCandidateId ?? undefined;
    const variantId = snapshot.context.lastEventDecision?.selectedPresentationVariantId ?? undefined;

    return {
      definitionId,
      variantId,
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

  private playPhaseIfSnapshotExists(
    snapshot: CharacterSnapshot | null,
    phase: CharacterPerformancePhase,
    initiatorId: string,
    targetId: string,
  ): void {
    if (snapshot) {
      this.playNonBubblePerformanceSteps(snapshot, phase, initiatorId, targetId);
    }
  }

  private showInteractionBubbles(
    initiatorId: string,
    targetId: string,
    initiatorBubble: CharacterPerformanceBubble,
    targetBubble: CharacterPerformanceBubble,
  ): void {
    this.showCharacterBubble(initiatorId, initiatorBubble.text, initiatorBubble.durationMs);
    this.showCharacterBubble(targetId, targetBubble.text, targetBubble.durationMs);
  }

  private showSameBubbleToPair(
    initiatorId: string,
    targetId: string,
    bubble: CharacterPerformanceBubble,
  ): void {
    this.showCharacterBubble(initiatorId, bubble.text, bubble.durationMs);
    this.showCharacterBubble(targetId, bubble.text, bubble.durationMs);
  }
}

function getRejectedPerformancePhase(reason: 'busy' | 'mood'): CharacterPerformancePhase {
  return reason === 'busy' ? 'rejectedBusy' : 'rejectedMood';
}
