import { useCallback, useEffect, useRef, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { createActor, type ActorRefFrom, type SnapshotFrom } from 'xstate';
import { OfflineRecapDebugWindow } from '~/components/debug/OfflineRecapDebugWindow';
import { SaveDebugPanel } from '~/components/debug/SaveDebugPanel';
import { CHARACTER_SEEDS, Expression } from '~/constants/character';
import { DIALOGUE_DEMO_SCRIPT } from '~/constants/dialogueDemo';
import { MAP_DIALOGUE_BOUNCE_DEMO, MAP_DIALOGUE_FADE_DEMO } from '~/constants/mapDialogueDemo';
import i18n from '~/i18n';
import type { CharacterPerformanceDialogueRequest } from '~/services/characterEvents/characterPerformanceRunner';
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
import { preloadTownRequiredSpriteSheets } from '~/services/townSpritePreloadService';
import { startTownSpriteBackgroundBake } from '~/services/townSpriteBackgroundBakeService';
import { gameFlowMachine } from '~/stateMachines/gameFlow';
import { GameState } from '~/stateMachines/gameFlow/states';
import type { EventDialoguePresentation } from '~/typing/eventDialoguePresentation';
import type { DialogueViewScript } from '~/typing/dialogueView';
import { AvatarEditorContainer } from './components/avatarEditor/AvatarEditorContainer';
import { DialogueWindow } from './components/dialogue/DialogueWindow';
import { SettingsPanel } from './components/settings/SettingsPanel';
import styles from './App.module.scss';
import { TownMapContainer } from './components/townMap/TownMapContainer';

const AVATAR_EDITOR_PATH = '/figure_box/avatar_editor';

interface AppLoadingState {
  label: string;
  completed: number;
  total: number;
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [globalRomanceDefault, setGlobalRomanceDefault] = useState<GlobalRomanceDefault>('allow');
  const [romanceRules, setRomanceRules] = useState<RomanceRule[]>([]);
  const [romanceProfilesByCharacterId, setRomanceProfilesByCharacterId] = useState<Record<string, CharacterRomanceProfile>>(
    () => createDefaultRomanceProfiles(CHARACTER_SEEDS.map(character => character.id)),
  );
  const [romanceRuleRevision, setRomanceRuleRevision] = useState(0);
  const [activeDialogueScript, setActiveDialogueScript] = useState<DialogueViewScript | null>(null);
  const [dialogueExpressionByCharacterId, setDialogueExpressionByCharacterId] = useState<Partial<Record<string, Expression>>>({});
  const [characterExpressionById, setCharacterExpressionById] = useState<Partial<Record<string, Expression>>>({});
  const [mapDialoguePresentation, setMapDialoguePresentation] = useState<EventDialoguePresentation | null>(null);
  const handleDialogueLineChange = useCallback((line: { speakerId: string; expression: Expression }) => {
    setDialogueExpressionByCharacterId(current => {
      if (current[line.speakerId] === line.expression) {
        return current;
      }

      return {
        ...current,
        [line.speakerId]: line.expression,
      };
    });
  }, []);
  const handleDialogueRequest = useCallback((request: CharacterPerformanceDialogueRequest) => {
    if (request.scriptId === DIALOGUE_DEMO_SCRIPT.id) {
      setActiveDialogueScript(DIALOGUE_DEMO_SCRIPT);
    }
  }, []);
  const handleCharacterExpressionsChange = useCallback((nextExpressionByCharacterId: Partial<Record<string, Expression>>) => {
    setCharacterExpressionById(currentExpressionByCharacterId => {
      const currentEntries = Object.entries(currentExpressionByCharacterId);
      const nextEntries = Object.entries(nextExpressionByCharacterId);
      const didChange = currentEntries.length !== nextEntries.length ||
        nextEntries.some(([characterId, expression]) => currentExpressionByCharacterId[characterId] !== expression);

      return didChange ? nextExpressionByCharacterId : currentExpressionByCharacterId;
    });
  }, []);
  const resetDialogueParticipantExpressions = useCallback((script: DialogueViewScript) => {
    setDialogueExpressionByCharacterId(current => {
      const next = { ...current };

      script.participants.forEach(participant => {
        next[participant.id] = Expression.Normal;
      });

      return next;
    });
  }, []);
  const closeActiveDialogue = useCallback(() => {
    setActiveDialogueScript(currentScript => {
      if (currentScript) {
        resetDialogueParticipantExpressions(currentScript);
      }

      return null;
    });
  }, [resetDialogueParticipantExpressions]);
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
        setLoadingState({
          label: 'Loading sprites',
          completed: 0,
          total: 0,
        });

        return preloadTownRequiredSpriteSheets({
          onProgress: progress => {
            if (!isMounted) {
              return;
            }

            setLoadingState({
              label: progress.currentLabel,
              completed: progress.completed,
              total: progress.total,
            });
          },
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
            className={styles.demoButton}
            type="button"
            onClick={() => setActiveDialogueScript(DIALOGUE_DEMO_SCRIPT)}
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
        {/* <FabricDrawingBoardContainer
          isOpen={true}
          initialData={[]}
          onDataChange={() => { }}
          onClose={() => { }}
        /> */}
        {/* <AvatarEditorContainer /> */}
        {isGameActive ? (
          <TownMapContainer
            expressionByCharacterId={dialogueExpressionByCharacterId}
            mapDialoguePresentation={mapDialoguePresentation}
            romanceRuleRevision={romanceRuleRevision}
            onCharacterExpressionsChange={handleCharacterExpressionsChange}
            onDialogueRequest={handleDialogueRequest}
          />
        ) : null}
        {isSaveDebugOpen ? (
          <SaveDebugPanel onClose={() => setSaveDebugOpen(false)} />
        ) : null}
        {isOfflineRecapDebugOpen ? (
          <OfflineRecapDebugWindow onClose={() => setIsOfflineRecapDebugOpen(false)} />
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
        {activeDialogueScript ? (
          <DialogueWindow
            script={activeDialogueScript}
            expressionByCharacterId={characterExpressionById}
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

export default App;
