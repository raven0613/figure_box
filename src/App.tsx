import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { createActor, type ActorRefFrom, type SnapshotFrom } from 'xstate';
import { OfflineRecapDebugWindow } from '~/components/debug/OfflineRecapDebugWindow';
import { SaveDebugPanel } from '~/components/debug/SaveDebugPanel';
import { CHARACTER_SEEDS } from '~/constants/character';
import { createCharacterCreationSuccessDialogueScript } from '~/constants/characterCreationDialogue';
import { DIALOGUE_DEMO_SCRIPT } from '~/constants/dialogueDemo';
import { DIALOGUE_SCRIPT_DEFINITIONS_BY_ID } from '~/constants/dialogueScripts';
import { DEFAULT_EXPRESSION_PRESET_ID } from '~/constants/expressionCatalog';
import { MAP_DIALOGUE_BOUNCE_DEMO, MAP_DIALOGUE_FADE_DEMO } from '~/constants/mapDialogueDemo';
import i18n from '~/i18n';
import {
  bakeCreatedCharacterSprites,
  type CharacterCreationBakeProgress,
} from '~/services/characterCreationBakeService';
import {
  deletePlayerCharacterCreation,
  markPlayerCharacterCreationReady,
  type CreatePlayerCharacterResult,
} from '~/services/characterCreationService';
import type { CharacterPerformanceDialogueRequest } from '~/services/characterEvents/characterPerformanceRunner';
import { getDialogueAvatarState } from '~/services/dialogueAvatarStateService';
import { createDialogueViewScript } from '~/services/dialogueScriptResolver';
import { getPlayableCharacters } from '~/services/playableCharacterService';
import {
  createDefaultRomanceProfiles,
  setRomanceRuleConfig,
  type RomanceRuleConfig,
  type CharacterRomanceProfile,
  type GlobalRomanceDefault,
  type RomanceRule,
} from '~/services/romanceRules/romanceRuleService';
import { saveService } from '~/services/save/saveService';
import { settingsService } from '~/services/save/settingsService';
import { offlineSessionService } from '~/services/offlineSimulation/offlineSessionService';
import {
  getExpressionBubbleSpritePreloadTotal,
  preloadExpressionBubbleSpriteSheets,
} from '~/services/expressionBubbleSpritePreloadService';
import {
  interactionCardService,
  type InteractionCardViewModel,
} from '~/services/interactionCards/interactionCardService';
import { preloadTownRequiredSpriteSheets } from '~/services/townSpritePreloadService';
import { startTownSpriteBackgroundBake } from '~/services/townSpriteBackgroundBakeService';
import { gameFlowMachine } from '~/stateMachines/gameFlow';
import { GameSimWorldState, GameState } from '~/stateMachines/gameFlow/states';
import type { EventDialoguePresentation } from '~/typing/eventDialoguePresentation';
import type { DialogueViewScript } from '~/typing/dialogueView';
import type { ExpressionPresetId } from '~/typing/expression';
import { AvatarEditorContainer } from './components/avatarEditor/AvatarEditorContainer';
import { CharacterManagementPanel } from './components/character/CharacterManagementPanel';
import { DialogueWindow } from './components/dialogue/DialogueWindow';
import { SettingsPanel } from './components/settings/SettingsPanel';
import styles from './App.module.scss';
import { TownMapContainer } from './components/townMap/TownMapContainer';
import {
  InteractionCardHand,
  type InteractionCardDropInput,
} from './widgets/interactionCards/InteractionCardHand';

const AVATAR_EDITOR_PATH = '/figure_box/avatar_editor';

interface AppLoadingState {
  label: string;
  completed: number;
  total: number;
}

interface CharacterCreationBakeState extends AppLoadingState {
  characterName: string;
  error: string | null;
}

interface ActiveDialogueSession {
  script: DialogueViewScript;
  activityId?: string;
  onClose?: () => void;
}

interface InteractionCardDraft {
  card: InteractionCardViewModel;
  initiatorId: string | null;
  targetId: string | null;
}

interface PendingInteractionCardDrop {
  id: number;
  cardId: string;
  pointer: {
    x: number;
    y: number;
  };
}

function App() {
  const gameFlowActorRef = useRef<ActorRefFrom<typeof gameFlowMachine> | null>(null);
  const [gameFlowSnapshot, setGameFlowSnapshot] = useState<SnapshotFrom<typeof gameFlowMachine> | null>(null);
  const [loadingState, setLoadingState] = useState<AppLoadingState>({
    label: 'Loading save',
    completed: 0,
    total: 0,
  });
  const [saveInitializationError, setSaveInitializationError] = useState<string | null>(null);
  const [isSaveDebugOpen, setIsSaveDebugOpen] = useState(false);
  const [isOfflineRecapDebugOpen, setIsOfflineRecapDebugOpen] = useState(false);
  const [isCharacterPanelOpen, setIsCharacterPanelOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
  const [globalRomanceDefault, setGlobalRomanceDefault] = useState<GlobalRomanceDefault>('allow');
  const [romanceRules, setRomanceRules] = useState<RomanceRule[]>([]);
  const [romanceProfilesByCharacterId, setRomanceProfilesByCharacterId] = useState<Record<string, CharacterRomanceProfile>>(
    () => createDefaultRomanceProfiles(CHARACTER_SEEDS.map(character => character.id)),
  );
  const [romanceRuleRevision, setRomanceRuleRevision] = useState(0);
  const [activeDialogueSession, setActiveDialogueSession] = useState<ActiveDialogueSession | null>(null);
  const [
    dialogueExpressionPresetIdByCharacterId,
    setDialogueExpressionPresetIdByCharacterId,
  ] = useState<Partial<Record<string, ExpressionPresetId>>>({});
  const [mapDialoguePresentation, setMapDialoguePresentation] = useState<EventDialoguePresentation | null>(null);
  const interactionCards = useMemo(() => interactionCardService.getAvailableCards(), []);
  const [interactionCardDraft, setInteractionCardDraft] = useState<InteractionCardDraft | null>(null);
  const [pendingInteractionCardDrop, setPendingInteractionCardDrop] = useState<PendingInteractionCardDrop | null>(null);
  const isInteractionCardTargetingPausedRef = useRef(false);
  const characterNamesById = useMemo(() => (
    getPlayableCharacters().reduce<Record<string, string>>(
      (namesById, character) => ({
        ...namesById,
        [character.id]: character.name,
      }),
      {},
    )
  ), [characterRosterRevision]);
  const interactionCardPromptText = useMemo(() => {
    if (!interactionCardDraft) {
      return null;
    }

    return formatInteractionCardPrompt(
      interactionCardDraft.card.promptTemplate,
      interactionCardDraft.initiatorId
        ? characterNamesById[interactionCardDraft.initiatorId] ?? interactionCardDraft.initiatorId
        : '__',
      interactionCardDraft.targetId
        ? characterNamesById[interactionCardDraft.targetId] ?? interactionCardDraft.targetId
        : '__',
    );
  }, [characterNamesById, interactionCardDraft]);
  const resumeInteractionCardTargetingPause = useCallback(() => {
    if (!isInteractionCardTargetingPausedRef.current) {
      return;
    }

    isInteractionCardTargetingPausedRef.current = false;
    gameFlowActorRef.current?.send({ type: 'RESUME_SIM_WORLD' });
  }, []);
  const clearInteractionCardTargetingPause = useCallback(() => {
    isInteractionCardTargetingPausedRef.current = false;
  }, []);
  const handleInteractionCardSelect = useCallback((card: InteractionCardViewModel) => {
    resumeInteractionCardTargetingPause();
    setInteractionCardDraft({
      card,
      initiatorId: null,
      targetId: null,
    });
    setPendingInteractionCardDrop(null);
  }, [resumeInteractionCardTargetingPause]);
  const handleInteractionCardDrop = useCallback((input: InteractionCardDropInput) => {
    resumeInteractionCardTargetingPause();
    setInteractionCardDraft({
      card: input.card,
      initiatorId: null,
      targetId: null,
    });
    setPendingInteractionCardDrop({
      id: Date.now(),
      cardId: input.card.id,
      pointer: input.pointer,
    });
  }, [resumeInteractionCardTargetingPause]);
  const handleInteractionCardInitiatorSelect = useCallback((cardId: string, initiatorId: string) => {
    gameFlowActorRef.current?.send({ type: 'PAUSE_SIM_WORLD' });
    isInteractionCardTargetingPausedRef.current = true;
    setInteractionCardDraft(currentDraft => {
      if (!currentDraft || currentDraft.card.id !== cardId) {
        return currentDraft;
      }

      return {
        ...currentDraft,
        initiatorId,
        targetId: null,
      };
    });
  }, []);
  const handleInteractionCardTargetSelect = useCallback((cardId: string, targetId: string) => {
    setInteractionCardDraft(currentDraft => {
      if (!currentDraft || currentDraft.card.id !== cardId || !currentDraft.initiatorId) {
        return currentDraft;
      }

      return {
        ...currentDraft,
        targetId,
      };
    });
  }, []);
  const handleInteractionCardUseComplete = useCallback((cardId: string) => {
    setInteractionCardDraft(currentDraft => (
      currentDraft?.card.id === cardId ? null : currentDraft
    ));
    setPendingInteractionCardDrop(currentDrop => (
      currentDrop?.cardId === cardId ? null : currentDrop
    ));
    clearInteractionCardTargetingPause();
  }, [clearInteractionCardTargetingPause]);
  const handleInteractionCardUseFailed = useCallback((cardId: string) => {
    setInteractionCardDraft(currentDraft => (
      currentDraft?.card.id === cardId ? null : currentDraft
    ));
    setPendingInteractionCardDrop(currentDrop => (
      currentDrop?.cardId === cardId ? null : currentDrop
    ));
    resumeInteractionCardTargetingPause();
  }, [resumeInteractionCardTargetingPause]);
  const cancelActivityObservation = useCallback((
    activityId: string,
    onCancel?: () => void,
  ) => {
    onCancel?.();
    gameFlowActorRef.current?.send({
      type: 'CANCEL_ACTIVITY_OBSERVATION',
      activityId,
    });
  }, []);
  const handleDialogueLineChange = useCallback((line: { speakerId: string; expressionPresetId: ExpressionPresetId }) => {
    setDialogueExpressionPresetIdByCharacterId({
      [line.speakerId]: line.expressionPresetId,
    });
  }, []);
  const handleDialogueRequest = useCallback((request: CharacterPerformanceDialogueRequest) => {
    const script = request.scriptId === DIALOGUE_DEMO_SCRIPT.id
      ? DIALOGUE_DEMO_SCRIPT
      : createActivityDialogueScript(request);

    if (!script) {
      const handleCancel = request.onCancel ?? request.onClose;

      if (request.activityId) {
        cancelActivityObservation(request.activityId, handleCancel);
      } else {
        handleCancel?.();
      }
      resumeInteractionCardTargetingPause();
      return;
    }

    if (request.activityId) {
      gameFlowActorRef.current?.send({
        type: 'START_ACTIVITY_OBSERVATION',
        activityId: request.activityId,
      });
    }

    setActiveDialogueSession({
      script,
      activityId: request.activityId,
      onClose: request.onClose,
    });
  }, [cancelActivityObservation, resumeInteractionCardTargetingPause]);
  const resetDialogueParticipantExpressionPresets = useCallback((script: DialogueViewScript) => {
    setDialogueExpressionPresetIdByCharacterId(current => {
      const next = { ...current };

      script.participants.forEach(participant => {
        next[participant.id] = DEFAULT_EXPRESSION_PRESET_ID;
      });

      return next;
    });
  }, []);
  const closeActiveDialogue = useCallback(() => {
    if (!activeDialogueSession) {
      return;
    }

    resetDialogueParticipantExpressionPresets(activeDialogueSession.script);
    setActiveDialogueSession(null);
    activeDialogueSession.onClose?.();

    if (activeDialogueSession.activityId) {
      gameFlowActorRef.current?.send({
        type: 'ACTIVITY_OBSERVATION_DIALOGUE_CLOSED',
        activityId: activeDialogueSession.activityId,
      });
    }
  }, [activeDialogueSession, resetDialogueParticipantExpressionPresets]);
  const handleActivitySettled = useCallback((activityId: string) => {
    gameFlowActorRef.current?.send({
      type: 'ACTIVITY_OBSERVATION_SETTLED',
      activityId,
    });
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
      setActiveDialogueSession({
        script: createCharacterCreationSuccessDialogueScript({
          characterId: creationResult.characterId,
          name: readyProfileRecord.name,
          color: characterColor,
          label: createCharacterDialogueLabel(readyProfileRecord.name),
          avatarState: getDialogueAvatarState(creationResult.characterId),
        }),
      });
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
  }, []);
  const handleCharacterCreated = useCallback((creationResult: CreatePlayerCharacterResult) => {
    setIsCharacterPanelOpen(false);
    void completeCreatedCharacter(creationResult);
  }, [completeCreatedCharacter]);
  const requestCharacterTracking = useCallback((characterId: string) => {
    setTrackCharacterRequest({
      characterId,
      revision: Date.now(),
    });
  }, []);
  const setSaveDebugOpen = useCallback((isOpen: boolean) => {
    setIsSaveDebugOpen(isOpen);
    settingsService.setSaveDebugPanelOpen(isOpen);
    saveService.markDirty('settings');
  }, []);
  const commitRomanceRuleConfig = useCallback((config: RomanceRuleConfig) => {
    setRomanceRuleConfig(config);
    settingsService.setRomanceRuleConfig(config);
    saveService.markDirty('settings');
    setRomanceRuleRevision(revision => revision + 1);
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
  const isAvatarEditorPage = getNormalizedPath() === AVATAR_EDITOR_PATH;

  useEffect(() => {
    setRomanceRuleConfig({
      globalDefault: globalRomanceDefault,
      profilesByCharacterId: romanceProfilesByCharacterId,
      rules: romanceRules,
    });
  }, [globalRomanceDefault, romanceProfilesByCharacterId, romanceRules]);

  useEffect(() => {
    if (isAvatarEditorPage) {
      return;
    }

    const gameFlowActor = createActor(gameFlowMachine);
    const subscription = gameFlowActor.subscribe(snapshot => {
      setGameFlowSnapshot(snapshot);
    });

    gameFlowActor.start();
    gameFlowActorRef.current = gameFlowActor;
    setGameFlowSnapshot(gameFlowActor.getSnapshot());

    return () => {
      subscription.unsubscribe();
      gameFlowActor.stop();
      gameFlowActorRef.current = null;
    };
  }, [isAvatarEditorPage]);

  useEffect(() => {
    if (isAvatarEditorPage || !gameFlowActorRef.current) {
      return;
    }

    let isMounted = true;
    const gameFlowActor = gameFlowActorRef.current;

    saveService.initializeGame()
      .then(() => {
        if (!isMounted) {
          return null;
        }

        const settings = settingsService.getSnapshot();

        setIsSaveDebugOpen(settings.isSaveDebugPanelOpen);
        setGlobalRomanceDefault(settings.romanceRules.globalDefault);
        setRomanceProfilesByCharacterId(settings.romanceRules.profilesByCharacterId);
        setRomanceRules([...settings.romanceRules.rules]);
        setRomanceRuleConfig(settings.romanceRules);
        const expressionBubblePreloadTotal = getExpressionBubbleSpritePreloadTotal();

        setLoadingState({
          label: 'Loading sprites',
          completed: 0,
          total: expressionBubblePreloadTotal,
        });

        return preloadTownRequiredSpriteSheets({
          onProgress: progress => {
            if (!isMounted) {
              return;
            }

            setLoadingState({
              label: progress.currentLabel,
              completed: progress.completed,
              total: progress.total + expressionBubblePreloadTotal,
            });
          },
        }).then(async townPreloadResult => {
          if (!isMounted) {
            return townPreloadResult;
          }

          const expressionBubblePreloadResult = await preloadExpressionBubbleSpriteSheets({
            onProgress: progress => {
              if (!isMounted) {
                return;
              }

              setLoadingState({
                label: progress.currentLabel,
                completed: townPreloadResult.completed + progress.completed,
                total: townPreloadResult.total + expressionBubblePreloadTotal,
              });
            },
          });

          return {
            completed: townPreloadResult.completed + expressionBubblePreloadResult.completed,
            total: townPreloadResult.total + expressionBubblePreloadResult.total,
            failed: townPreloadResult.failed + expressionBubblePreloadResult.failed,
          };
        });
      })
      .then(preloadResult => {
        if (!isMounted || !preloadResult) {
          return;
        }

        if (preloadResult.failed > 0) {
          console.warn(`Town sprite preload completed with ${preloadResult.failed} failed jobs.`);
        }

        setLoadingState({
          label: preloadResult.failed > 0 ? 'Sprites loaded with warnings' : 'Sprites loaded',
          completed: preloadResult.completed,
          total: preloadResult.total,
        });
        gameFlowActor.send({ type: 'LOADING_COMPLETE' });
      })
      .catch(error => {
        console.error('Game loading failed.', error);

        if (isMounted) {
          setSaveInitializationError('遊戲載入失敗。');
          gameFlowActor.send({ type: 'LOADING_FAILED' });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isAvatarEditorPage]);

  const isGameActive = gameFlowSnapshot?.matches(GameState.Active) ?? false;
  const isGameLoading = gameFlowSnapshot?.matches(GameState.Loading) ?? !gameFlowSnapshot;
  const isActivityObservationPaused = gameFlowSnapshot?.matches({
    [GameState.Active]: {
      world: GameSimWorldState.ActivityObservationPaused,
    },
  }) ?? false;
  const isWorldManuallyPaused = gameFlowSnapshot?.matches({
    [GameState.Active]: {
      world: GameSimWorldState.ManuallyPaused,
    },
  }) ?? false;
  const simWorldState = isActivityObservationPaused
    ? GameSimWorldState.ActivityObservationPaused
    : isWorldManuallyPaused
      ? GameSimWorldState.ManuallyPaused
      : GameSimWorldState.Running;
  const observedActivityId = gameFlowSnapshot?.context.activityObservation?.activityId ?? null;
  const toggleManualWorldPause = () => {
    gameFlowActorRef.current?.send({
      type: isWorldManuallyPaused ? 'RESUME_SIM_WORLD' : 'PAUSE_SIM_WORLD',
    });
  };

  useEffect(() => {
    offlineSessionService.setOfflineProgressionPaused(
      simWorldState !== GameSimWorldState.Running,
    );
  }, [simWorldState]);

  useEffect(() => {
    if (isAvatarEditorPage || !isGameActive) {
      return;
    }

    const controller = startTownSpriteBackgroundBake({
      onProgress: progress => {
        if (progress.failed > 0 && progress.completed >= progress.total) {
          console.warn(`Town background sprite bake completed with ${progress.failed} failed jobs.`);
        }
      },
    });

    return () => {
      controller.cancel();
    };
  }, [isAvatarEditorPage, isGameActive]);

  if (isAvatarEditorPage) {
    return (
      <I18nextProvider i18n={i18n}>
        <div className={styles.avatarEditorPage}>
          <AvatarEditorContainer />
        </div>
      </I18nextProvider>
    );
  }

  return (
    <I18nextProvider i18n={i18n}>
      <div className={styles.app}>
        <div className={styles.demoControls}>
          <button
            className={`${styles.demoButton} ${isWorldManuallyPaused ? styles.demoButtonActive : ''}`}
            type="button"
            disabled={!isGameActive || isActivityObservationPaused}
            aria-pressed={isWorldManuallyPaused}
            onClick={toggleManualWorldPause}
          >
            {isWorldManuallyPaused ? 'Resume World' : 'Pause World'}
          </button>
          <button
            className={styles.demoButton}
            type="button"
            onClick={() => setActiveDialogueSession({ script: DIALOGUE_DEMO_SCRIPT })}
          >
            Test Dialogue
          </button>
          <button
            className={styles.demoButton}
            type="button"
            onClick={() => setMapDialoguePresentation({ ...MAP_DIALOGUE_FADE_DEMO })}
          >
            Map Fade
          </button>
          <button
            className={styles.demoButton}
            type="button"
            onClick={() => setMapDialoguePresentation({ ...MAP_DIALOGUE_BOUNCE_DEMO })}
          >
            Map Bounce
          </button>
          <button
            className={styles.demoButton}
            type="button"
            onClick={() => setSaveDebugOpen(!isSaveDebugOpen)}
          >
            Save DB
          </button>
          <button
            className={styles.demoButton}
            type="button"
            onClick={() => setIsOfflineRecapDebugOpen(isOpen => !isOpen)}
          >
            Offline Recap
          </button>
        </div>
        <button
          className={styles.characterMenuButton}
          type="button"
          disabled={!isGameActive || characterCreationBakeState !== null}
          onClick={() => setIsCharacterPanelOpen(true)}
        >
          角色
        </button>
        <button
          className={styles.menuButton}
          type="button"
          title="設定"
          aria-label="開啟設定"
          onClick={() => setIsSettingsOpen(true)}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>
        {saveInitializationError ? (
          <div className={styles.saveStatus}>{saveInitializationError}</div>
        ) : null}
        {isGameLoading && !saveInitializationError ? (
          <div className={styles.saveStatus}>
            <strong>Game loading</strong>
            <span>{loadingState.label}</span>
            {loadingState.total > 0 ? (
              <span>{loadingState.completed} / {loadingState.total}</span>
            ) : null}
          </div>
        ) : null}
        {characterCreationBakeState ? (
          <div className={styles.creationBakeStatus} role="status" aria-live="polite">
            <strong>{characterCreationBakeState.error ? '創建角色失敗' : '正在烘焙角色'}</strong>
            <span>{characterCreationBakeState.characterName}</span>
            <span>{characterCreationBakeState.error ?? characterCreationBakeState.label}</span>
            {!characterCreationBakeState.error && characterCreationBakeState.total > 0 ? (
              <span>{characterCreationBakeState.completed} / {characterCreationBakeState.total}</span>
            ) : null}
            {characterCreationBakeState.error ? (
              <button
                className={styles.creationBakeDismissButton}
                type="button"
                onClick={() => setCharacterCreationBakeState(null)}
              >
                關閉
              </button>
            ) : null}
          </div>
        ) : null}
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
            interactionCardSelection={interactionCardDraft
              ? {
                cardId: interactionCardDraft.card.id,
                initiatorId: interactionCardDraft.initiatorId,
                targetId: interactionCardDraft.targetId,
              }
              : null}
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
            selectedCardId={interactionCardDraft?.card.id ?? null}
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
            onClose={() => setIsCharacterPanelOpen(false)}
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
      </div>
    </I18nextProvider>
  );
}

function getNormalizedPath(): string {
  return window.location.pathname.replace(/\/$/, '');
}

function createCharacterDialogueLabel(name: string): string {
  return (Array.from(name.trim())[0] ?? '?').toUpperCase();
}

function formatInteractionCardPrompt(
  template: string,
  initiatorName: string,
  targetName: string,
): string {
  return template
    .replace('{initiator}', initiatorName)
    .replace('{target}', targetName);
}

function createActivityDialogueScript(
  request: CharacterPerformanceDialogueRequest,
): DialogueViewScript | null {
  if (!request.scriptId || !request.targetId) {
    return null;
  }

  const definition = DIALOGUE_SCRIPT_DEFINITIONS_BY_ID[request.scriptId];
  const characters = getPlayableCharacters();
  const initiator = characters.find(character => character.id === request.initiatorId);
  const target = characters.find(character => character.id === request.targetId);

  if (!definition || !initiator || !target) {
    return null;
  }

  return createDialogueViewScript(definition, {
    participants: {
      initiator: createDialogueRuntimeParticipant(initiator),
      target: createDialogueRuntimeParticipant(target),
    },
    templateValues: request.templateValues,
    resolveActivityRoll: request.resolveActivityRoll,
    resolveDialogueContent: request.resolveDialogueContent,
    recordSpokenLine: request.recordSpokenLine,
  });
}

function createDialogueRuntimeParticipant(
  character: ReturnType<typeof getPlayableCharacters>[number],
) {
  return {
    id: character.id,
    name: character.name,
    color: character.color,
    label: character.label,
    avatarState: getDialogueAvatarState(character.id),
  };
}

export default App;
