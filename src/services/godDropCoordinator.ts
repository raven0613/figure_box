import type { SocialStatus, Position } from '~/constants/character';
import type { TownMapObjectData } from '~/constants/townMap';
import type { JoinableActivity } from '~/services/characterEvents/joinableActivities';
import type { ExpressionBubbleId } from '~/typing/expressionBubble';
import {
  GOD_DROP_SCAN_RADIUS,
  GodDropOpportunityService,
  type GodDropOpportunity,
  type GodDropOpportunityCandidate,
} from '~/services/godDropOpportunityService';

interface OpenGodDropOpportunityInput {
  actorId: string;
  droppedAt: Position;
  timestamp?: number;
}

interface GodDropCoordinatorOptions {
  opportunityService?: GodDropOpportunityService;
  getNearbyCharacterIds: (
    position: Position,
    radius: number,
    excludedCharacterId: string,
  ) => readonly string[];
  getNearbyObjects: (position: Position, radius: number) => readonly TownMapObjectData[];
  getNearbyActivities: (
    actorId: string,
    position: Position,
    timestamp: number,
  ) => readonly JoinableActivity[];
  isCharacterUnavailable: (characterId: string) => boolean;
  getCharacterName: (characterId: string) => string;
  getCharacterDistance: (position: Position, characterId: string) => number | null;
  getRelationshipStatus: (actorId: string, targetCharacterId: string) => SocialStatus;
  joinActivity: (characterId: string, activityId: string) => boolean;
  playRelationshipMoment: (actorId: string, targetCharacterId: string, label: string) => void;
  showCharacterBubble: (characterId: string, text: string, durationMs?: number) => void;
  showCharacterExpressionBubble: (
    characterId: string,
    expressionBubbleId: ExpressionBubbleId,
    durationMs?: number,
  ) => void;
  onOpportunityChange?: (opportunity: GodDropOpportunity | null) => void;
}

export class GodDropCoordinator {
  private readonly opportunityService: GodDropOpportunityService;
  private readonly getNearbyCharacterIds: GodDropCoordinatorOptions['getNearbyCharacterIds'];
  private readonly getNearbyObjects: GodDropCoordinatorOptions['getNearbyObjects'];
  private readonly getNearbyActivities: GodDropCoordinatorOptions['getNearbyActivities'];
  private readonly isCharacterUnavailable: GodDropCoordinatorOptions['isCharacterUnavailable'];
  private readonly getCharacterName: GodDropCoordinatorOptions['getCharacterName'];
  private readonly getCharacterDistance: GodDropCoordinatorOptions['getCharacterDistance'];
  private readonly getRelationshipStatus: GodDropCoordinatorOptions['getRelationshipStatus'];
  private readonly joinActivity: GodDropCoordinatorOptions['joinActivity'];
  private readonly playRelationshipMoment: GodDropCoordinatorOptions['playRelationshipMoment'];
  private readonly showCharacterBubble: GodDropCoordinatorOptions['showCharacterBubble'];
  private readonly showCharacterExpressionBubble: GodDropCoordinatorOptions['showCharacterExpressionBubble'];
  private readonly onOpportunityChange: GodDropCoordinatorOptions['onOpportunityChange'] | undefined;
  private autoTimer: number | null = null;
  private expireTimer: number | null = null;
  private currentOpportunity: GodDropOpportunity | null = null;

  constructor(options: GodDropCoordinatorOptions) {
    this.opportunityService = options.opportunityService ?? new GodDropOpportunityService();
    this.getNearbyCharacterIds = options.getNearbyCharacterIds;
    this.getNearbyObjects = options.getNearbyObjects;
    this.getNearbyActivities = options.getNearbyActivities;
    this.isCharacterUnavailable = options.isCharacterUnavailable;
    this.getCharacterName = options.getCharacterName;
    this.getCharacterDistance = options.getCharacterDistance;
    this.getRelationshipStatus = options.getRelationshipStatus;
    this.joinActivity = options.joinActivity;
    this.playRelationshipMoment = options.playRelationshipMoment;
    this.showCharacterBubble = options.showCharacterBubble;
    this.showCharacterExpressionBubble = options.showCharacterExpressionBubble;
    this.onOpportunityChange = options.onOpportunityChange;
  }

  open(input: OpenGodDropOpportunityInput): void {
    const timestamp = input.timestamp ?? Date.now();
    const opportunity = this.opportunityService.createOpportunity({
      actorId: input.actorId,
      droppedAt: input.droppedAt,
      timestamp,
      nearbyCharacterIds: this.getNearbyCharacterIds(
        input.droppedAt,
        GOD_DROP_SCAN_RADIUS,
        input.actorId,
      ),
      nearbyObjects: this.getNearbyObjects(input.droppedAt, GOD_DROP_SCAN_RADIUS),
      nearbyActivities: this.getNearbyActivities(input.actorId, input.droppedAt, timestamp),
      isCharacterUnavailable: characterId => this.isCharacterUnavailable(characterId),
      getCharacterName: characterId => this.getCharacterName(characterId),
      getCharacterDistance: characterId => this.getCharacterDistance(input.droppedAt, characterId),
      getRelationshipStatus: targetCharacterId => (
        this.getRelationshipStatus(input.actorId, targetCharacterId)
      ),
    });

    this.clear();

    if (!opportunity) {
      return;
    }

    this.currentOpportunity = opportunity;
    this.onOpportunityChange?.(opportunity);
    this.showCharacterBubble(
      input.actorId,
      getOpportunityBubbleText(opportunity),
      1400,
    );
    this.autoTimer = window.setTimeout(() => {
      this.autoChooseCandidate(opportunity.id);
    }, Math.max(0, opportunity.autoDecisionAt - timestamp));
    this.expireTimer = window.setTimeout(() => {
      if (this.currentOpportunity?.id === opportunity.id) {
        this.clear();
      }
    }, Math.max(0, opportunity.expiresAt - timestamp));
  }

  chooseCandidate(candidateId: string): void {
    const opportunity = this.currentOpportunity;
    const candidate = opportunity?.candidates.find(item => item.id === candidateId);

    if (!opportunity || !candidate) {
      return;
    }

    this.executeCandidate(opportunity, candidate, 'player');
  }

  clear(): void {
    if (this.autoTimer !== null) {
      window.clearTimeout(this.autoTimer);
      this.autoTimer = null;
    }

    if (this.expireTimer !== null) {
      window.clearTimeout(this.expireTimer);
      this.expireTimer = null;
    }

    if (!this.currentOpportunity) {
      return;
    }

    this.currentOpportunity = null;
    this.onOpportunityChange?.(null);
  }

  dispose(): void {
    this.clear();
  }

  private autoChooseCandidate(opportunityId: string): void {
    const opportunity = this.currentOpportunity;

    if (!opportunity || opportunity.id !== opportunityId) {
      return;
    }

    const candidate = this.opportunityService.selectCandidate(opportunity);

    if (!candidate) {
      this.clear();
      return;
    }

    this.executeCandidate(opportunity, candidate, 'auto');
  }

  private executeCandidate(
    opportunity: GodDropOpportunity,
    candidate: GodDropOpportunityCandidate,
    source: 'auto' | 'player',
  ): void {
    this.clear();

    if (candidate.kind === 'object') {
      this.showCharacterBubble(
        opportunity.actorId,
        source === 'player' ? `我去看看${candidate.label.replace('看看', '')}` : candidate.label,
        2200,
      );
      this.showCharacterExpressionBubble(opportunity.actorId, 'surprised', 900);
      return;
    }

    if (candidate.branch === 'activityFocused' && candidate.activityId) {
      if (this.joinActivity(opportunity.actorId, candidate.activityId)) {
        this.showCharacterBubble(opportunity.actorId, candidate.label, 1800);
      } else if (source === 'player') {
        this.showCharacterBubble(opportunity.actorId, '現在加入不了...', 1400);
      }
      return;
    }

    if (candidate.branch === 'relationshipFocused' && candidate.participantId) {
      this.playRelationshipMoment(opportunity.actorId, candidate.participantId, candidate.label);
    }
  }
}

function getOpportunityBubbleText(opportunity: GodDropOpportunity): string {
  const topCandidate = opportunity.candidates[0];

  if (!topCandidate) {
    return '看看附近...';
  }

  return `${topCandidate.label}？`;
}
