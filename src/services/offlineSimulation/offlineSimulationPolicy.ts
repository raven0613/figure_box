import rawOfflineSimulationPolicy from '~/constants/offlineSimulationPolicy.json';
import { loadOfflineSimulationPolicy } from '~/utils/jsonParser/offlineSimulationPolicySchema';
import type {
  OfflineEventPolicyRule,
  OfflineSimulationPolicy,
  ResolvedOfflineEventPolicy,
} from './types';
import type { CharacterEventCandidate } from '~/services/characterEvents/types';

export const OFFLINE_SIMULATION_POLICY: OfflineSimulationPolicy =
  loadOfflineSimulationPolicy(rawOfflineSimulationPolicy);

export function resolveOfflineEventPolicy(
  policy: OfflineSimulationPolicy,
  candidate: Pick<CharacterEventCandidate, 'id' | 'bucketId' | 'motivation'>,
): ResolvedOfflineEventPolicy {
  const defaultPolicy = policy.events.default;
  const rules = [
    policy.events.bucket[candidate.bucketId],
    policy.events.motivation[candidate.motivation],
    policy.events.eventOverrides[candidate.id],
  ];

  return rules.reduce<ResolvedOfflineEventPolicy>(
    (resolvedPolicy, rule) => mergeOfflineEventPolicy(resolvedPolicy, rule),
    {
      enabled: defaultPolicy.enabled,
      weightMultiplier: defaultPolicy.weightMultiplier,
      recap: defaultPolicy.recap,
      maxPerReturn: defaultPolicy.maxPerReturn,
    },
  );
}

function mergeOfflineEventPolicy(
  resolvedPolicy: ResolvedOfflineEventPolicy,
  rule: OfflineEventPolicyRule | undefined,
): ResolvedOfflineEventPolicy {
  if (!rule) {
    return resolvedPolicy;
  }

  return {
    enabled: resolvedPolicy.enabled && (rule.enabled ?? true),
    weightMultiplier: resolvedPolicy.weightMultiplier * (rule.weightMultiplier ?? 1),
    recap: rule.recap ?? resolvedPolicy.recap,
    maxPerReturn: rule.maxPerReturn === undefined
      ? resolvedPolicy.maxPerReturn
      : Math.min(resolvedPolicy.maxPerReturn, rule.maxPerReturn),
  };
}
