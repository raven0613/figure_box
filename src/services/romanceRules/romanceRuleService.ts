import { Feeling } from '~/constants/character';

export type GlobalRomanceDefault = 'allow' | 'deny';
export type RomanceRuleType = 'allow' | 'deny' | 'onlyAllow';
export type RomanceRuleEndpoint = { type: 'all' } | { type: 'character'; characterId: string };
export type CharacterGender = 'male' | 'female' | 'nonBinary';
export type RomanticOrientation = 'none' | 'any' | 'male' | 'female' | 'nonBinary';
export type RomanceRuleAccessReason =
  | 'missingCharacter'
  | 'orientationMismatch'
  | 'onlyAllowMatched'
  | 'onlyAllowBlocked'
  | 'denyMatched'
  | 'allowMatched'
  | 'globalDefault';

export interface RomanceRule {
  id: string;
  type: RomanceRuleType;
  source: RomanceRuleEndpoint;
  target: RomanceRuleEndpoint;
}

export interface CharacterRomanceProfile {
  gender: CharacterGender;
  orientation: RomanticOrientation;
}

export interface RomanceRuleConfig {
  globalDefault: GlobalRomanceDefault;
  profilesByCharacterId: Record<string, CharacterRomanceProfile>;
  rules: RomanceRule[];
}

export interface RomanceRuleAccessResult {
  isAllowed: boolean;
  reason: RomanceRuleAccessReason;
  matchedRule?: RomanceRule;
}

export const DEFAULT_ROMANCE_PROFILE: CharacterRomanceProfile = {
  gender: 'male',
  orientation: 'any',
};

const ROMANTIC_FEELINGS: readonly Feeling[] = [
  Feeling.SecretCrush,
  Feeling.OpenCrush,
  Feeling.Love,
];

let runtimeConfig: RomanceRuleConfig = {
  globalDefault: 'allow',
  profilesByCharacterId: {},
  rules: [],
};

export function createDefaultRomanceProfiles(
  characterIds: readonly string[],
): Record<string, CharacterRomanceProfile> {
  return characterIds.reduce<Record<string, CharacterRomanceProfile>>((profilesByCharacterId, characterId) => ({
    ...profilesByCharacterId,
    [characterId]: DEFAULT_ROMANCE_PROFILE,
  }), {});
}

export function createDefaultRomanceRuleConfig(): RomanceRuleConfig {
  return {
    globalDefault: 'allow',
    profilesByCharacterId: {},
    rules: [],
  };
}

export function setRomanceRuleConfig(config: RomanceRuleConfig): void {
  runtimeConfig = cloneRomanceRuleConfig(config);
}

export function getRomanceRuleConfig(): RomanceRuleConfig {
  return cloneRomanceRuleConfig(runtimeConfig);
}

export function isRomanticFeeling(feeling: Feeling): boolean {
  return ROMANTIC_FEELINGS.includes(feeling);
}

export function canApplyRomanticFeeling(
  sourceId: string,
  targetId: string,
  config: RomanceRuleConfig = runtimeConfig,
): boolean {
  return evaluateRomanceRuleAccess({
    sourceId,
    targetId,
    config,
  }).isAllowed;
}

export function evaluateRomanceRuleAccess({
  sourceId,
  targetId,
  config,
}: {
  sourceId: string;
  targetId: string;
  config: RomanceRuleConfig;
}): RomanceRuleAccessResult {
  if (!sourceId || !targetId) {
    return {
      isAllowed: false,
      reason: 'missingCharacter',
    };
  }

  if (!doesTargetMatchSourceOrientation({
    sourceId,
    targetId,
    profilesByCharacterId: config.profilesByCharacterId,
  })) {
    return {
      isAllowed: false,
      reason: 'orientationMismatch',
    };
  }

  const sourceOnlyAllowRules = getSourceOnlyAllowRules(config.rules, sourceId);
  const matchingOnlyAllowRule = sourceOnlyAllowRules.find(rule => endpointMatchesCharacter(rule.target, targetId));

  if (matchingOnlyAllowRule) {
    return {
      isAllowed: true,
      reason: 'onlyAllowMatched',
      matchedRule: matchingOnlyAllowRule,
    };
  }

  if (sourceOnlyAllowRules.length > 0) {
    return {
      isAllowed: false,
      reason: 'onlyAllowBlocked',
      matchedRule: sourceOnlyAllowRules[0],
    };
  }

  const matchingDenyRule = config.rules.find(rule => (
    rule.type === 'deny'
    && endpointMatchesCharacter(rule.source, sourceId)
    && endpointMatchesCharacter(rule.target, targetId)
  ));

  if (matchingDenyRule) {
    return {
      isAllowed: false,
      reason: 'denyMatched',
      matchedRule: matchingDenyRule,
    };
  }

  const matchingAllowRule = config.rules.find(rule => (
    rule.type === 'allow'
    && endpointMatchesCharacter(rule.source, sourceId)
    && endpointMatchesCharacter(rule.target, targetId)
  ));

  if (matchingAllowRule) {
    return {
      isAllowed: true,
      reason: 'allowMatched',
      matchedRule: matchingAllowRule,
    };
  }

  return {
    isAllowed: config.globalDefault === 'allow',
    reason: 'globalDefault',
  };
}

export function getRomanceProfile(
  profilesByCharacterId: Record<string, CharacterRomanceProfile>,
  characterId: string,
): CharacterRomanceProfile {
  return profilesByCharacterId[characterId] ?? DEFAULT_ROMANCE_PROFILE;
}

function doesTargetMatchSourceOrientation({
  sourceId,
  targetId,
  profilesByCharacterId,
}: {
  sourceId: string;
  targetId: string;
  profilesByCharacterId: Record<string, CharacterRomanceProfile>;
}): boolean {
  const sourceProfile = getRomanceProfile(profilesByCharacterId, sourceId);
  const targetProfile = getRomanceProfile(profilesByCharacterId, targetId);

  if (sourceProfile.orientation === 'none') {
    return false;
  }

  return sourceProfile.orientation === 'any' || sourceProfile.orientation === targetProfile.gender;
}

function getSourceOnlyAllowRules(rules: readonly RomanceRule[], sourceId: string): RomanceRule[] {
  const characterSpecificRules = rules.filter(rule => (
    rule.type === 'onlyAllow'
    && rule.source.type === 'character'
    && rule.source.characterId === sourceId
  ));

  if (characterSpecificRules.length > 0) {
    return characterSpecificRules;
  }

  return rules.filter(rule => (
    rule.type === 'onlyAllow'
    && rule.source.type === 'all'
  ));
}

function endpointMatchesCharacter(endpoint: RomanceRuleEndpoint, characterId: string): boolean {
  return endpoint.type === 'all' || endpoint.characterId === characterId;
}

export function cloneRomanceRuleConfig(config: RomanceRuleConfig): RomanceRuleConfig {
  return {
    globalDefault: config.globalDefault,
    profilesByCharacterId: Object.entries(config.profilesByCharacterId)
      .reduce<Record<string, CharacterRomanceProfile>>((profilesByCharacterId, [characterId, profile]) => ({
        ...profilesByCharacterId,
        [characterId]: { ...profile },
      }), {}),
    rules: config.rules.map(rule => ({
      ...rule,
      source: { ...rule.source },
      target: { ...rule.target },
    })),
  };
}
