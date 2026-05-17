export interface WeightedCandidate<T> {
  item: T;
  weight: number;
}

export class WeightedDecisionSelector {
  select<T>(
    candidates: readonly WeightedCandidate<T>[],
    random: () => number = Math.random,
  ): T | null {
    const validCandidates = candidates.filter(candidate => candidate.weight > 0);
    const totalWeight = validCandidates.reduce((sum, candidate) => sum + candidate.weight, 0);

    if (totalWeight <= 0) {
      return null;
    }

    let cursor = random() * totalWeight;

    for (const candidate of validCandidates) {
      cursor -= candidate.weight;

      if (cursor <= 0) {
        return candidate.item;
      }
    }

    return validCandidates.at(-1)?.item ?? null;
  }
}
