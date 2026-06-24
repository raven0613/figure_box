import { useEffect, useMemo, useState } from 'react';
import type {
  DialogueInputAction,
  DialogueViewChoice,
  DialogueActivityRollContext,
  DialogueViewChoiceLine,
  DialogueViewInputLine,
  DialogueViewLine,
  DialogueViewInstruction,
  DialogueViewScript,
  DialogueTextSegment,
} from '~/typing/dialogueView';
import { resolveDialogueActivityRoll, resolveDialogueChoiceResult } from '~/utils/dialogueFlow';
import { DialogueAvatarStage } from './DialogueAvatarStage';
import { DialogueInputForm } from './DialogueInputForm';

import styles from './dialogue.module.scss';

interface DialogueWindowProps {
  script: DialogueViewScript;
  onClose: () => void;
  onLineChange?: (line: DialogueViewLine) => void;
}

interface IdleDialogueFlow {
  lines: DialogueViewLine[];
  lineIndex: number;
}

const IDLE_DIALOGUE_LINE_DURATION_MS = 2200;

type DialogueDisplayLine = DialogueViewLine | DialogueViewChoiceLine | DialogueViewInputLine;

function isReadableDialogueLine(instruction: DialogueViewInstruction | undefined): instruction is DialogueDisplayLine {
  return instruction?.type === 'SAY'
    || instruction?.type === 'CHOICE'
    || instruction?.type === 'INPUT';
}

function getFallbackDialogueLine(
  instructions: DialogueViewInstruction[],
  lineIndex: number,
  script: DialogueViewScript,
): DialogueDisplayLine {
  const previousLine = instructions
    .slice(0, lineIndex)
    .reverse()
    .find(isReadableDialogueLine);

  if (previousLine) {
    return previousLine;
  }

  const nextLine = instructions.slice(lineIndex + 1).find(isReadableDialogueLine);

  if (nextLine) {
    return nextLine;
  }

  return {
    type: 'SAY',
    speakerId: script.participants[0]?.id ?? '',
    text: '',
    expressionPresetId: 'normal',
  };
}

function getDefaultInputSubmitActions(inputLine: DialogueViewInputLine): DialogueInputAction[] {
  const actions: DialogueInputAction[] = [];

  if (inputLine.variable) {
    actions.push({ type: 'replaceTemplate' });
  }

  if (inputLine.targetId && inputLine.memoryKey) {
    actions.push({ type: 'recordSpokenLine' });
  }

  return actions;
}

function renderDialogueText(
  text: string,
  textSegments: DialogueTextSegment[] | undefined,
) {
  if (!textSegments?.length) {
    return text;
  }

  return textSegments.map((segment, index) => (
    <span
      key={`${index}:${segment.text}`}
      style={segment.color ? { color: segment.color } : undefined}
    >
      {segment.text}
    </span>
  ));
}

function getDialogueTextSegments(line: DialogueDisplayLine): DialogueTextSegment[] | undefined {
  if (line.type === 'INPUT') {
    return line.promptSegments;
  }

  return line.textSegments;
}

export function DialogueWindow({
  script,
  onClose,
  onLineChange,
}: DialogueWindowProps) {
  const [instructions, setInstructions] = useState<DialogueViewInstruction[]>(script.lines);
  const [lineIndex, setLineIndex] = useState(0);
  const [idleDialogueFlow, setIdleDialogueFlow] = useState<IdleDialogueFlow | null>(null);
  const [idleBubbleBySpeakerId, setIdleBubbleBySpeakerId] = useState<Record<string, string>>({});
  const [activityRollContext, setActivityRollContext] = useState<DialogueActivityRollContext>({});
  const currentInstruction = instructions[lineIndex];
  const currentLine = isReadableDialogueLine(currentInstruction)
    ? currentInstruction
    : getFallbackDialogueLine(instructions, lineIndex, script);
  const currentIdleLine = idleDialogueFlow?.lines[idleDialogueFlow.lineIndex] ?? null;
  const activeLine = currentIdleLine ?? currentLine;
  const isChoiceLine = currentInstruction?.type === 'CHOICE';
  const isInputLine = currentInstruction?.type === 'INPUT';
  const isActivityRollLine = currentInstruction?.type === 'ACTIVITY_ROLL';
  const currentChoiceLine = isChoiceLine && currentInstruction?.type === 'CHOICE'
    ? currentInstruction
    : null;
  const currentInputLine = isInputLine && currentInstruction?.type === 'INPUT'
    ? currentInstruction
    : null;
  const activeSpeaker = useMemo(
    () => script.participants.find(participant => participant.id === activeLine.speakerId),
    [activeLine.speakerId, script.participants],
  );
  const isLastLine = lineIndex >= instructions.length - 1;
  const nextButtonLabel = isLastLine ? 'Close' : 'Next';
  const thinkingSpeakerIds = useMemo(
    () => isChoiceLine ? script.participants.map(participant => participant.id) : [],
    [isChoiceLine, script.participants],
  );
  const currentExpressionPresetId = activeLine.expressionPresetId;
  const activeLineText = activeLine.type === 'INPUT'
    ? activeLine.prompt
    : activeLine.text;
  const expressionRunId = currentIdleLine
    ? `idle:${lineIndex}:${idleDialogueFlow?.lineIndex ?? 0}:${currentIdleLine.id ?? currentIdleLine.text}`
    : `line:${lineIndex}:${activeLine.id ?? activeLineText}`;
  const bubbleBySpeakerId = useMemo(() => {
    if (currentIdleLine) {
      return {
        [currentIdleLine.speakerId]: currentIdleLine.text,
      };
    }

    return idleBubbleBySpeakerId;
  }, [currentIdleLine, idleBubbleBySpeakerId]);
  const avatarState = useMemo(() => ({
    activeSpeakerId: activeLine.speakerId,
    expressionPresetId: currentExpressionPresetId,
    expressionRunId,
    thinkingSpeakerIds,
    bubbleBySpeakerId,
  }), [
    activeLine.speakerId,
    bubbleBySpeakerId,
    currentExpressionPresetId,
    expressionRunId,
    thinkingSpeakerIds,
  ]);

  useEffect(() => {
    setInstructions(script.lines);
    setLineIndex(0);
    setIdleDialogueFlow(null);
    setIdleBubbleBySpeakerId({});
    setActivityRollContext({});
  }, [script.id, script.lines]);

  useEffect(() => {
    if (isActivityRollLine || activeLine.type === 'INPUT') {
      return;
    }

    onLineChange?.({
      id: activeLine.id,
      type: 'SAY',
      speakerId: activeLine.speakerId,
      text: activeLine.text,
      expressionPresetId: activeLine.expressionPresetId,
    });
  }, [
    activeLine.expressionPresetId,
    activeLine.id,
    activeLine.speakerId,
    activeLineText,
    currentIdleLine,
    isActivityRollLine,
    onLineChange,
  ]);

  useEffect(() => {
    if (!currentInstruction || currentInstruction.type !== 'ACTIVITY_ROLL') {
      return;
    }

    const resolution = resolveDialogueActivityRoll(
      script,
      instructions,
      lineIndex,
      currentInstruction,
      activityRollContext,
    );

    if (resolution.instructions.length === 0) {
      onClose();
      return;
    }

    setInstructions(resolution.instructions);
    setIdleDialogueFlow(null);
    setIdleBubbleBySpeakerId({});
    setLineIndex(Math.max(0, resolution.nextLineIndex));
  }, [activityRollContext, currentInstruction, instructions, lineIndex, onClose, script]);

  useEffect(() => {
    setIdleDialogueFlow(null);
    setIdleBubbleBySpeakerId({});

    if (!isChoiceLine || currentInstruction.type !== 'CHOICE') {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (currentInstruction.idlePromptLines?.length) {
        setIdleDialogueFlow({
          lines: currentInstruction.idlePromptLines,
          lineIndex: 0,
        });
        return;
      }

      if (currentInstruction.idlePrompt) {
        setIdleBubbleBySpeakerId({
          [currentInstruction.speakerId]: currentInstruction.idlePrompt,
        });
      }
    }, currentInstruction.timeoutMs);

    return () => window.clearTimeout(timeoutId);
  }, [currentInstruction, isChoiceLine]);

  useEffect(() => {
    if (!idleDialogueFlow) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIdleDialogueFlow(current => {
        if (!current) {
          return null;
        }

        if (current.lineIndex >= current.lines.length - 1) {
          return null;
        }

        return {
          ...current,
          lineIndex: current.lineIndex + 1,
        };
      });
    }, IDLE_DIALOGUE_LINE_DURATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [idleDialogueFlow]);

  const handleNext = () => {
    if (isChoiceLine || isInputLine || isActivityRollLine) {
      return;
    }

    if (isLastLine) {
      onClose();
      return;
    }

    setLineIndex(current => Math.min(current + 1, instructions.length - 1));
  };

  const handleChoice = (choice: DialogueViewChoice) => {
    const resolution = resolveDialogueChoiceResult(script, instructions, lineIndex, choice.result);

    if (resolution.shouldClose) {
      onClose();
      return;
    }

    setInstructions(resolution.instructions);
    setIdleDialogueFlow(null);
    setIdleBubbleBySpeakerId({});
    if (resolution.rollContext) {
      setActivityRollContext(current => ({
        ...current,
        ...resolution.rollContext,
      }));
    }
    setLineIndex(resolution.nextLineIndex);
  };

  const handleInputComplete = (inputLine: DialogueViewInputLine, value: string) => {
    runInputActions(inputLine, value, inputLine.submitActions ?? getDefaultInputSubmitActions(inputLine));
    advanceAfterInput();
  };

  const handleInputSkip = (inputLine: DialogueViewInputLine) => {
    runInputActions(inputLine, '', inputLine.skipActions ?? []);
    advanceAfterInput();
  };

  const advanceAfterInput = () => {
    if (isLastLine) {
      onClose();
      return;
    }

    setLineIndex(current => Math.min(current + 1, instructions.length - 1));
  };

  const runInputActions = (
    inputLine: DialogueViewInputLine,
    value: string,
    actions: readonly DialogueInputAction[],
  ) => {
    actions.forEach(action => {
      if (action.type === 'replaceTemplate') {
        replaceInputTemplate(inputLine, action, value);
        return;
      }

      if (action.type === 'recordSpokenLine') {
        recordInputSpokenLine(inputLine, action, value);
        return;
      }

      void script.handleInputAction?.({
        action,
        inputLine,
        value,
      });
    });
  };

  const replaceInputTemplate = (
    inputLine: DialogueViewInputLine,
    action: Extract<DialogueInputAction, { type: 'replaceTemplate' }>,
    value: string,
  ) => {
    const variable = action.variable ?? inputLine.variable;

    if (!variable) {
      return;
    }

    const templateToken = `{${variable}}`;
    const replacementValue = action.value ?? (
      value
        ? `${action.valuePrefix ?? ''}${value}${action.valueSuffix ?? ''}`
        : ''
    );

    setInstructions(current => current.map((instruction, index) => {
      if (index <= lineIndex || instruction.type !== 'SAY') {
        return instruction;
      }

      return {
        ...instruction,
        text: instruction.text.split(templateToken).join(replacementValue),
        textSegments: instruction.textSegments?.map(segment => ({
          ...segment,
          text: segment.text.split(templateToken).join(replacementValue),
        })),
      };
    }));
  };

  const recordInputSpokenLine = (
    inputLine: DialogueViewInputLine,
    action: Extract<DialogueInputAction, { type: 'recordSpokenLine' }>,
    value: string,
  ) => {
    const targetId = action.targetId ?? inputLine.targetId;
    const memoryKey = action.memoryKey ?? inputLine.memoryKey;

    if (!targetId || !memoryKey) {
      return;
    }

    script.recordSpokenLine?.({
      speakerId: inputLine.speakerId,
      targetId,
      memoryKey,
      text: value,
    });
  };

  return (
    <section
      className={styles.dialogueOverlay}
      aria-label="Dialogue demo"
    >
      <div className={styles.dialogueSurface}>
        <DialogueAvatarStage
          participants={script.participants}
          avatarState={avatarState}
        />

        <div className={styles.dialogueBox}>
          <div className={styles.speakerBar}>
            <strong>{activeSpeaker?.name ?? 'Unknown'}</strong>
            <span>{currentExpressionPresetId}</span>
          </div>
          <p className={styles.lineText}>
            {renderDialogueText(activeLineText, getDialogueTextSegments(activeLine))}
          </p>
          {currentInputLine ? (
            <DialogueInputForm
              key={currentInputLine.id ?? `${lineIndex}:${currentInputLine.memoryKey}`}
              inputLine={currentInputLine}
              onSubmit={value => handleInputComplete(currentInputLine, value)}
              onSkip={() => handleInputSkip(currentInputLine)}
            />
          ) : null}
          {currentChoiceLine ? (
            <div className={styles.choiceGrid}>
              {currentChoiceLine.choices.map(choice => (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => handleChoice(choice)}
                >
                  {renderDialogueText(choice.label, choice.labelSegments)}
                </button>
              ))}
            </div>
          ) : null}
          <div className={styles.actionRow}>
            <span className={styles.progress}>
              {lineIndex + 1} / {instructions.length}
            </span>
            <button
              type="button"
              onClick={handleNext}
              disabled={isChoiceLine || isInputLine || isActivityRollLine}
            >
              {nextButtonLabel}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
