import type { CharacterContext } from '~/stateMachines/gameFlow/context';
import type {
  CharacterEventCandidate,
  CharacterEventDecisionInput,
} from '~/services/characterEvents/types';
import type { OfflineResolutionPreview } from './types';
import { resolveOfflineActivityPreview } from './resolvers/offlineActivityResolver';
import { resolveOfflineActionPreview } from './resolvers/offlineActionResolver';

export function resolveOfflineEventPreview(
  candidate: CharacterEventCandidate,
  context: CharacterContext,
  input: CharacterEventDecisionInput,
  contexts: readonly CharacterContext[],
): OfflineResolutionPreview {
  const resolverContext = {
    candidate,
    character: context,
    input,
    contexts,
  };
  const activityPreview = resolveOfflineActivityPreview(resolverContext);

  if (activityPreview) {
    return activityPreview;
  }

  const actionPreview = resolveOfflineActionPreview(resolverContext);

  if (actionPreview) {
    return actionPreview;
  }

  return {
    kind: 'unsupported',
    reason: `unsupportedActionType:${candidate.event.type}`,
  };
}
