import { useCallback, useEffect, useRef, useState } from 'react';

import type { AvatarState } from '~/widgets/avatarCanvas';
import { saveAvatarAppearanceDraft } from '~/services/save/avatarAppearanceSaveService';
import { AVATAR_DRAFT_AUTOSAVE_DELAY_MS } from '~/components/avatarEditor/avatarEditorConstants';
import type { DraftSaveStatus } from '~/components/avatarEditor/avatarEditorTypes';

export function useAvatarDraftAutosave() {
  const draftAutosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestAvatarStateRef = useRef<AvatarState | null>(null);
  const [draftSaveStatus, setDraftSaveStatus] = useState<DraftSaveStatus>('idle');

  const scheduleDraftAutosave = useCallback((state: AvatarState) => {
    latestAvatarStateRef.current = state;

    if (draftAutosaveTimeoutRef.current) {
      clearTimeout(draftAutosaveTimeoutRef.current);
    }

    setDraftSaveStatus('pending');
    draftAutosaveTimeoutRef.current = setTimeout(() => {
      draftAutosaveTimeoutRef.current = null;

      try {
        saveAvatarAppearanceDraft(state);
        setDraftSaveStatus('saved');
      } catch {
        setDraftSaveStatus('error');
      }
    }, AVATAR_DRAFT_AUTOSAVE_DELAY_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (!draftAutosaveTimeoutRef.current || !latestAvatarStateRef.current) {
        return;
      }

      clearTimeout(draftAutosaveTimeoutRef.current);
      draftAutosaveTimeoutRef.current = null;

      try {
        saveAvatarAppearanceDraft(latestAvatarStateRef.current);
      } catch (error) {
        console.error('Failed to flush avatar draft on unmount:', error);
      }
    };
  }, []);

  return {
    draftSaveStatus,
    scheduleDraftAutosave,
    setDraftSaveStatus,
  };
}
