import { createDefaultSettingsRecord } from './saveDefaults';
import {
  cloneRomanceRuleConfig,
  type RomanceRuleConfig,
} from '~/services/romanceRules/romanceRuleService';
import type { SettingsRecord } from './saveTypes';

class SettingsService {
  private settings: SettingsRecord = createDefaultSettingsRecord();

  load(settings: SettingsRecord): void {
    this.settings = cloneSettingsRecord(settings);
  }

  getSnapshot(): SettingsRecord {
    return cloneSettingsRecord(this.settings);
  }

  setSaveDebugPanelOpen(isSaveDebugPanelOpen: boolean): SettingsRecord {
    this.settings = {
      ...this.settings,
      isSaveDebugPanelOpen,
      updatedAt: Date.now(),
    };

    return this.getSnapshot();
  }

  setRomanceRuleConfig(romanceRules: RomanceRuleConfig): SettingsRecord {
    this.settings = {
      ...this.settings,
      romanceRules: cloneRomanceRuleConfig(romanceRules),
      updatedAt: Date.now(),
    };

    return this.getSnapshot();
  }
}

export const settingsService = new SettingsService();

function cloneSettingsRecord(settings: SettingsRecord): SettingsRecord {
  return {
    ...settings,
    romanceRules: cloneRomanceRuleConfig(settings.romanceRules),
  };
}
