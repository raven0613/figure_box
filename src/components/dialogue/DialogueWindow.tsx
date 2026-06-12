import { useEffect, useMemo, useState } from 'react';
import type {
  DialogueViewChoice,
  DialogueViewLine,
  DialogueViewInstruction,
  DialogueViewScript,
} from '~/typing/dialogueView';
import { resolveDialogueChoiceResult } from '~/utils/dialogueFlow';
import { DialogueAvatarStage } from './DialogueAvatarStage';

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

export function DialogueWindow({
  script,
  onClose,
  onLineChange,
}: DialogueWindowProps) {
  const [instructions, setInstructions] = useState<DialogueViewInstruction[]>(script.lines);
  const [lineIndex, setLineIndex] = useState(0);
  const [idleDialogueFlow, setIdleDialogueFlow] = useState<IdleDialogueFlow | null>(null);
  const [idleBubbleBySpeakerId, setIdleBubbleBySpeakerId] = useState<Record<string, string>>({});
  const currentInstruction = instructions[lineIndex];
  const currentLine = currentInstruction;
  const currentIdleLine = idleDialogueFlow?.lines[idleDialogueFlow.lineIndex] ?? null;
  const activeLine = currentIdleLine ?? currentLine;
  const isChoiceLine = currentInstruction.type === 'CHOICE';
  const currentChoiceLine = isChoiceLine && currentInstruction.type === 'CHOICE'
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
  const expressionRunId = currentIdleLine
    ? `idle:${lineIndex}:${idleDialogueFlow?.lineIndex ?? 0}:${currentIdleLine.id ?? currentIdleLine.text}`
    : `line:${lineIndex}:${activeLine.id ?? activeLine.text}`;
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
  }, [script.id, script.lines]);

  useEffect(() => {
    onLineChange?.({
      id: activeLine.id,
      type: 'SAY',
      speakerId: activeLine.speakerId,
      text: activeLine.text,
      expressionPresetId: activeLine.expressionPresetId,
    });
  }, [activeLine.expressionPresetId, activeLine.id, activeLine.speakerId, activeLine.text, onLineChange]);

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
    if (isChoiceLine) {
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
    setLineIndex(resolution.nextLineIndex);
  };

  return (
    <section className={styles.dialogueOverlay} aria-label="Dialogue demo">
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
          <p className={styles.lineText}>{currentLine.text}</p>
          {currentChoiceLine ? (
            <div className={styles.choiceGrid}>
              {currentChoiceLine.choices.map(choice => (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => handleChoice(choice)}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          ) : null}
          <div className={styles.actionRow}>
            <span className={styles.progress}>
              {lineIndex + 1} / {instructions.length}
            </span>
            <button type="button" onClick={handleNext} disabled={isChoiceLine}>
              {nextButtonLabel}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
