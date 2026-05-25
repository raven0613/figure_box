import type {
  OfflineElapsedTimePolicy,
  OfflineSimulationPlan,
  OfflineSimulationSlotPlan,
} from './types';

export function createOfflineSimulationPlan(input: {
  elapsedMs: number | null;
  lastActiveAt: number | null;
  now: number;
  policy: OfflineElapsedTimePolicy;
}): OfflineSimulationPlan {
  const elapsedMs = Math.max(0, input.elapsedMs ?? 0);

  if (elapsedMs < input.policy.ignoreBelowMs) {
    return {
      ignored: true,
      elapsedMs,
      simulatedMs: 0,
      slotCount: 0,
      slots: [],
    };
  }

  const simulatedMs = Math.min(elapsedMs, input.policy.maxSimulatedMs);
  const slotCount = Math.min(
    input.policy.maxSlots,
    Math.max(1, Math.ceil(simulatedMs / input.policy.slotDurationMs)),
  );
  const slotDurationMs = simulatedMs / slotCount;
  const startAt = input.lastActiveAt ?? input.now - elapsedMs;
  const slots = Array.from({ length: slotCount }).map<OfflineSimulationSlotPlan>((_, index) => ({
    index,
    timestamp: Math.round(startAt + slotDurationMs * (index + 1)),
    durationMs: Math.round(slotDurationMs),
  }));

  return {
    ignored: false,
    elapsedMs,
    simulatedMs: Math.round(simulatedMs),
    slotCount,
    slots,
  };
}
