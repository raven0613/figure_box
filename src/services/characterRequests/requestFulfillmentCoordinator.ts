import type {
  ActivityInterruptionMoment,
  ActivityInterruptionMomentCoordinator,
} from '~/services/activityInterruptionMomentCoordinator';
import type { CharacterRequest } from './types';

interface CharacterRequestFulfillmentCoordinatorOptions {
  momentCoordinator: ActivityInterruptionMomentCoordinator;
  showCharacterBubble: (characterId: string, text: string, durationMs?: number) => void;
  onFulfillmentFinished: (request: CharacterRequest) => void;
}

interface StartCharacterRequestFulfillmentInput {
  request: CharacterRequest;
  participantIds?: readonly string[];
  observerIds?: readonly string[];
  sourceActivityId?: string;
  timestamp: number;
  durationMs?: number;
  rewardText?: string;
}

const REQUEST_FULFILLMENT_LOCK_REASON = 'characterRequestFulfillment';
const DEFAULT_FULFILLMENT_DURATION_MS = 4000;

export class CharacterRequestFulfillmentCoordinator {
  private readonly momentCoordinator: ActivityInterruptionMomentCoordinator;
  private readonly showCharacterBubble: (characterId: string, text: string, durationMs?: number) => void;
  private readonly onFulfillmentFinished: (request: CharacterRequest) => void;

  constructor(options: CharacterRequestFulfillmentCoordinatorOptions) {
    this.momentCoordinator = options.momentCoordinator;
    this.showCharacterBubble = options.showCharacterBubble;
    this.onFulfillmentFinished = options.onFulfillmentFinished;
  }

  start(input: StartCharacterRequestFulfillmentInput): ActivityInterruptionMoment | null {
    const durationMs = input.durationMs ?? DEFAULT_FULFILLMENT_DURATION_MS;
    const participantIds = input.participantIds ?? [input.request.characterId];
    const moment = this.momentCoordinator.start({
      id: `request-fulfillment-${input.request.id}-${input.timestamp}`,
      participantIds,
      observerIds: input.observerIds,
      sourceActivityId: input.sourceActivityId,
      timestamp: input.timestamp,
      durationMs,
      lockReason: REQUEST_FULFILLMENT_LOCK_REASON,
      lockParts: ['bodyAction', 'bodyMove', 'mind', 'communication'],
      pauseParticipantWalks: true,
      curiosityLabel: '好奇',
      onFinished: () => {
        this.onFulfillmentFinished(input.request);
      },
    });

    if (!moment) {
      return null;
    }

    this.showCharacterBubble(
      input.request.characterId,
      input.rewardText ?? getDefaultRewardText(input.request),
      durationMs,
    );
    return moment;
  }

  dispose(): void {
    this.momentCoordinator.dispose();
  }
}

function getDefaultRewardText(request: CharacterRequest): string {
  if (request.kind === 'food') {
    return '謝謝你，我正想吃這個';
  }

  if (request.kind === 'item') {
    return '謝謝你，我會好好珍惜';
  }

  return '謝謝你幫我完成心願';
}
