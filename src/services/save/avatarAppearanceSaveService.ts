import { normalizeAvatarState } from '~/widgets/avatarCanvas';
import type { AvatarState } from '~/widgets/avatarCanvas';

export const AVATAR_APPEARANCE_SCHEMA_VERSION = 3;

const DRAFT_STORAGE_KEY = 'figureBox.avatarEditor.currentDraft.v1';
const TEMPLATE_STORAGE_KEY = 'figureBox.avatarEditor.templates.v1';

export interface AvatarAppearanceDraftRecord {
  schemaVersion: number;
  avatarState: AvatarState;
  updatedAt: number;
}

export interface AvatarAppearanceTemplateRecord {
  id: string;
  name: string;
  schemaVersion: number;
  avatarState: AvatarState;
  createdAt: number;
  updatedAt: number;
}

export function loadAvatarAppearanceDraft(): AvatarAppearanceDraftRecord | null {
  const draftRecord = readJsonRecord<AvatarAppearanceDraftRecord>(DRAFT_STORAGE_KEY);

  return draftRecord ? normalizeDraftRecord(draftRecord) : null;
}

export function saveAvatarAppearanceDraft(avatarState: AvatarState): AvatarAppearanceDraftRecord {
  const draftRecord: AvatarAppearanceDraftRecord = {
    schemaVersion: AVATAR_APPEARANCE_SCHEMA_VERSION,
    avatarState: cloneAvatarState(normalizeAvatarState(avatarState)),
    updatedAt: Date.now(),
  };

  writeJsonRecord(DRAFT_STORAGE_KEY, draftRecord);
  return draftRecord;
}

export function listAvatarAppearanceTemplates(): AvatarAppearanceTemplateRecord[] {
  const templates = readJsonRecord<unknown>(TEMPLATE_STORAGE_KEY);

  if (!Array.isArray(templates)) {
    return [];
  }

  return templates
    .filter(isAvatarAppearanceTemplateRecord)
    .map(normalizeTemplateRecord)
    .sort((first, second) => second.updatedAt - first.updatedAt);
}

export function saveAvatarAppearanceTemplate(
  name: string,
  avatarState: AvatarState,
  templateId?: string,
): AvatarAppearanceTemplateRecord {
  const templates = listAvatarAppearanceTemplates();
  const currentTemplate = templateId
    ? templates.find(template => template.id === templateId)
    : null;
  const now = Date.now();
  const templateRecord: AvatarAppearanceTemplateRecord = {
    id: currentTemplate?.id ?? createTemplateId(),
    name: name.trim() || createFallbackTemplateName(templates.length),
    schemaVersion: AVATAR_APPEARANCE_SCHEMA_VERSION,
    avatarState: cloneAvatarState(normalizeAvatarState(avatarState)),
    createdAt: currentTemplate?.createdAt ?? now,
    updatedAt: now,
  };
  const nextTemplates = [
    templateRecord,
    ...templates.filter(template => template.id !== templateRecord.id),
  ];

  writeJsonRecord(TEMPLATE_STORAGE_KEY, nextTemplates);
  return templateRecord;
}

export function deleteAvatarAppearanceTemplate(templateId: string): void {
  const nextTemplates = listAvatarAppearanceTemplates()
    .filter(template => template.id !== templateId);

  writeJsonRecord(TEMPLATE_STORAGE_KEY, nextTemplates);
}

function cloneAvatarState(avatarState: AvatarState): AvatarState {
  return JSON.parse(JSON.stringify(avatarState)) as AvatarState;
}

function normalizeDraftRecord(record: AvatarAppearanceDraftRecord): AvatarAppearanceDraftRecord {
  return {
    ...record,
    schemaVersion: AVATAR_APPEARANCE_SCHEMA_VERSION,
    avatarState: normalizeAvatarState(record.avatarState),
  };
}

function normalizeTemplateRecord(record: AvatarAppearanceTemplateRecord): AvatarAppearanceTemplateRecord {
  return {
    ...record,
    schemaVersion: AVATAR_APPEARANCE_SCHEMA_VERSION,
    avatarState: normalizeAvatarState(record.avatarState),
  };
}

function createFallbackTemplateName(templateCount: number): string {
  return `模板 ${templateCount + 1}`;
}

function createTemplateId(): string {
  return `avatar-template-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readJsonRecord<T>(storageKey: string): T | null {
  try {
    const value = window.localStorage.getItem(storageKey);

    if (!value) {
      return null;
    }

    return JSON.parse(value) as T;
  } catch (error) {
    console.error(`Failed to read avatar appearance storage: ${storageKey}`, error);
    return null;
  }
}

function writeJsonRecord<T>(storageKey: string, value: T): void {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to write avatar appearance storage: ${storageKey}`, error);
    throw error;
  }
}

function isAvatarAppearanceTemplateRecord(value: unknown): value is AvatarAppearanceTemplateRecord {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'updatedAt' in value &&
    'createdAt' in value &&
    'avatarState' in value &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.updatedAt === 'number' &&
    typeof value.createdAt === 'number' &&
    typeof value.avatarState === 'object' &&
    value.avatarState !== null
  );
}
