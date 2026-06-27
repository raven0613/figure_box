import { useCallback, useEffect, useRef, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { OfflineRecapDebugWindow } from '~/components/debug/OfflineRecapDebugWindow';
import { SaveDebugPanel } from '~/components/debug/SaveDebugPanel';
import { Toast } from '~/components/common/Toast';
import { MAP_DIALOGUE_BOUNCE_DEMO, MAP_DIALOGUE_FADE_DEMO } from '~/constants/mapDialogueDemo';
import i18n from '~/i18n';
import { saveService } from '~/services/save/saveService';
import { settingsService } from '~/services/save/settingsService';
import type { EventDialoguePresentation } from '~/typing/eventDialoguePresentation';
import { useCharacterCreationFlow } from '~/hooks/app/useCharacterCreationFlow';
import { useDialogueSession } from '~/hooks/app/useDialogueSession';
import { useGameFlowSession } from '~/hooks/app/useGameFlowSession';
import { useInteractionCardSession } from '~/hooks/app/useInteractionCardSession';
import { useRomanceRuleSettings } from '~/hooks/app/useRomanceRuleSettings';
import { AvatarEditorPage } from './components/app/AvatarEditorPage';
import { CharacterCreationBakeStatus } from './components/app/CharacterCreationBakeStatus';
import { GameDebugControls } from './components/app/GameDebugControls';
import { GameLoadingStatus } from './components/app/GameLoadingStatus';
import { GameMenuButtons } from './components/app/GameMenuButtons';
import { CharacterManagementPanel } from './components/character/CharacterManagementPanel';
import { DialogueWindow } from './components/dialogue/DialogueWindow';
import { SettingsPanel } from './components/settings/SettingsPanel';
import styles from './App.module.scss';
import { TownMapContainer } from './components/townMap/TownMapContainer';
import { InteractionCardHand } from './widgets/interactionCards/InteractionCardHand';

const AVATAR_EDITOR_PATH = '/figure_box/avatar_editor';

function App() {
  const resumeInteractionCardTargetingPauseRef = useRef<() => void>(() => {});
  const [isSaveDebugOpen, setIsSaveDebugOpen] = useState(false);
  const [isOfflineRecapDebugOpen, setIsOfflineRecapDebugOpen] = useState(false);
  const [isCharacterPanelOpen, setIsCharacterPanelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [mapDialoguePresentation, setMapDialoguePresentation] = useState<EventDialoguePresentation | null>(null);
  const isAvatarEditorPage = getNormalizedPath() === AVATAR_EDITOR_PATH;
  const closeCharacterPanel = useCallback(() => {
    setIsCharacterPanelOpen(false);
  }, []);
  const resumeInteractionCardTargetingPause = useCallback(() => {
    resumeInteractionCardTargetingPauseRef.current();
  }, []);
  const {
    globalRomanceDefault,
    romanceProfilesByCharacterId,
    romanceRuleRevision,
    romanceRules,
    loadRomanceRuleSettings,
    updateGlobalRomanceDefault,
    updateRomanceProfiles,
    updateRomanceRules,
  } = useRomanceRuleSettings();
  const {
    isActivityObservationPaused,
    isGameActive,
    isGameLoading,
    isWorldManuallyPaused,
    loadingState,
    observedActivityId,
    saveInitializationError,
    simWorldState,
    cancelActivityObservation,
    closeActivityObservationDialogue,
    pauseSimWorld,
    resumeSimWorld,
    settleActivityObservation,
    startActivityObservation,
    toggleManualWorldPause,
  } = useGameFlowSession({
    isAvatarEditorPage,
    onRomanceRulesLoad: loadRomanceRuleSettings,
    onSaveDebugPanelOpenLoad: setIsSaveDebugOpen,
  });
  const {
    activeDialogueSession,
    expressionPresetIdByCharacterId: dialogueExpressionPresetIdByCharacterId,
    closeActiveDialogue,
    handleActivitySettled,
    handleDialogueLineChange,
    handleDialogueRequest,
    openDemoDialogue,
    openDialogueScript,
  } = useDialogueSession({
    resumeInteractionCardTargetingPause,
    onCancelActivityObservation: cancelActivityObservation,
    onStartActivityObservation: startActivityObservation,
    onActivityObservationDialogueClosed: closeActivityObservationDialogue,
    onActivityObservationSettled: settleActivityObservation,
  });
  const {
    apartmentReveal,
    characterCreationBakeState,
    characterRosterRevision,
    trackCharacterRequest,
    clearCharacterCreationBakeState,
    handleCharacterCreated,
    requestCharacterTracking,
  } = useCharacterCreationFlow({
    onCharacterPanelClose: closeCharacterPanel,
    openDialogueScript,
  });
  const {
    cards: interactionCards,
    dropRequest: pendingInteractionCardDrop,
    promptText: interactionCardPromptText,
    selectedCardId: selectedInteractionCardId,
    selection: interactionCardSelection,
    toast,
    dismissToast,
    dropCard: handleInteractionCardDrop,
    selectCard: handleInteractionCardSelect,
    selectInitiator: handleInteractionCardInitiatorSelect,
    selectTarget: handleInteractionCardTargetSelect,
    completeUse: handleInteractionCardUseComplete,
    failUse: handleInteractionCardUseFailed,
    resumeTargetingPause,
  } = useInteractionCardSession({
    characterRosterRevision,
    pauseSimWorld,
    resumeSimWorld,
  });
  useEffect(() => {
    resumeInteractionCardTargetingPauseRef.current = resumeTargetingPause;
  }, [resumeTargetingPause]);
  const setSaveDebugOpen = useCallback((isOpen: boolean) => {
    setIsSaveDebugOpen(isOpen);
    settingsService.setSaveDebugPanelOpen(isOpen);
    saveService.markDirty('settings');
  }, []);

  if (isAvatarEditorPage) {
    return (
      <I18nextProvider i18n={i18n}>
        <AvatarEditorPage />
      </I18nextProvider>
    );
  }

  return (
    <I18nextProvider i18n={i18n}>
      <div className={styles.app}>
        <GameDebugControls
          isGameActive={isGameActive}
          isActivityObservationPaused={isActivityObservationPaused}
          isWorldManuallyPaused={isWorldManuallyPaused}
          onToggleManualWorldPause={toggleManualWorldPause}
          onShowTestDialogue={openDemoDialogue}
          onShowMapFadeDemo={() => setMapDialoguePresentation({ ...MAP_DIALOGUE_FADE_DEMO })}
          onShowMapBounceDemo={() => setMapDialoguePresentation({ ...MAP_DIALOGUE_BOUNCE_DEMO })}
          onToggleSaveDebug={() => setSaveDebugOpen(!isSaveDebugOpen)}
          onToggleOfflineRecapDebug={() => setIsOfflineRecapDebugOpen(isOpen => !isOpen)}
        />
        <GameMenuButtons
          isCharacterMenuDisabled={!isGameActive || characterCreationBakeState !== null}
          onOpenCharacterPanel={() => setIsCharacterPanelOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
        <GameLoadingStatus
          isGameLoading={isGameLoading}
          loadingState={loadingState}
          saveInitializationError={saveInitializationError}
        />
        <CharacterCreationBakeStatus
          state={characterCreationBakeState}
          onDismiss={clearCharacterCreationBakeState}
        />
        {/* <FabricDrawingBoardContainer
          isOpen={true}
          initialData={[]}
          onDataChange={() => { }}
          onClose={() => { }}
        /> */}
        {/* <AvatarEditorContainer /> */}
        {isGameActive ? (
          <TownMapContainer
            key={characterRosterRevision}
            simWorldState={simWorldState}
            observedActivityId={observedActivityId}
            expressionPresetIdByCharacterId={dialogueExpressionPresetIdByCharacterId}
            mapDialoguePresentation={mapDialoguePresentation}
            romanceRuleRevision={romanceRuleRevision}
            characterRosterRevision={characterRosterRevision}
            apartmentReveal={apartmentReveal}
            trackCharacterRequest={trackCharacterRequest}
            interactionCardDropRequest={pendingInteractionCardDrop}
            interactionCardSelection={interactionCardSelection}
            onInteractionCardInitiatorSelect={handleInteractionCardInitiatorSelect}
            onInteractionCardTargetSelect={handleInteractionCardTargetSelect}
            onInteractionCardUseComplete={handleInteractionCardUseComplete}
            onInteractionCardUseFailed={handleInteractionCardUseFailed}
            onDialogueRequest={handleDialogueRequest}
            onActivitySettled={handleActivitySettled}
          />
        ) : null}
        {isGameActive ? (
          <InteractionCardHand
            cards={interactionCards}
            selectedCardId={selectedInteractionCardId}
            promptText={interactionCardPromptText}
            onCardSelect={handleInteractionCardSelect}
            onCardDrop={handleInteractionCardDrop}
          />
        ) : null}
        {isSaveDebugOpen ? (
          <SaveDebugPanel onClose={() => setSaveDebugOpen(false)} />
        ) : null}
        {isOfflineRecapDebugOpen ? (
          <OfflineRecapDebugWindow onClose={() => setIsOfflineRecapDebugOpen(false)} />
        ) : null}
        {isCharacterPanelOpen ? (
          <CharacterManagementPanel
            onClose={closeCharacterPanel}
            onCharacterCreated={handleCharacterCreated}
            onTrackCharacter={requestCharacterTracking}
          />
        ) : null}
        {isSettingsOpen ? (
          <SettingsPanel
            globalRomanceDefault={globalRomanceDefault}
            romanceProfilesByCharacterId={romanceProfilesByCharacterId}
            romanceRules={romanceRules}
            onClose={() => setIsSettingsOpen(false)}
            onGlobalRomanceDefaultChange={updateGlobalRomanceDefault}
            onRomanceProfilesChange={updateRomanceProfiles}
            onRomanceRulesChange={updateRomanceRules}
          />
        ) : null}
        {activeDialogueSession ? (
          <DialogueWindow
            script={activeDialogueSession.script}
            onLineChange={handleDialogueLineChange}
            onClose={closeActiveDialogue}
          />
        ) : null}
        {toast ? (
          <Toast
            key={toast.id}
            message={toast.message}
            tone={toast.tone}
            onDismiss={dismissToast}
          />
        ) : null}
      </div>
    </I18nextProvider>
  );
}

function getNormalizedPath(): string {
  return window.location.pathname.replace(/\/$/, '');
}

export default App;
