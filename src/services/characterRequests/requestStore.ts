import type { CharacterRequest } from './types';

export class CharacterRequestStore {
  private readonly requestsByCharacterId = new Map<string, CharacterRequest>();

  getRequests(): readonly CharacterRequest[] {
    return Array.from(this.requestsByCharacterId.values())
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  getRequestForCharacter(characterId: string): CharacterRequest | null {
    return this.requestsByCharacterId.get(characterId) ?? null;
  }

  getActiveRequests(): readonly CharacterRequest[] {
    return this.getRequests().filter(request => request.status === 'active');
  }

  addRequest(request: CharacterRequest): boolean {
    if (this.requestsByCharacterId.has(request.characterId)) {
      return false;
    }

    this.requestsByCharacterId.set(request.characterId, request);
    return true;
  }

  removeRequest(requestId: string): CharacterRequest | null {
    const request = this.getRequestById(requestId);

    if (!request) {
      return null;
    }

    this.requestsByCharacterId.delete(request.characterId);
    return request;
  }

  removeExpiredRequests(isExpired: (request: CharacterRequest) => boolean): readonly CharacterRequest[] {
    const expiredRequests = this.getRequests().filter(isExpired);

    expiredRequests.forEach(request => {
      this.requestsByCharacterId.delete(request.characterId);
    });

    return expiredRequests;
  }

  markRequestResolving(requestId: string): CharacterRequest | null {
    const request = this.getRequestById(requestId);

    if (!request || request.status === 'resolving') {
      return null;
    }

    const resolvingRequest = {
      ...request,
      status: 'resolving' as const,
    };

    this.requestsByCharacterId.set(request.characterId, resolvingRequest);
    return resolvingRequest;
  }

  clear(): void {
    this.requestsByCharacterId.clear();
  }

  private getRequestById(requestId: string): CharacterRequest | null {
    return this.getRequests().find(request => request.id === requestId) ?? null;
  }
}
