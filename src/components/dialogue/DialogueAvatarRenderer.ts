import { Canvas, Circle, Group, Rect, Text, Textbox } from 'fabric';
import type { Expression } from '~/constants/character';
import type { DialogueAvatarSlot, DialogueViewParticipant } from '~/constants/dialogueDemo';

const STAGE_WIDTH = 960;
const STAGE_HEIGHT = 300;
const AVATAR_RADIUS = 42;
const BUBBLE_WIDTH = 220;
const BUBBLE_HEIGHT = 64;

const SLOT_POSITION_BY_NAME: Record<DialogueAvatarSlot, { x: number; y: number }> = {
  left: { x: 138, y: 166 },
  'center-left': { x: 360, y: 126 },
  'center-right': { x: 600, y: 126 },
  right: { x: 822, y: 166 },
};

export interface DialogueAvatarState {
  activeSpeakerId: string | null;
  expression: Expression | null;
  thinkingSpeakerIds: string[];
  bubbleBySpeakerId: Record<string, string>;
}

export class DialogueAvatarRenderer {
  private readonly canvas: Canvas;
  private readonly avatarGroups = new Map<string, Group>();
  private readonly expressionLabels = new Map<string, Text>();
  private readonly statusLabels = new Map<string, Text>();
  private readonly bubbleLabels = new Map<string, Textbox>();
  private participants: DialogueViewParticipant[] = [];

  constructor(canvasElement: HTMLCanvasElement) {
    this.canvas = new Canvas(canvasElement, {
      width: STAGE_WIDTH,
      height: STAGE_HEIGHT,
      backgroundColor: 'transparent',
      selection: false,
      allowTouchScrolling: false,
    });

    this.canvas.wrapperEl.style.width = '100%';
    this.canvas.wrapperEl.style.height = '100%';
    this.canvas.lowerCanvasEl.style.touchAction = 'none';
    this.canvas.upperCanvasEl.style.touchAction = 'none';
  }

  setParticipants(participants: DialogueViewParticipant[]): void {
    this.participants = participants;
    this.canvas.clear();
    this.avatarGroups.clear();
    this.expressionLabels.clear();
    this.statusLabels.clear();
    this.bubbleLabels.clear();

    participants.forEach(participant => {
      const group = this.createAvatarGroup(participant);
      this.avatarGroups.set(participant.id, group);
      this.canvas.add(group);
    });

    this.canvas.requestRenderAll();
  }

  setDialogueState(state: DialogueAvatarState): void {
    const thinkingSpeakerIds = new Set(state.thinkingSpeakerIds);

    this.participants.forEach(participant => {
      const group = this.avatarGroups.get(participant.id);

      if (!group) {
        return;
      }

      const isActive = participant.id === state.activeSpeakerId;
      const isThinking = thinkingSpeakerIds.has(participant.id);
      const basePosition = SLOT_POSITION_BY_NAME[participant.slot];

      group.set({
        left: basePosition.x,
        top: isActive ? basePosition.y - 16 : basePosition.y,
        opacity: isActive || isThinking ? 1 : 0.42,
        scaleX: isActive ? 1.12 : 0.92,
        scaleY: isActive ? 1.12 : 0.92,
      });

      const expressionLabel = this.expressionLabels.get(participant.id);
      const statusLabel = this.statusLabels.get(participant.id);
      const bubbleLabel = this.bubbleLabels.get(participant.id);

      if (expressionLabel) {
        expressionLabel.set({ text: isActive && state.expression ? state.expression : '' });
      }

      if (statusLabel) {
        statusLabel.set({ text: isThinking ? 'thinking' : '' });
      }

      if (bubbleLabel) {
        bubbleLabel.set({ text: state.bubbleBySpeakerId[participant.id] ?? '' });
        bubbleLabel.initDimensions();
      }
    });

    this.canvas.requestRenderAll();
  }

  destroy(): Promise<boolean> {
    return this.canvas.dispose();
  }

  private createAvatarGroup(participant: DialogueViewParticipant): Group {
    const position = SLOT_POSITION_BY_NAME[participant.slot];
    const face = new Circle({
      radius: AVATAR_RADIUS,
      fill: '#f1c8aa',
      stroke: participant.color,
      strokeWidth: 5,
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 0,
    });
    const hair = new Rect({
      width: AVATAR_RADIUS * 1.6,
      height: 26,
      rx: 12,
      ry: 12,
      fill: participant.color,
      originX: 'center',
      originY: 'center',
      left: 0,
      top: -30,
    });
    const leftEye = new Circle({
      radius: 5,
      fill: '#302b2b',
      originX: 'center',
      originY: 'center',
      left: -16,
      top: -5,
    });
    const rightEye = new Circle({
      radius: 5,
      fill: '#302b2b',
      originX: 'center',
      originY: 'center',
      left: 16,
      top: -5,
    });
    const mouth = new Rect({
      width: 30,
      height: 5,
      rx: 3,
      ry: 3,
      fill: '#8b4141',
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 22,
    });
    const label = new Text(participant.label, {
      fill: '#1f2428',
      fontSize: 20,
      fontWeight: '700',
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 56,
    });
    const expressionLabel = new Text('', {
      fill: '#fff8e8',
      fontSize: 15,
      fontWeight: '700',
      originX: 'center',
      originY: 'center',
      left: 0,
      top: -72,
    });
    const bubbleBounds = new Rect({
      width: BUBBLE_WIDTH,
      height: BUBBLE_HEIGHT,
      fill: 'rgba(0, 0, 0, 0)',
      originX: 'center',
      originY: 'center',
      left: 0,
      top: -104,
    });
    const bubbleLabel = new Textbox('', {
      width: BUBBLE_WIDTH - 18,
      fill: '#fff8e8',
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 1.22,
      originX: 'center',
      originY: 'center',
      left: 0,
      top: -104,
      splitByGrapheme: true,
      textAlign: 'center',
    });
    const statusLabel = new Text('', {
      fill: '#aee6cc',
      fontSize: 13,
      fontWeight: '700',
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 80,
    });
    this.expressionLabels.set(participant.id, expressionLabel);
    this.bubbleLabels.set(participant.id, bubbleLabel);
    this.statusLabels.set(participant.id, statusLabel);

    return new Group([bubbleBounds, bubbleLabel, expressionLabel, face, hair, leftEye, rightEye, mouth, label, statusLabel], {
      left: position.x,
      top: position.y,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });
  }
}
