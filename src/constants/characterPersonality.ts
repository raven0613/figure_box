export type PersonalityLevel = 1 | 2 | 3 | 4 | 5;

export type CharacterPersonalityTraitKey =
  | 'socialTendency'
  | 'initiative'
  | 'activityPace'
  | 'emotionalExpression'
  | 'noveltyPreference'
  | 'interpersonalAttitude';

export type CharacterPersonality = Record<CharacterPersonalityTraitKey, PersonalityLevel>;

export interface CharacterPersonalityTraitDefinition {
  key: CharacterPersonalityTraitKey;
  label: string;
  options: readonly [string, string, string, string, string];
}

export const DEFAULT_PERSONALITY_LEVEL: PersonalityLevel = 3;

export const DEFAULT_CHARACTER_PERSONALITY: Readonly<CharacterPersonality> = Object.freeze({
  socialTendency: DEFAULT_PERSONALITY_LEVEL,
  initiative: DEFAULT_PERSONALITY_LEVEL,
  activityPace: DEFAULT_PERSONALITY_LEVEL,
  emotionalExpression: DEFAULT_PERSONALITY_LEVEL,
  noveltyPreference: DEFAULT_PERSONALITY_LEVEL,
  interpersonalAttitude: DEFAULT_PERSONALITY_LEVEL,
});

export function createDefaultCharacterPersonality(): CharacterPersonality {
  return { ...DEFAULT_CHARACTER_PERSONALITY };
}

export const CHARACTER_PERSONALITY_TRAITS: readonly CharacterPersonalityTraitDefinition[] = [
  {
    key: 'socialTendency',
    label: '社交傾向',
    options: ['偏好獨處', '小圈相處', '隨遇而安', '喜歡相處', '熱愛群聚'],
  },
  {
    key: 'initiative',
    label: '行動主動性',
    options: ['等待帶領', '偏向配合', '視情況行動', '常會發起', '積極帶頭'],
  },
  {
    key: 'activityPace',
    label: '活動節奏',
    options: ['慢步調', '悠閒', '張弛適中', '活力充沛', '忙個不停'],
  },
  {
    key: 'emotionalExpression',
    label: '情緒表現',
    options: ['深藏情緒', '稍顯克制', '自然流露', '表情豐富', '喜怒形於色'],
  },
  {
    key: 'noveltyPreference',
    label: '新鮮感偏好',
    options: ['重視熟悉', '偏好安穩', '偶爾嘗鮮', '喜歡探索', '追求新奇'],
  },
  {
    key: 'interpersonalAttitude',
    label: '待人態度',
    options: ['保持界線', '慢慢靠近', '視關係而定', '親切關心', '熱心照顧'],
  },
];
