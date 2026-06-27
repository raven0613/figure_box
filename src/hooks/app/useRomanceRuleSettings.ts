import { useCallback, useEffect, useState } from 'react';
import { CHARACTER_SEEDS } from '~/constants/character';
import {
  createDefaultRomanceProfiles,
  setRomanceRuleConfig,
  type CharacterRomanceProfile,
  type GlobalRomanceDefault,
  type RomanceRule,
  type RomanceRuleConfig,
} from '~/services/romanceRules/romanceRuleService';
import { saveService } from '~/services/save/saveService';
import { settingsService } from '~/services/save/settingsService';

export function useRomanceRuleSettings() {
  const [globalRomanceDefault, setGlobalRomanceDefault] = useState<GlobalRomanceDefault>('allow');
  const [romanceRules, setRomanceRules] = useState<RomanceRule[]>([]);
  const [romanceProfilesByCharacterId, setRomanceProfilesByCharacterId] = useState<Record<string, CharacterRomanceProfile>>(
    () => createDefaultRomanceProfiles(CHARACTER_SEEDS.map(character => character.id)),
  );
  const [romanceRuleRevision, setRomanceRuleRevision] = useState(0);
  const commitRomanceRuleConfig = useCallback((config: RomanceRuleConfig) => {
    setRomanceRuleConfig(config);
    settingsService.setRomanceRuleConfig(config);
    saveService.markDirty('settings');
    setRomanceRuleRevision(revision => revision + 1);
  }, []);
  const loadRomanceRuleSettings = useCallback((config: RomanceRuleConfig) => {
    setGlobalRomanceDefault(config.globalDefault);
    setRomanceProfilesByCharacterId(config.profilesByCharacterId);
    setRomanceRules([...config.rules]);
    setRomanceRuleConfig(config);
  }, []);
  const updateGlobalRomanceDefault = useCallback((globalDefault: GlobalRomanceDefault) => {
    const nextConfig = {
      globalDefault,
      profilesByCharacterId: romanceProfilesByCharacterId,
      rules: romanceRules,
    };

    setGlobalRomanceDefault(globalDefault);
    commitRomanceRuleConfig(nextConfig);
  }, [commitRomanceRuleConfig, romanceProfilesByCharacterId, romanceRules]);
  const updateRomanceRules = useCallback((rules: RomanceRule[]) => {
    const nextConfig = {
      globalDefault: globalRomanceDefault,
      profilesByCharacterId: romanceProfilesByCharacterId,
      rules,
    };

    setRomanceRules(rules);
    commitRomanceRuleConfig(nextConfig);
  }, [commitRomanceRuleConfig, globalRomanceDefault, romanceProfilesByCharacterId]);
  const updateRomanceProfiles = useCallback((profilesByCharacterId: Record<string, CharacterRomanceProfile>) => {
    const nextConfig = {
      globalDefault: globalRomanceDefault,
      profilesByCharacterId,
      rules: romanceRules,
    };

    setRomanceProfilesByCharacterId(profilesByCharacterId);
    commitRomanceRuleConfig(nextConfig);
  }, [commitRomanceRuleConfig, globalRomanceDefault, romanceRules]);

  useEffect(() => {
    setRomanceRuleConfig({
      globalDefault: globalRomanceDefault,
      profilesByCharacterId: romanceProfilesByCharacterId,
      rules: romanceRules,
    });
  }, [globalRomanceDefault, romanceProfilesByCharacterId, romanceRules]);

  return {
    globalRomanceDefault,
    romanceProfilesByCharacterId,
    romanceRuleRevision,
    romanceRules,
    loadRomanceRuleSettings,
    updateGlobalRomanceDefault,
    updateRomanceProfiles,
    updateRomanceRules,
  };
}
