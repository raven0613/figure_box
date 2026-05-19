import type { Expression } from '~/constants/character';
import type { EventDialogueDisplayMode, MapDialogueBubbleAnimation } from '~/constants/event';
import type { DialogueViewScript } from '~/typing/dialogueView';

export interface MapActivityView {
  id: string;
  participantIds: string[];
  anchorTile?: {
    x: number;
    y: number;
  };
  label: string;
  tone?: 'critical' | 'social' | 'minor';
  visibleAtZoom?: number;
  previewLine?: MapBubbleSequenceLine;
}

export interface MapBubbleSequenceLine {
  characterId: string;
  text: string;
  expression?: Expression;
}

export interface MapBubbleSequence {
  id: string;
  lines: MapBubbleSequenceLine[];
  animation: MapDialogueBubbleAnimation;
  intervalMs: number;
  bubbleDurationMs: number;
  visibleAtZoom?: number;
}

export interface EventDialoguePresentation {
  mode: EventDialogueDisplayMode;
  activity?: MapActivityView;
  dialogueScript?: DialogueViewScript;
  bubbleSequence?: MapBubbleSequence;
}
