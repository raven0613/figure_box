import { useEffect, useRef } from 'react';

import type { ExpressionPresetId } from '~/constants/character';
import { TOWN_APARTMENT_SPACE_ID } from '~/constants/townMap';
import type {
  CharacterSnapshot,
  TownCharacterController,
} from '~/services/townCharacterController';
import type { CharacterSeed } from '~/services/townCharacterTypes';
import type { GameSimWorldState } from '~/stateMachines/gameFlow/states';
import type { EventDialoguePresentation } from '~/typing/eventDialoguePresentation';
import type { FabricTownMapWidget } from '~/widgets/fabricTownMapWidget';

interface TownMapApartmentReveal {
  characterId: string;
  revision: number;
}

interface TownMapTrackCharacterRequest {
  characterId: string;
  revision: number;
}

interface UseTownMapControllerSyncOptions {
  apartmentReveal: TownMapApartmentReveal | null;
  characterControllerRef: { current: TownCharacterController | null };
  characterSnapshots: Record<string, CharacterSnapshot>;
  expressionPresetIdByCharacterId: Partial<Record<string, ExpressionPresetId>>;
  mapDialoguePresentation: EventDialoguePresentation | null;
  observedActivityId: string | null;
  playableCharacters: readonly CharacterSeed[];
  romanceRuleRevision: number;
  simWorldState: GameSimWorldState;
  trackCharacterRequest: TownMapTrackCharacterRequest | null;
  widgetRef: { current: FabricTownMapWidget | null };
  onApartmentPanelOpen: () => void;
  onCharacterSelect: (characterId: string) => void;
}

export function useTownMapControllerSync({
  apartmentReveal,
  characterControllerRef,
  characterSnapshots,
  expressionPresetIdByCharacterId,
  mapDialoguePresentation,
  observedActivityId,
  playableCharacters,
  romanceRuleRevision,
  simWorldState,
  trackCharacterRequest,
  widgetRef,
  onApartmentPanelOpen,
  onCharacterSelect,
}: UseTownMapControllerSyncOptions) {
  const characterSnapshotsRef = useRef<Record<string, CharacterSnapshot>>({});
  const lastAppliedRomanceRuleRevisionRef = useRef(romanceRuleRevision);

  useEffect(() => {
    characterSnapshotsRef.current = characterSnapshots;
  }, [characterSnapshots]);

  useEffect(() => {
    if (lastAppliedRomanceRuleRevisionRef.current === romanceRuleRevision) {
      return;
    }

    lastAppliedRomanceRuleRevisionRef.current = romanceRuleRevision;
    characterControllerRef.current?.normalizeRomanceFeelings();
  }, [characterControllerRef, romanceRuleRevision]);

  useEffect(() => {
    if (!apartmentReveal) {
      return;
    }

    onApartmentPanelOpen();
  }, [apartmentReveal, onApartmentPanelOpen]);

  useEffect(() => {
    if (!trackCharacterRequest) {
      return;
    }

    const requestedCharacterId = trackCharacterRequest.characterId;
    const didSelectCharacter = widgetRef.current?.selectCharacterForTracking(
      requestedCharacterId,
    ) ?? false;

    if (didSelectCharacter) {
      onCharacterSelect(requestedCharacterId);
      return;
    }

    const isPlayableCharacter = playableCharacters.some(character => character.id === requestedCharacterId);
    const requestedSnapshot = characterSnapshotsRef.current[requestedCharacterId];

    if (!isPlayableCharacter) {
      console.warn(`Character ${requestedCharacterId} is not available in playable characters.`);
      return;
    }

    if (
      requestedSnapshot?.context.presence.kind === 'contained' &&
      requestedSnapshot.context.presence.spaceId === TOWN_APARTMENT_SPACE_ID
    ) {
      onApartmentPanelOpen();
    }
  }, [
    onApartmentPanelOpen,
    onCharacterSelect,
    playableCharacters,
    trackCharacterRequest,
    widgetRef,
  ]);

  useEffect(() => {
    const characterController = characterControllerRef.current;

    if (!characterController) {
      return;
    }

    characterController.setSimWorldState(simWorldState, observedActivityId);
  }, [
    characterControllerRef,
    observedActivityId,
    simWorldState,
  ]);

  useEffect(() => {
    const characterController = characterControllerRef.current;

    if (!characterController) {
      return;
    }

    Object.entries(expressionPresetIdByCharacterId).forEach(([characterId, expressionPresetId]) => {
      if (expressionPresetId) {
        characterController.setCharacterExpressionPreset(characterId, expressionPresetId);
        characterController.showExpressionBubbleForExpressionPreset(characterId, expressionPresetId);
      }
    });
  }, [characterControllerRef, expressionPresetIdByCharacterId]);

  useEffect(() => {
    const characterController = characterControllerRef.current;

    if (!characterController || !mapDialoguePresentation) {
      return undefined;
    }

    return characterController.showMapDialoguePresentation(mapDialoguePresentation);
  }, [characterControllerRef, mapDialoguePresentation]);
}
