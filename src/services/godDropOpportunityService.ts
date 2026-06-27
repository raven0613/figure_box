import { SocialStatus, type Position } from '~/constants/character';
import type { JoinableActivity } from '~/services/characterEvents/joinableActivities';
import type { CharacterEventNearbyObservableObject } from '~/services/characterEvents/types';
import { WeightedDecisionSelector } from './decisionSelector';

export type GodDropCandidateKind = 'object' | 'person' | 'activity';
export type GodDropInteractionBranch = 'activityFocused' | 'relationshipFocused' | 'objectFocused';

export interface GodDropOpportunityCandidate {
  id: string;
  kind: GodDropCandidateKind;
  branch: GodDropInteractionBranch;
  targetId: string;
  label: string;
  distance: number;
  score: number;
  weight: number;
  reasons: readonly string[];
  activityId?: string;
  participantId?: string;
  objectId?: string;
  targetPosition?: Position;
}

export interface GodDropOpportunity {
  id: string;
  actorId: string;
  droppedAt: Position;
  candidates: readonly GodDropOpportunityCandidate[];
  createdAt: number;
  expiresAt: number;
  autoDecisionAt: number;
}

interface CreateGodDropOpportunityInput {
  actorId: string;
  droppedAt: Position;
  timestamp: number;
  nearbyCharacterIds: readonly string[];
  nearbyObjects: readonly CharacterEventNearbyObservableObject[];
  nearbyActivities: readonly JoinableActivity[];
  isCharacterUnavailable?: (characterId: string) => boolean;
  getCharacterName: (characterId: string) => string;
  getCharacterDistance: (characterId: string) => number | null;
  getRelationshipStatus: (targetCharacterId: string) => SocialStatus;
}

export const GOD_DROP_SCAN_RADIUS = 8;
const OPPORTUNITY_DURATION_MS = 2200;
const AUTO_DECISION_DELAY_MS = 2000;
const BASE_OBJECT_SCORE = 24;
const BASE_PERSON_SCORE = 36;
const BASE_ACTIVITY_SCORE = 30;
const STRANGER_RELATIONSHIP_SCORE = 32;
const KNOWN_RELATIONSHIP_SCORE = 22;
const CLOSE_RELATIONSHIP_SCORE = 34;
const SINGLE_ACTIVITY_RELATIONSHIP_SCORE = 18;
const GROUP_ACTIVITY_RELATIONSHIP_SCORE = 10;
const GROUP_ACTIVITY_SCORE = 16;
const NEAR_PERSON_SCORE = 18;

export class GodDropOpportunityService {
  private readonly selector = new WeightedDecisionSelector();

  createOpportunity(input: CreateGodDropOpportunityInput): GodDropOpportunity | null {
    const activityParticipantIds = new Set(input.nearbyActivities.flatMap(activity => [...activity.participantIds]));
    const objectCandidates = input.nearbyObjects.map(object => this.createObjectCandidate(object));
    const activityCandidates = input.nearbyActivities.flatMap(activity => this.createActivityCandidates(input, activity));
    const personCandidates = input.nearbyCharacterIds
      .filter(characterId => !activityParticipantIds.has(characterId))
      .filter(characterId => !input.isCharacterUnavailable?.(characterId))
      .map(characterId => this.createPersonCandidate(input, characterId));
    const candidates = [...objectCandidates, ...activityCandidates, ...personCandidates]
      .filter((candidate): candidate is GodDropOpportunityCandidate => candidate !== null)
      .sort((a, b) => b.score - a.score);

    if (candidates.length === 0) {
      return null;
    }

    return {
      id: `god-drop-${input.actorId}-${input.timestamp}`,
      actorId: input.actorId,
      droppedAt: input.droppedAt,
      candidates,
      createdAt: input.timestamp,
      autoDecisionAt: input.timestamp + AUTO_DECISION_DELAY_MS,
      expiresAt: input.timestamp + OPPORTUNITY_DURATION_MS,
    };
  }

  selectCandidate(opportunity: GodDropOpportunity): GodDropOpportunityCandidate | null {
    return this.selector.select(
      opportunity.candidates.map(candidate => ({ item: candidate, weight: candidate.weight })),
    );
  }

  private createObjectCandidate(object: CharacterEventNearbyObservableObject): GodDropOpportunityCandidate | null {
    if (object.distance > GOD_DROP_SCAN_RADIUS) {
      return null;
    }

    return this.withScore({
      id: `object:${object.id}`,
      kind: 'object',
      branch: 'objectFocused',
      targetId: object.id,
      objectId: object.id,
      label: `看看${object.label}`,
      distance: object.distance,
      baseScore: BASE_OBJECT_SCORE,
      reasons: ['nearbyObject', `kind:${object.kind}`],
      targetPosition: object.position,
    });
  }

  private createActivityCandidates(
    input: CreateGodDropOpportunityInput,
    activity: JoinableActivity,
  ): GodDropOpportunityCandidate[] {
    if (!activity.location) {
      return [];
    }

    const distance = getDistance(input.droppedAt, activity.location);

    if (distance > GOD_DROP_SCAN_RADIUS) {
      return [];
    }

    const activityFocusedCandidate = this.withScore({
      id: `activity:${activity.id}:activityFocused`,
      kind: 'activity',
      branch: 'activityFocused',
      targetId: activity.id,
      activityId: activity.id,
      label: `加入${formatActivityLabel(activity)}`,
      distance,
      baseScore: BASE_ACTIVITY_SCORE + (activity.participantIds.length > 1 ? GROUP_ACTIVITY_SCORE : 0),
      reasons: ['nearbyActivity', `phase:${activity.phase}`],
    });

    const relationshipFocusedCandidates = this.createActivityParticipantRelationshipCandidates(input, activity);

    return [activityFocusedCandidate, ...relationshipFocusedCandidates]
      .filter((candidate): candidate is GodDropOpportunityCandidate => candidate !== null);
  }

  private createActivityParticipantRelationshipCandidates(
    input: CreateGodDropOpportunityInput,
    activity: JoinableActivity,
  ): GodDropOpportunityCandidate[] {
    return activity.participantIds
      .map(participantId => this.createActivityParticipantRelationshipCandidate(input, activity, participantId))
      .filter((candidate): candidate is GodDropOpportunityCandidate => candidate !== null);
  }

  private createActivityParticipantRelationshipCandidate(
    input: CreateGodDropOpportunityInput,
    activity: JoinableActivity,
    participantId: string,
  ): GodDropOpportunityCandidate | null {
    if (input.isCharacterUnavailable?.(participantId)) {
      return null;
    }

    const distance = input.getCharacterDistance(participantId);

    if (distance === null || distance > GOD_DROP_SCAN_RADIUS) {
      return null;
    }

    const relationshipStatus = input.getRelationshipStatus(participantId);
    const activityShapeScore = activity.participantIds.length === 1
      ? SINGLE_ACTIVITY_RELATIONSHIP_SCORE
      : GROUP_ACTIVITY_RELATIONSHIP_SCORE;

    return this.withScore({
      id: `activity:${activity.id}:relationshipFocused:${participantId}`,
      kind: 'activity',
      branch: 'relationshipFocused',
      targetId: participantId,
      activityId: activity.id,
      participantId,
      label: formatRelationshipLabel(input.getCharacterName(participantId), relationshipStatus),
      distance,
      baseScore: BASE_PERSON_SCORE +
        getRelationshipScore(relationshipStatus) +
        activityShapeScore +
        (distance <= 1 ? NEAR_PERSON_SCORE : 0),
      reasons: [
        activity.participantIds.length === 1 ? 'singleParticipantActivity' : 'groupActivityParticipant',
        `relationship:${relationshipStatus}`,
      ],
    });
  }

  private createPersonCandidate(
    input: CreateGodDropOpportunityInput,
    characterId: string,
  ): GodDropOpportunityCandidate | null {
    const distance = input.getCharacterDistance(characterId);

    if (distance === null || distance > GOD_DROP_SCAN_RADIUS) {
      return null;
    }

    const relationshipStatus = input.getRelationshipStatus(characterId);
    return this.withScore({
      id: `person:${characterId}`,
      kind: 'person',
      branch: 'relationshipFocused',
      targetId: characterId,
      participantId: characterId,
      label: formatRelationshipLabel(input.getCharacterName(characterId), relationshipStatus),
      distance,
      baseScore: BASE_PERSON_SCORE + getRelationshipScore(relationshipStatus) + (distance <= 1 ? NEAR_PERSON_SCORE : 0),
      reasons: [`relationship:${relationshipStatus}`],
    });
  }

  private withScore(input: {
    id: string;
    kind: GodDropCandidateKind;
    branch: GodDropInteractionBranch;
    targetId: string;
    label: string;
    distance: number;
    baseScore: number;
    reasons: readonly string[];
    activityId?: string;
    participantId?: string;
    objectId?: string;
    targetPosition?: Position;
  }): GodDropOpportunityCandidate {
    const proximityScore = Math.max(0, GOD_DROP_SCAN_RADIUS + 1 - input.distance) * 5;
    const score = input.baseScore + proximityScore;
    const weight = Math.pow(score, 1.15);

    return {
      id: input.id,
      kind: input.kind,
      branch: input.branch,
      targetId: input.targetId,
      label: input.label,
      distance: input.distance,
      score,
      weight,
      reasons: input.reasons,
      activityId: input.activityId,
      participantId: input.participantId,
      objectId: input.objectId,
      targetPosition: input.targetPosition,
    };
  }
}

function getDistance(from: Position, to: Position): number {
  return Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y));
}

function formatActivityLabel(activity: JoinableActivity): string {
  if (activity.type === 'chat') {
    return '聊天';
  }

  if (activity.type === 'playWithItem') {
    return '道具活動';
  }

  return '活動';
}

function getRelationshipScore(status: SocialStatus): number {
  if (status === SocialStatus.Stranger) {
    return STRANGER_RELATIONSHIP_SCORE;
  }

  if (status === SocialStatus.Lovers || status === SocialStatus.Married) {
    return CLOSE_RELATIONSHIP_SCORE;
  }

  return KNOWN_RELATIONSHIP_SCORE;
}

function formatRelationshipLabel(characterName: string, status: SocialStatus): string {
  if (status === SocialStatus.Stranger) {
    return `認識${characterName}`;
  }

  if (status === SocialStatus.Lovers || status === SocialStatus.Married) {
    return `找${characterName}親密說話`;
  }

  return `找${characterName}說話`;
}
