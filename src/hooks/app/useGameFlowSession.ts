import { useCallback, useEffect, useRef, useState } from 'react';
import { createActor, type ActorRefFrom, type SnapshotFrom } from 'xstate';
import {
  getExpressionBubbleSpritePreloadTotal,
  preloadExpressionBubbleSpriteSheets,
} from '~/services/expressionBubbleSpritePreloadService';
import { offlineSessionService } from '~/services/offlineSimulation/offlineSessionService';
import type { RomanceRuleConfig } from '~/services/romanceRules/romanceRuleService';
import { saveService } from '~/services/save/saveService';
import { settingsService } from '~/services/save/settingsService';
import { startTownSpriteBackgroundBake } from '~/services/townSpriteBackgroundBakeService';
import { preloadTownRequiredSpriteSheets } from '~/services/townSpritePreloadService';
import { gameFlowMachine } from '~/stateMachines/gameFlow';
import { GameSimWorldState, GameState } from '~/stateMachines/gameFlow/states';

interface GameLoadingState {
  label: string;
  completed: number;
  total: number;
}

interface UseGameFlowSessionOptions {
  isAvatarEditorPage: boolean;
  onRomanceRulesLoad: (config: RomanceRuleConfig) => void;
  onSaveDebugPanelOpenLoad: (isOpen: boolean) => void;
}

export function useGameFlowSession({
  isAvatarEditorPage,
  onRomanceRulesLoad,
  onSaveDebugPanelOpenLoad,
}: UseGameFlowSessionOptions) {
  const gameFlowActorRef = useRef<ActorRefFrom<typeof gameFlowMachine> | null>(null);
  const [gameFlowSnapshot, setGameFlowSnapshot] = useState<SnapshotFrom<typeof gameFlowMachine> | null>(null);
  const [loadingState, setLoadingState] = useState<GameLoadingState>({
    label: 'Loading save',
    completed: 0,
    total: 0,
  });
  const [saveInitializationError, setSaveInitializationError] = useState<string | null>(null);

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

        onSaveDebugPanelOpenLoad(settings.isSaveDebugPanelOpen);
        onRomanceRulesLoad(settings.romanceRules);
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
  }, [
    isAvatarEditorPage,
    onRomanceRulesLoad,
    onSaveDebugPanelOpenLoad,
  ]);

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
  const pauseSimWorld = useCallback(() => {
    gameFlowActorRef.current?.send({ type: 'PAUSE_SIM_WORLD' });
  }, []);
  const resumeSimWorld = useCallback(() => {
    gameFlowActorRef.current?.send({ type: 'RESUME_SIM_WORLD' });
  }, []);
  const toggleManualWorldPause = useCallback(() => {
    gameFlowActorRef.current?.send({
      type: isWorldManuallyPaused ? 'RESUME_SIM_WORLD' : 'PAUSE_SIM_WORLD',
    });
  }, [isWorldManuallyPaused]);
  const cancelActivityObservation = useCallback((activityId: string) => {
    gameFlowActorRef.current?.send({
      type: 'CANCEL_ACTIVITY_OBSERVATION',
      activityId,
    });
  }, []);
  const startActivityObservation = useCallback((activityId: string) => {
    gameFlowActorRef.current?.send({
      type: 'START_ACTIVITY_OBSERVATION',
      activityId,
    });
  }, []);
  const closeActivityObservationDialogue = useCallback((activityId: string) => {
    gameFlowActorRef.current?.send({
      type: 'ACTIVITY_OBSERVATION_DIALOGUE_CLOSED',
      activityId,
    });
  }, []);
  const settleActivityObservation = useCallback((activityId: string) => {
    gameFlowActorRef.current?.send({
      type: 'ACTIVITY_OBSERVATION_SETTLED',
      activityId,
    });
  }, []);

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

  return {
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
  };
}
