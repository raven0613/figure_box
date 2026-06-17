import { useState } from 'react';

import {
  type AvatarState,
  type AvatarCanvas,
  createDefaultAvatarState,
} from '~/widgets/avatarCanvas';
import {
  deleteAvatarAppearanceTemplate,
  listAvatarAppearanceTemplates,
  saveAvatarAppearanceTemplate,
} from '~/services/save/avatarAppearanceSaveService';
import type { AvatarAppearanceTemplateRecord } from '~/services/save/avatarAppearanceSaveService';
import type { TemplateAction } from '~/components/avatarEditor/avatarEditorTypes';

interface UseAvatarTemplatesOptions {
  avatarCanvasRef: { current: AvatarCanvas | null };
  avatarState: AvatarState;
  onError: () => void;
  onLoadTemplate: () => void;
  onResetAvatar: () => void;
}

export function useAvatarTemplates({
  avatarCanvasRef,
  avatarState,
  onError,
  onLoadTemplate,
  onResetAvatar,
}: UseAvatarTemplatesOptions) {
  const [avatarTemplates, setAvatarTemplates] = useState<AvatarAppearanceTemplateRecord[]>(() => (
    listAvatarAppearanceTemplates()
  ));
  const [templateName, setTemplateName] = useState('');
  const [pendingTemplateAction, setPendingTemplateAction] = useState<TemplateAction | null>(null);

  const refreshAvatarTemplates = () => {
    setAvatarTemplates(listAvatarAppearanceTemplates());
  };

  const saveCurrentTemplate = (templateId?: string, fallbackName?: string) => {
    const currentState = avatarCanvasRef.current?.getState() ?? avatarState;

    try {
      const templateRecord = saveAvatarAppearanceTemplate(fallbackName ?? templateName, currentState, templateId);

      setTemplateName(templateRecord.name);
      refreshAvatarTemplates();
    } catch (error) {
      console.error('Failed to save avatar template:', error);
      onError();
    }
  };

  const loadTemplate = (template: AvatarAppearanceTemplateRecord) => {
    avatarCanvasRef.current?.setState(template.avatarState);
    setTemplateName(template.name);
    onLoadTemplate();
  };

  const overwriteTemplate = (template: AvatarAppearanceTemplateRecord) => {
    saveCurrentTemplate(template.id, template.name);
  };

  const deleteTemplate = (templateId: string) => {
    deleteAvatarAppearanceTemplate(templateId);
    refreshAvatarTemplates();
  };

  const resetAvatarToDefault = () => {
    avatarCanvasRef.current?.setState(createDefaultAvatarState());
    setTemplateName('');
    onResetAvatar();
  };

  const confirmTemplateAction = () => {
    if (!pendingTemplateAction) {
      return;
    }

    if (pendingTemplateAction.type === 'load') {
      loadTemplate(pendingTemplateAction.template);
    }

    if (pendingTemplateAction.type === 'overwrite') {
      overwriteTemplate(pendingTemplateAction.template);
    }

    if (pendingTemplateAction.type === 'delete') {
      deleteTemplate(pendingTemplateAction.template.id);
    }

    if (pendingTemplateAction.type === 'reset') {
      resetAvatarToDefault();
    }

    setPendingTemplateAction(null);
  };

  return {
    avatarTemplates,
    confirmTemplateAction,
    pendingTemplateAction,
    saveCurrentTemplate,
    setPendingTemplateAction,
    setTemplateName,
    templateName,
  };
}
