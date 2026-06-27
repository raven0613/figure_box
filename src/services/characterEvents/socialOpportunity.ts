import { Feeling, SocialStatus } from '~/constants/character';

export interface CharacterSocialOpportunity {
  characterId: string;
  feeling: Feeling;
  intimacy: number;
  socialStatus: SocialStatus;
}

const SOCIAL_STATUS_SCORE: Record<SocialStatus, number> = {
  [SocialStatus.Hostile]: 0,
  [SocialStatus.Distant]: 0,
  [SocialStatus.Stranger]: 0,
  [SocialStatus.Acquaintance]: 0.5,
  [SocialStatus.Friendly]: 1.2,
  [SocialStatus.Friend]: 2,
  [SocialStatus.CloseFriend]: 3,
  [SocialStatus.BestFriend]: 4,
  [SocialStatus.Lovers]: 5,
  [SocialStatus.Married]: 5,
};

const FEELING_SCORE: Record<Feeling, number> = {
  [Feeling.Hate]: 0,
  [Feeling.Dislike]: 0,
  [Feeling.Wary]: 0,
  [Feeling.Neutral]: 0,
  [Feeling.Warm]: 1,
  [Feeling.Like]: 2,
  [Feeling.Fond]: 3,
  [Feeling.SecretCrush]: 4,
  [Feeling.OpenCrush]: 4,
  [Feeling.Love]: 5,
};

const MAX_INTIMACY_SCORE = 4;
const SOCIAL_OPPORTUNITY_MULTIPLIER_PER_SCORE = 0.07;
const MAX_SOCIAL_OPPORTUNITY_MULTIPLIER = 2;

export function getSocialOpportunityScore(opportunity: CharacterSocialOpportunity): number {
  const positiveIntimacy = Math.max(0, Math.min(100, opportunity.intimacy));
  const intimacyScore = positiveIntimacy / 100 * MAX_INTIMACY_SCORE;

  return SOCIAL_STATUS_SCORE[opportunity.socialStatus] +
    FEELING_SCORE[opportunity.feeling] +
    intimacyScore;
}

export function getSocialOpportunityWeightMultiplier(
  opportunities: readonly CharacterSocialOpportunity[],
): number {
  if (opportunities.length === 0) {
    return 1;
  }

  const scores = opportunities.map(getSocialOpportunityScore);
  const maxScore = Math.max(...scores);
  const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const weightedScore = maxScore * 0.75 + averageScore * 0.25;

  return Math.min(
    MAX_SOCIAL_OPPORTUNITY_MULTIPLIER,
    1 + weightedScore * SOCIAL_OPPORTUNITY_MULTIPLIER_PER_SCORE,
  );
}
