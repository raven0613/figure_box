import { createDefaultSettingsRecord } from './saveDefaults';
import type { SettingsRecord } from './saveTypes';

class SettingsService {
  private settings: SettingsRecord = createDefaultSettingsRecord();

  load(settings: SettingsRecord): void {
    this.settings = { ...settings };
  }

  getSnapshot(): SettingsRecord {
    return { ...this.settings };
  }

  setSaveDebugPanelOpen(isSaveDebugPanelOpen: boolean): SettingsRecord {
    this.settings = {
      ...this.settings,
      isSaveDebugPanelOpen,
      updatedAt: Date.now(),
    };

    return this.getSnapshot();
  }
}

export const settingsService = new SettingsService();
