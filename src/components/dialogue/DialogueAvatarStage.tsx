import { useEffect, useRef } from 'react';
import type { DialogueViewParticipant } from '~/typing/dialogueView';
import { DialogueAvatarRenderer, type DialogueAvatarState } from './DialogueAvatarRenderer';

import styles from './dialogue.module.scss';

interface DialogueAvatarStageProps {
  participants: DialogueViewParticipant[];
  avatarState: DialogueAvatarState;
}

export function DialogueAvatarStage({
  participants,
  avatarState,
}: DialogueAvatarStageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<DialogueAvatarRenderer | null>(null);

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    const renderer = new DialogueAvatarRenderer(canvasRef.current);
    rendererRef.current = renderer;

    return () => {
      rendererRef.current = null;
      void renderer.destroy();
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.setParticipants(participants);
  }, [participants]);

  useEffect(() => {
    rendererRef.current?.setDialogueState(avatarState);
  }, [avatarState, participants]);

  return (
    <div className={styles.avatarStage} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
