import {
  getCharacterStateSummary,
} from '~/stateMachines/gameFlow/children/character';
import {
  normalizeRelationshipPair,
  type RelationshipStore,
} from '~/stateMachines/gameFlow/relationships';
import type { CharacterSnapshot } from '~/services/townCharacterController';
import type { GodDropOpportunity } from '~/services/godDropOpportunityService';
import type { CharacterRequest } from '~/services/characterRequests/types';
import {
  MINOR_REQUEST_MAP_MIN_ZOOM,
  type RequestListItem,
} from '~/services/characterRequests/visibility';
import type { JoinableActivity } from '~/services/characterEvents/joinableActivities';
import { CHARACTER_EVENT_DEFINITIONS_BY_ID } from '~/constants/charactarEventsDefinitions';
import { MemoryType, SocialStatus } from '~/constants/character';
import {
  CharacterBodyActionState,
  CharacterBodyMoveState,
  type CharacterStateSummary,
} from '~/stateMachines/gameFlow/states';

import styles from './townMap.module.scss';

interface DebugWindowActionsProps {
  isInventoryPanelOpen: boolean;
  isRequestPanelOpen: boolean;
  isExpressionBubblePreviewOpen: boolean;
  onOpenInventory: () => void;
  onOpenRequests: () => void;
  onOpenExpressionBubblePreview: () => void;
}

export function DebugWindowActions({
  isInventoryPanelOpen,
  isRequestPanelOpen,
  isExpressionBubblePreviewOpen,
  onOpenInventory,
  onOpenRequests,
  onOpenExpressionBubblePreview,
}: DebugWindowActionsProps) {
  return (
    <div className={styles.debugWindowActions}>
      <div className={styles.panelTitle}>Debug Windows</div>
      <button
        className={styles.debugWindowButton}
        type="button"
        onClick={onOpenInventory}
        disabled={isInventoryPanelOpen}
      >
        打開物品欄
      </button>
      <button
        className={styles.debugWindowButton}
        type="button"
        onClick={onOpenRequests}
        disabled={isRequestPanelOpen}
      >
        打開 Requests
      </button>
      <button
        className={styles.debugWindowButton}
        type="button"
        onClick={onOpenExpressionBubblePreview}
        disabled={isExpressionBubblePreviewOpen}
      >
        表情泡泡預覽
      </button>
    </div>
  );
}

interface CharacterRequestDebugPanelProps {
  items: readonly RequestListItem[];
  mapZoom: number;
  onCompleteRequest: (requestId: string) => void;
}

export function CharacterRequestDebugPanel({
  items,
  mapZoom,
  onCompleteRequest,
}: CharacterRequestDebugPanelProps) {
  return (
    <div className={styles.requestPanel}>
      <div className={styles.detailRow}>
        <span>Minor map zoom</span>
        <strong>{mapZoom >= MINOR_REQUEST_MAP_MIN_ZOOM ? 'visible' : `${mapZoom.toFixed(1)} / 3`}</strong>
      </div>
      {items.length === 0 ? (
        <div className={styles.detailRow}>
          <span>Active</span>
          <strong>-</strong>
        </div>
      ) : items.map(item => (
        <div className={styles.requestRow} key={item.request.id}>
          <div className={styles.detailRow}>
            <span>{item.characterName}</span>
            <strong>{item.request.status}</strong>
          </div>
          <div className={styles.detailRow}>
            <span>{item.request.label}</span>
            <strong className={styles[getRequestLevelClassName(item.request.level)]}>
              {item.levelLabel} / {formatRequestRemainingTime(item.request)}
            </strong>
          </div>
          <div className={styles.detailRow}>
            <span>Location</span>
            <strong>{item.locationLabel}</strong>
          </div>
          {item.request.target?.targetCharacterName ? (
            <div className={styles.detailRow}>
              <span>Target</span>
              <strong>{item.request.target.targetCharacterName}</strong>
            </div>
          ) : null}
          <button
            className={styles.requestButton}
            type="button"
            onClick={() => onCompleteRequest(item.request.id)}
          >
            Complete
          </button>
        </div>
      ))}
    </div>
  );
}

interface GodDropOpportunityPanelProps {
  opportunity: GodDropOpportunity | null;
  onSelectCandidate: (candidateId: string) => void;
}

export function GodDropOpportunityPanel({
  opportunity,
  onSelectCandidate,
}: GodDropOpportunityPanelProps) {
  if (!opportunity) {
    return null;
  }

  const visibleCandidates = opportunity.candidates.slice(0, 5);

  return (
    <div className={styles.godDropPanel}>
      <div className={styles.panelTitle}>God Drop</div>
      <div className={styles.detailRow}>
        <span>Auto</span>
        <strong>{Math.max(0, Math.ceil((opportunity.autoDecisionAt - Date.now()) / 1000))}s</strong>
      </div>
      <div className={styles.godDropActions}>
        {visibleCandidates.map(candidate => (
          <button
            className={styles.godDropButton}
            key={candidate.id}
            type="button"
            onClick={() => onSelectCandidate(candidate.id)}
          >
            <span>{candidate.label}</span>
            <strong>{Math.round(candidate.score)}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

interface ActivityDebugPanelProps {
  activities: readonly JoinableActivity[];
  allSnapshots: Record<string, CharacterSnapshot>;
}

export function ActivityDebugPanel({
  activities,
  allSnapshots,
}: ActivityDebugPanelProps) {
  return (
    <div className={styles.activityPanel}>
      <div className={styles.panelTitle}>Activities</div>
      {activities.length === 0 ? (
        <div className={styles.detailRow}>
          <span>Active</span>
          <strong>-</strong>
        </div>
      ) : activities.map(activity => (
        <div className={styles.activityRow} key={activity.id}>
          <div className={styles.detailRow}>
            <span>{activity.activityKey}</span>
            <strong>{activity.phase}</strong>
          </div>
          <div className={styles.detailRow}>
            <span>Type</span>
            <strong>{activity.type}</strong>
          </div>
          <div className={styles.detailRow}>
            <span>People</span>
            <strong>{formatActivityParticipantNames(activity, allSnapshots)}</strong>
          </div>
          <div className={styles.detailRow}>
            <span>Arrived</span>
            <strong>{formatActivityArrivalDebug(activity, allSnapshots)}</strong>
          </div>
          <div className={styles.detailRow}>
            <span>Location</span>
            <strong>{activity.location ? `${activity.location.x}, ${activity.location.y}` : '-'}</strong>
          </div>
          <div className={styles.detailRow}>
            <span>Ends in</span>
            <strong>{formatActivityRemainingTime(activity)}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}

interface CharacterStatusPanelProps {
  snapshot: CharacterSnapshot;
  allSnapshots: Record<string, CharacterSnapshot>;
  activities: readonly JoinableActivity[];
  relationshipStore: RelationshipStore;
}

export function CharacterStatusPanel({
  snapshot,
  allSnapshots,
  activities,
  relationshipStore,
}: CharacterStatusPanelProps) {
  const summary = getCharacterStateSummary(snapshot.value);
  const inviteAvailability = getInviteAvailabilityDebugText(snapshot, summary);
  const chatMoodAcceptance = getMoodAcceptanceDebugText('environment.nearbyCharacter.chat', snapshot.context.status.moodValue);
  const playMoodAcceptance = getMoodAcceptanceDebugText('environment.nearbyCharacter.play', snapshot.context.status.moodValue);
  const chatFinalAcceptance = getFinalAcceptanceDebugText(inviteAvailability.isAvailable, chatMoodAcceptance);
  const playFinalAcceptance = getFinalAcceptanceDebugText(inviteAvailability.isAvailable, playMoodAcceptance);
  const currentActivityId = snapshot.context.currentActivity?.activityId ?? snapshot.context.pendingActivityJoin?.activityId;
  const currentActivity = currentActivityId
    ? activities.find(activity => activity.id === currentActivityId)
    : undefined;

  return (
    <div className={styles.characterPanel}>
      <div className={styles.panelTitle}>{snapshot.context.name}</div>
      <div className={styles.detailRow}>
        <span>Body action</span>
        <strong>{summary.bodyAction}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Body move</span>
        <strong>{summary.bodyMove}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Mind</span>
        <strong>{summary.mind}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Comm</span>
        <strong>{summary.communication}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Control</span>
        <strong>{summary.control}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Motivation</span>
        <strong>{snapshot.context.currentMotivation}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Activity</span>
        <strong>{snapshot.context.currentActivity?.activityId ?? snapshot.context.pendingActivityJoin?.activityId ?? '-'}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Activity members</span>
        <strong>{currentActivity ? formatActivityParticipantNames(currentActivity, allSnapshots) : '-'}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Event bucket</span>
        <strong>{snapshot.context.lastEventDecision?.selectedBucketId ?? '-'}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Motivation picked</span>
        <strong>{snapshot.context.lastEventDecision?.selectedMotivation ?? '-'}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Event picked</span>
        <strong>{snapshot.context.lastEventDecision?.selectedCandidateId ?? '-'}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Variant</span>
        <strong>{snapshot.context.lastEventDecision?.selectedPresentationVariantId ?? '-'}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Tags</span>
        <strong>{snapshot.context.lastEventDecision?.selectedPresentationTags.join(', ') || '-'}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Candidates</span>
        <strong>{snapshot.context.lastEventDecision?.candidateCount ?? 0}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Motivations</span>
        <strong>{snapshot.context.lastEventDecision?.motivationCount ?? 0}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Motivation candidates</span>
        <strong>{snapshot.context.lastEventDecision?.selectedMotivationCandidateCount ?? 0}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Saturation</span>
        <strong>{snapshot.context.status.saturation}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Mood</span>
        <strong>{snapshot.context.status.moodValue}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Play need</span>
        <strong>{Math.round(snapshot.context.status.playNeed)}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Invite ready</span>
        <strong>{inviteAvailability.text}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Chat mood</span>
        <strong>{chatMoodAcceptance.text}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Chat final</span>
        <strong>{chatFinalAcceptance}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Play mood</span>
        <strong>{playMoodAcceptance.text}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Play final</span>
        <strong>{playFinalAcceptance}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Eat score</span>
        <strong>{snapshot.context.utilityScores.findFood}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Play score</span>
        <strong>{snapshot.context.utilityScores.play}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Chat score</span>
        <strong>{snapshot.context.utilityScores.chat}</strong>
      </div>
      {snapshot.context.relationships.map(relationship => {
        const targetName = allSnapshots[relationship.targetCharId]?.context.name ?? relationship.targetCharId;
        const pair = normalizeRelationshipPair(snapshot.context.id, relationship.targetCharId);
        const mutualStatus = pair
          ? relationshipStore.mutualRelationships.find(
            m => m.charIds[0] === pair[0] && m.charIds[1] === pair[1],
          )?.status ?? SocialStatus.Stranger
          : SocialStatus.Stranger;

        return (
          <div className={styles.relationshipRow} key={relationship.targetCharId}>
            <div className={styles.detailRow}>
              <span>{targetName}</span>
            </div>
            <div className={styles.detailRow}>
              <span>Feeling</span>
              <strong>{relationship.feeling}</strong>
            </div>
            <div className={styles.detailRow}>
              <span>Intimacy</span>
              <strong>{relationship.intimacy}</strong>
            </div>
            <div className={styles.detailRow}>
              <span>Relationship</span>
              <strong>{mutualStatus}</strong>
            </div>
            <div className={styles.detailRow}>
              <span>Impression</span>
              <strong>{relationship.memories[MemoryType.Impression].counts}</strong>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatRequestRemainingTime(request: CharacterRequest): string {
  if (request.expiresAt === null) {
    return 'never';
  }

  const remainingMs = Math.max(0, request.expiresAt - Date.now());
  const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
  const remainingMinutes = Math.ceil((remainingMs % (60 * 60 * 1000)) / (60 * 1000));

  if (remainingHours <= 0) {
    return `${remainingMinutes}m`;
  }

  return `${remainingHours}h ${remainingMinutes}m`;
}

function getRequestLevelClassName(level: CharacterRequest['level']): string {
  if (level === 'critical') {
    return 'requestLevelCritical';
  }

  if (level === 'social') {
    return 'requestLevelSocial';
  }

  return 'requestLevelMinor';
}

function formatActivityRemainingTime(activity: JoinableActivity): string {
  if (activity.pausedAt !== undefined) {
    return `${Math.max(0, Math.ceil((activity.remainingMs ?? 0) / 1000))}s paused`;
  }

  return `${Math.max(0, Math.ceil((activity.endsAt - Date.now()) / 1000))}s`;
}

function formatActivityParticipantNames(
  activity: JoinableActivity,
  allSnapshots: Record<string, CharacterSnapshot>,
): string {
  return activity.participantIds
    .map(characterId => allSnapshots[characterId]?.context.name ?? characterId)
    .join(', ');
}

function formatActivityArrivalDebug(
  activity: JoinableActivity,
  allSnapshots: Record<string, CharacterSnapshot>,
): string {
  if (!activity.location) {
    return '-';
  }

  const activityLocation = activity.location;

  return activity.participantIds
    .map(characterId => {
      const snapshot = allSnapshots[characterId];
      const name = snapshot?.context.name ?? characterId;

      if (!snapshot) {
        return `${name}: no snapshot`;
      }

      const position = snapshot.context.position;
      const target = snapshot.context.target;
      const isArrived = isNearPosition(position, activityLocation, 2);
      const status = isArrived ? 'arrived' : 'not yet';
      const targetText = target ? ` -> ${target.x},${target.y}` : '';

      return `${name}: ${status} (${position.x},${position.y}${targetText})`;
    })
    .join(' / ');
}

function getMoodAcceptanceDebugText(eventId: string, moodValue: number): { isGuaranteed: boolean; text: string } {
  const acceptance = CHARACTER_EVENT_DEFINITIONS_BY_ID[eventId]?.acceptance;

  if (!acceptance) {
    return { isGuaranteed: false, text: '-' };
  }

  const minMoodValue = acceptance.minMoodValue ?? 30;
  const fallbackPercent = Math.round((acceptance.fallbackChance ?? 0.3) * 100);
  const isGuaranteed = moodValue >= minMoodValue;
  const state = isGuaranteed ? 'yes' : `${fallbackPercent}%`;

  return {
    isGuaranteed,
    text: `${state} (mood >= ${minMoodValue}, fallback ${fallbackPercent}%)`,
  };
}

function getFinalAcceptanceDebugText(
  isAvailable: boolean,
  moodAcceptance: { isGuaranteed: boolean; text: string },
): string {
  if (!isAvailable) {
    return 'no (busy)';
  }

  return moodAcceptance.isGuaranteed ? 'yes' : moodAcceptance.text;
}

function getInviteAvailabilityDebugText(
  snapshot: CharacterSnapshot,
  summary: CharacterStateSummary,
): { isAvailable: boolean; text: string } {
  if (snapshot.context.target) {
    return { isAvailable: false, text: 'no (has target)' };
  }

  if (snapshot.context.currentMotivation !== 'idle') {
    return { isAvailable: false, text: `no (${snapshot.context.currentMotivation})` };
  }

  if (summary.bodyAction !== CharacterBodyActionState.Idle || summary.bodyMove !== CharacterBodyMoveState.Stand) {
    return { isAvailable: false, text: `no (${summary.bodyMove}/${summary.bodyAction})` };
  }

  if (snapshot.context.locks.bodyAction.length > 0 || snapshot.context.locks.bodyMove.length > 0) {
    return { isAvailable: false, text: 'no (locked)' };
  }

  return { isAvailable: true, text: 'yes' };
}

function isNearPosition(position: { x: number; y: number }, target: { x: number; y: number }, range: number): boolean {
  return Math.max(
    Math.abs(position.x - target.x),
    Math.abs(position.y - target.y),
  ) <= range;
}
