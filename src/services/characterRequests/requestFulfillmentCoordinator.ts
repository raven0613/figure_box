import type {
  TransientMoment,
  TransientMomentCoordinator,
} from '~/services/transientMomentCoordinator';
import { CharacterControlReason } from '~/stateMachines/gameFlow/controlReasons';
import { CharacterControlState } from '~/stateMachines/gameFlow/states';
import type { ItemDefinition } from '~/typing/item';
import type { CharacterRequest } from './types';

interface CharacterRequestFulfillmentCoordinatorOptions {
  momentCoordinator: TransientMomentCoordinator;
  showCharacterBubble: (characterId: string, text: string, durationMs?: number) => void;
  holdItem?: (characterId: string, itemDefinition: ItemDefinition) => void;
  releaseHeldItem?: (characterId: string) => void;
  onFulfillmentFinished: (request: CharacterRequest) => void;
}

interface StartCharacterRequestFulfillmentInput {
  request: CharacterRequest;
  participantIds?: readonly string[];
  observerIds?: readonly string[];
  sourceActivityId?: string;
  sourceActivityIds?: readonly string[];
  timestamp: number;
  durationMs?: number;
  rewardText?: string;
  fulfilledItemDefinition?: ItemDefinition;
}

const DEFAULT_FULFILLMENT_DURATION_MS = 4000;

export class CharacterRequestFulfillmentCoordinator {
  private readonly momentCoordinator: TransientMomentCoordinator;
  private readonly showCharacterBubble: (characterId: string, text: string, durationMs?: number) => void;
  private readonly holdItem?: (characterId: string, itemDefinition: ItemDefinition) => void;
  private readonly releaseHeldItem?: (characterId: string) => void;
  private readonly onFulfillmentFinished: (request: CharacterRequest) => void;

  constructor(options: CharacterRequestFulfillmentCoordinatorOptions) {
    this.momentCoordinator = options.momentCoordinator;
    this.showCharacterBubble = options.showCharacterBubble;
    this.holdItem = options.holdItem;
    this.releaseHeldItem = options.releaseHeldItem;
    this.onFulfillmentFinished = options.onFulfillmentFinished;
  }

  start(input: StartCharacterRequestFulfillmentInput): TransientMoment | null {
    const durationMs = input.durationMs ?? DEFAULT_FULFILLMENT_DURATION_MS;
    const participantIds = input.participantIds ?? [input.request.characterId];
    this.holdFulfilledItem(input);

    const moment = this.momentCoordinator.start({
      id: `request-fulfillment-${input.request.id}-${input.timestamp}`,
      participantIds,
      observerIds: input.observerIds,
      sourceActivityId: input.sourceActivityId,
      sourceActivityIds: input.sourceActivityIds,
      timestamp: input.timestamp,
      durationMs,
      lockReason: CharacterControlReason.RequestFulfillment,
      lockParts: ['bodyAction', 'bodyMove', 'mind', 'communication'],
      controlState: CharacterControlState.RequestFulfillment,
      pauseParticipantWalks: true,
      curiosityLabel: '好奇',
      performanceId: input.request.fulfillmentPerformanceId,
      performanceCharacterIds: [input.request.characterId],
      onFinished: () => {
        this.releaseFulfilledItem(input);
        this.onFulfillmentFinished(input.request);
      },
    });

    if (!moment) {
      this.releaseFulfilledItem(input);
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

  private holdFulfilledItem(input: StartCharacterRequestFulfillmentInput): void {
    if (!input.fulfilledItemDefinition || !this.holdItem) {
      return;
    }

    this.holdItem(input.request.characterId, input.fulfilledItemDefinition);
  }

  private releaseFulfilledItem(input: StartCharacterRequestFulfillmentInput): void {
    if (!input.fulfilledItemDefinition || !this.releaseHeldItem) {
      return;
    }

    this.releaseHeldItem(input.request.characterId);
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
