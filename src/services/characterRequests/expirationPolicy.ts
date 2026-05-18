import type { CharacterRequest, CharacterRequestLevel } from './types';

const HOUR_MS = 60 * 60 * 1000;

const REQUEST_DURATION_BY_LEVEL: Record<CharacterRequestLevel, number | null> = {
  critical: null,
  social: 24 * HOUR_MS,
  minor: 5 * HOUR_MS,
};

export class CharacterRequestExpirationPolicy {
  getExpiresAt(level: CharacterRequestLevel, createdAt: number): number | null {
    const durationMs = REQUEST_DURATION_BY_LEVEL[level];

    return durationMs === null ? null : createdAt + durationMs;
  }

  isExpired(request: CharacterRequest, timestamp: number): boolean {
    if (request.status === 'resolving') {
      return false;
    }

    return request.expiresAt !== null && request.expiresAt <= timestamp;
  }
}
