import { useCallback, useRef, useState } from 'react';
import { DIALOGUE_DEMO_SCRIPT } from '~/constants/dialogueDemo';
import { DIALOGUE_SCRIPT_DEFINITIONS_BY_ID } from '~/constants/dialogueScripts';
import { DEFAULT_EXPRESSION_PRESET_ID } from '~/constants/expressionCatalog';
import type { CharacterPerformanceDialogueRequest } from '~/services/characterEvents/characterPerformanceRunner';
import { getDialogueAvatarState } from '~/services/dialogueAvatarStateService';
import { createDialogueViewScript } from '~/services/dialogueScriptResolver';
import { getPlayableCharacters } from '~/services/playableCharacterService';
import type { DialogueViewScript } from '~/typing/dialogueView';
import type { ExpressionPresetId } from '~/typing/expression';

interface ActiveDialogueSession {
  script: DialogueViewScript;
  activityId?: string;
  onBeforeClose?: () => void | Promise<void>;
  onClose?: () => void | Promise<void>;
}

interface PendingDialogueSettlement {
  activityId: string;
  resolve: () => void;
}

interface UseDialogueSessionOptions {
  resumeInteractionCardTargetingPause: () => void;
  onCancelActivityObservation: (activityId: string) => void;
  onStartActivityObservation: (activityId: string) => void;
  onActivityObservationDialogueClosed: (activityId: string) => void;
  onActivityObservationSettled: (activityId: string) => void;
}

export function useDialogueSession({
  resumeInteractionCardTargetingPause,
  onCancelActivityObservation,
  onStartActivityObservation,
  onActivityObservationDialogueClosed,
  onActivityObservationSettled,
}: UseDialogueSessionOptions) {
  const [activeDialogueSession, setActiveDialogueSession] = useState<ActiveDialogueSession | null>(null);
  const [
    expressionPresetIdByCharacterId,
    setExpressionPresetIdByCharacterId,
  ] = useState<Partial<Record<string, ExpressionPresetId>>>({});
  const isDialogueClosingRef = useRef(false);
  const pendingDialogueSettlementRef = useRef<PendingDialogueSettlement | null>(null);
  const openDialogueScript = useCallback((script: DialogueViewScript) => {
    setActiveDialogueSession({ script });
    isDialogueClosingRef.current = false;
  }, []);
  const openDemoDialogue = useCallback(() => {
    openDialogueScript(DIALOGUE_DEMO_SCRIPT);
  }, [openDialogueScript]);
  const cancelActivityObservation = useCallback(async (
    activityId: string,
    onCancel?: () => void | Promise<void>,
  ): Promise<void> => {
    try {
      await onCancel?.();
    } finally {
      onCancelActivityObservation(activityId);
    }
  }, [onCancelActivityObservation]);
  const handleDialogueLineChange = useCallback((line: { speakerId: string; expressionPresetId: ExpressionPresetId }) => {
    setExpressionPresetIdByCharacterId({
      [line.speakerId]: line.expressionPresetId,
    });
  }, []);
  const handleDialogueRequest = useCallback((request: CharacterPerformanceDialogueRequest) => {
    const script = request.scriptId === DIALOGUE_DEMO_SCRIPT.id
      ? DIALOGUE_DEMO_SCRIPT
      : createActivityDialogueScript(request);

    if (!script) {
      const handleCancel = request.onCancel ?? request.onClose;

      void (async () => {
        try {
          if (request.activityId) {
            await cancelActivityObservation(request.activityId, handleCancel);
          } else {
            await handleCancel?.();
          }
        } finally {
          resumeInteractionCardTargetingPause();
        }
      })();
      return false;
    }

    if (request.activityId) {
      onStartActivityObservation(request.activityId);
    }

    setActiveDialogueSession({
      script,
      activityId: request.activityId,
      onBeforeClose: request.onBeforeClose,
      onClose: request.onClose,
    });
    isDialogueClosingRef.current = false;
    return true;
  }, [
    cancelActivityObservation,
    onStartActivityObservation,
    resumeInteractionCardTargetingPause,
  ]);
  const resetDialogueParticipantExpressionPresets = useCallback((script: DialogueViewScript) => {
    setExpressionPresetIdByCharacterId(current => {
      const next = { ...current };

      script.participants.forEach(participant => {
        next[participant.id] = DEFAULT_EXPRESSION_PRESET_ID;
      });

      return next;
    });
  }, []);
  const closeActiveDialogue = useCallback(async () => {
    if (!activeDialogueSession || isDialogueClosingRef.current) {
      return;
    }

    isDialogueClosingRef.current = true;
    try {
      const activityId = activeDialogueSession.activityId;

      if (activityId && activeDialogueSession.onClose) {
        const settlementCompleted = new Promise<void>(resolve => {
          pendingDialogueSettlementRef.current = {
            activityId,
            resolve,
          };
        });

        await activeDialogueSession.onClose();
        await settlementCompleted;
      }

      await activeDialogueSession.onBeforeClose?.();
      resetDialogueParticipantExpressionPresets(activeDialogueSession.script);
      setActiveDialogueSession(null);

      if (activityId) {
        onActivityObservationDialogueClosed(activityId);
      } else {
        await waitForNextAnimationFrame();
        await activeDialogueSession.onClose?.();
      }
    } finally {
      isDialogueClosingRef.current = false;
    }
  }, [
    activeDialogueSession,
    onActivityObservationDialogueClosed,
    resetDialogueParticipantExpressionPresets,
  ]);
  const handleActivitySettled = useCallback((activityId: string) => {
    const pendingSettlement = pendingDialogueSettlementRef.current;

    if (pendingSettlement?.activityId === activityId) {
      pendingDialogueSettlementRef.current = null;
      pendingSettlement.resolve();
    }

    onActivityObservationSettled(activityId);
  }, [onActivityObservationSettled]);

  return {
    activeDialogueSession,
    expressionPresetIdByCharacterId,
    closeActiveDialogue,
    handleActivitySettled,
    handleDialogueLineChange,
    handleDialogueRequest,
    openDemoDialogue,
    openDialogueScript,
  };
}

function waitForNextAnimationFrame(): Promise<void> {
  return new Promise(resolve => {
    window.requestAnimationFrame(() => resolve());
  });
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
    wayOfSaying: character.wayOfSaying
      ? { ...character.wayOfSaying }
      : undefined,
  };
}
