import { useCallback, useState } from 'react';
import { createCharacterCreationSuccessDialogueScript } from '~/constants/characterCreationDialogue';
import {
  bakeCreatedCharacterSprites,
  type CharacterCreationBakeProgress,
} from '~/services/characterCreationBakeService';
import {
  deletePlayerCharacterCreation,
  markPlayerCharacterCreationReady,
  updatePlayerCharacterWayOfSaying,
  type CreatePlayerCharacterResult,
} from '~/services/characterCreationService';
import { getDialogueAvatarState } from '~/services/dialogueAvatarStateService';
import type { DialogueViewScript } from '~/typing/dialogueView';

export interface CharacterCreationBakeState {
  characterName: string;
  label: string;
  completed: number;
  total: number;
  error: string | null;
}

interface UseCharacterCreationFlowOptions {
  onCharacterPanelClose: () => void;
  openDialogueScript: (script: DialogueViewScript) => void;
}

export function useCharacterCreationFlow({
  onCharacterPanelClose,
  openDialogueScript,
}: UseCharacterCreationFlowOptions) {
  const [characterRosterRevision, setCharacterRosterRevision] = useState(0);
  const [apartmentReveal, setApartmentReveal] = useState<{
    characterId: string;
    revision: number;
  } | null>(null);
  const [trackCharacterRequest, setTrackCharacterRequest] = useState<{
    characterId: string;
    revision: number;
  } | null>(null);
  const [characterCreationBakeState, setCharacterCreationBakeState] = useState<CharacterCreationBakeState | null>(null);
  const clearCharacterCreationBakeState = useCallback(() => {
    setCharacterCreationBakeState(null);
  }, []);
  const completeCreatedCharacter = useCallback(async (creationResult: CreatePlayerCharacterResult) => {
    const characterName = creationResult.profileRecord.name;

    setCharacterCreationBakeState({
      characterName,
      label: 'Preparing sprites',
      completed: 0,
      total: 0,
      error: null,
    });

    try {
      await bakeCreatedCharacterSprites({
        creationResult,
        onProgress: (progress: CharacterCreationBakeProgress) => {
          setCharacterCreationBakeState({
            characterName,
            label: progress.label,
            completed: progress.completed,
            total: progress.total,
            error: null,
          });
        },
      });
      const readyProfileRecord = await markPlayerCharacterCreationReady(creationResult.characterId);
      const profileColor = readyProfileRecord.profile.color;
      const characterColor = typeof profileColor === 'string' && profileColor.length > 0
        ? profileColor
        : '#f0cc5f';

      setCharacterCreationBakeState(null);
      setCharacterRosterRevision(revision => revision + 1);
      setApartmentReveal({
        characterId: creationResult.characterId,
        revision: Date.now(),
      });
      openDialogueScript(createCharacterCreationSuccessDialogueScript({
        characterId: creationResult.characterId,
        name: readyProfileRecord.name,
        color: characterColor,
        label: createCharacterDialogueLabel(readyProfileRecord.name),
        avatarState: getDialogueAvatarState(creationResult.characterId),
        onWayOfSayingInput: ({ field, value }) => {
          void updatePlayerCharacterWayOfSaying(creationResult.characterId, {
            [field]: value,
          }).catch(error => {
            console.error('Failed to update character way of saying.', error);
          });
        },
      }));
    } catch (error) {
      console.error('Character creation bake failed.', error);
      await deletePlayerCharacterCreation(creationResult.characterId).catch(cleanupError => {
        console.error('Failed to clean up incomplete character creation.', cleanupError);
      });
      setCharacterCreationBakeState({
        characterName,
        label: 'Character creation failed',
        completed: 0,
        total: 0,
        error: error instanceof Error ? error.message : '創建角色失敗，請再試一次。',
      });
    }
  }, [openDialogueScript]);
  const handleCharacterCreated = useCallback((creationResult: CreatePlayerCharacterResult) => {
    onCharacterPanelClose();
    void completeCreatedCharacter(creationResult);
  }, [completeCreatedCharacter, onCharacterPanelClose]);
  const requestCharacterTracking = useCallback((characterId: string) => {
    setTrackCharacterRequest({
      characterId,
      revision: Date.now(),
    });
  }, []);

  return {
    apartmentReveal,
    characterCreationBakeState,
    characterRosterRevision,
    trackCharacterRequest,
    clearCharacterCreationBakeState,
    handleCharacterCreated,
    requestCharacterTracking,
  };
}

function createCharacterDialogueLabel(name: string): string {
  return (Array.from(name.trim())[0] ?? '?').toUpperCase();
}
