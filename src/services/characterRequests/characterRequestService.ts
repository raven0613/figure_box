import type { CharacterEventDecisionInput } from '~/services/characterEvents/types';
import type { CharacterContext } from '~/stateMachines/gameFlow/context';
import { CharacterRequestExpirationPolicy } from './expirationPolicy';
import { CharacterRequestGenerator } from './generator';
import {
  matchesItemRequest,
  matchesSocialRequest,
} from './matching';
import { CharacterRequestStore } from './requestStore';
import type {
  CharacterRequest,
  CharacterRequestDefinition,
  CharacterRequestGenerationResult,
  CharacterRequestItemMatchInput,
  CharacterRequestMatchResult,
  CharacterRequestSocialMatchInput,
} from './types';

interface CharacterRequestServiceOptions {
  definitions: readonly CharacterRequestDefinition[];
  random?: () => number;
}

export interface CharacterRequestTickInput extends CharacterEventDecisionInput {
  context: CharacterContext;
  timestamp: number;
}

export class CharacterRequestService {
  private readonly store = new CharacterRequestStore();
  private readonly expirationPolicy = new CharacterRequestExpirationPolicy();
  private readonly generator: CharacterRequestGenerator;
  private readonly random: () => number;

  constructor(options: CharacterRequestServiceOptions) {
    this.generator = new CharacterRequestGenerator(options.definitions);
    this.random = options.random ?? Math.random;
  }

  tickCharacter(input: CharacterRequestTickInput): CharacterRequestGenerationResult {
    const expiredRequests = this.expireRequests(input.timestamp);

    if (this.store.getRequestForCharacter(input.context.id)) {
      return {
        request: null,
        didChange: expiredRequests.length > 0,
      };
    }

    const definition = this.generator.selectDefinition(input, this.random);

    if (!definition) {
      return {
        request: null,
        didChange: expiredRequests.length > 0,
      };
    }

    const request = this.createRequest(input.context.id, definition, input.timestamp);
    const didAddRequest = this.store.addRequest(request);

    return {
      request: didAddRequest ? request : null,
      didChange: didAddRequest || expiredRequests.length > 0,
    };
  }

  completeRequest(requestId: string): CharacterRequest | null {
    return this.store.removeRequest(requestId);
  }

  markRequestResolving(requestId: string): CharacterRequest | null {
    return this.store.markRequestResolving(requestId);
  }

  markMatchingSocialRequestResolving(input: CharacterRequestSocialMatchInput): CharacterRequestMatchResult {
    return this.markMatchingRequestResolving(request => matchesSocialRequest(request, input));
  }

  markMatchingItemRequestResolving(input: CharacterRequestItemMatchInput): CharacterRequestMatchResult {
    return this.markMatchingRequestResolving(request => (
      request.characterId === input.characterId && matchesItemRequest(request, input)
    ));
  }

  getRequests(): readonly CharacterRequest[] {
    return this.store.getRequests();
  }

  clear(): void {
    this.store.clear();
  }

  private expireRequests(timestamp: number): readonly CharacterRequest[] {
    return this.store.removeExpiredRequests(request => this.expirationPolicy.isExpired(request, timestamp));
  }

  private createRequest(
    characterId: string,
    definition: CharacterRequestDefinition,
    timestamp: number,
  ): CharacterRequest {
    return {
      id: `request-${characterId}-${definition.id}-${timestamp}`,
      definitionId: definition.id,
      characterId,
      level: definition.level,
      kind: definition.kind,
      status: 'active',
      label: definition.label,
      target: definition.target,
      satisfiedEffects: definition.satisfiedEffects,
      createdAt: timestamp,
      expiresAt: this.expirationPolicy.getExpiresAt(definition.level, timestamp),
    };
  }

  private markMatchingRequestResolving(
    matchesRequest: (request: CharacterRequest) => boolean,
  ): CharacterRequestMatchResult {
    const matchedRequest = this.store.getActiveRequests().find(matchesRequest);

    if (!matchedRequest) {
      return {
        request: null,
        didChange: false,
      };
    }

    return {
      request: this.store.markRequestResolving(matchedRequest.id),
      didChange: true,
    };
  }
}
