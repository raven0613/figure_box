import type { CharacterContext } from '~/stateMachines/gameFlow/context';
import type { CharacterEventCandidate } from '~/services/characterEvents/types';
import type { OfflineResolutionPreview } from './types';
import { resolveOfflineSoloEventPreview } from './offlineSoloEventResolver';

export function resolveOfflineEventPreview(
  candidate: CharacterEventCandidate,
  context: CharacterContext,
): OfflineResolutionPreview {
  const soloPreview = resolveOfflineSoloEventPreview(candidate, context);

  if (soloPreview) {
    return soloPreview;
  }

  return {
    kind: 'unsupported',
    reason: `Offline resolver preview is not implemented for "${candidate.id}".`,
  };
}
