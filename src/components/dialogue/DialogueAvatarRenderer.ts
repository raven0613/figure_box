import { Canvas, Circle, Group, Rect, Text, Textbox } from 'fabric';
import { Expression } from '~/constants/character';
import { getAvatarExpressionPreset } from '~/services/characterAvatarCatalogService';
import type { AvatarExpressionPreset } from '~/typing/characterAvatar';
import type { DialogueAvatarSlot, DialogueViewParticipant } from '~/typing/dialogueView';

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
  private readonly faceShapes = new Map<string, Circle>();
  private readonly leftEyeShapes = new Map<string, Circle>();
  private readonly rightEyeShapes = new Map<string, Circle>();
  private readonly mouthShapes = new Map<string, Rect>();
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
    this.faceShapes.clear();
    this.leftEyeShapes.clear();
    this.rightEyeShapes.clear();
    this.mouthShapes.clear();
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
      const expressionPreset = state.expression && isActive
        ? getAvatarExpressionPreset(state.expression)
        : null;

      if (expressionLabel) {
        expressionLabel.set({ text: isActive && state.expression ? state.expression : '' });
      }

      this.applyExpressionPreset(participant.id, expressionPreset);

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
    const avatar = participant.appearance?.avatar;
    const eyePreset = getAvatarExpressionPreset(Expression.Normal).eyes;
    const mouthPreset = getAvatarExpressionPreset(Expression.Normal).mouth;
    const face = new Circle({
      radius: AVATAR_RADIUS,
      fill: avatar?.face.color ?? '#f1c8aa',
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
      fill: avatar?.hair.topHair.color ?? participant.color,
      originX: 'center',
      originY: 'center',
      left: 0,
      top: -30,
      angle: avatar?.hair.topHair.rotate ?? 0,
      scaleX: avatar?.hair.topHair.scale ?? 1,
      scaleY: avatar?.hair.topHair.scale ?? 1,
    });
    const leftEye = new Circle({
      radius: 5,
      fill: avatar?.eyes.color ?? '#302b2b',
      originX: 'center',
      originY: 'center',
      left: -16 + (avatar?.eyes.offsetX ?? 0) + (eyePreset?.offsetX ?? 0),
      top: -5 + (avatar?.eyes.offsetY ?? 0) + (eyePreset?.offsetY ?? 0),
      scaleX: (avatar?.eyes.scale ?? 1) * (eyePreset?.scale ?? 1),
      scaleY: (avatar?.eyes.scale ?? 1) * (eyePreset?.scale ?? 1),
    });
    const rightEye = new Circle({
      radius: 5,
      fill: avatar?.eyes.color ?? '#302b2b',
      originX: 'center',
      originY: 'center',
      left: 16 + (avatar?.eyes.offsetX ?? 0) + (eyePreset?.offsetX ?? 0),
      top: -5 + (avatar?.eyes.offsetY ?? 0) + (eyePreset?.offsetY ?? 0),
      scaleX: (avatar?.eyes.scale ?? 1) * (eyePreset?.scale ?? 1),
      scaleY: (avatar?.eyes.scale ?? 1) * (eyePreset?.scale ?? 1),
    });
    const mouth = new Rect({
      width: 30,
      height: 5,
      rx: 3,
      ry: 3,
      fill: avatar?.mouth.color ?? '#8b4141',
      originX: 'center',
      originY: 'center',
      left: avatar?.mouth.offsetX ?? 0,
      top: 22 + (avatar?.mouth.offsetY ?? 0) + (mouthPreset?.offsetY ?? 0),
      angle: (avatar?.mouth.rotate ?? 0) + (mouthPreset?.rotate ?? 0),
      scaleX: (avatar?.mouth.scale ?? 1) * (mouthPreset?.scale ?? 1),
      scaleY: avatar?.mouth.scale ?? 1,
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
    this.faceShapes.set(participant.id, face);
    this.leftEyeShapes.set(participant.id, leftEye);
    this.rightEyeShapes.set(participant.id, rightEye);
    this.mouthShapes.set(participant.id, mouth);
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

  private applyExpressionPreset(characterId: string, preset: AvatarExpressionPreset | null): void {
    const participant = this.participants.find(entry => entry.id === characterId);
    const avatar = participant?.appearance?.avatar;
    const leftEye = this.leftEyeShapes.get(characterId);
    const rightEye = this.rightEyeShapes.get(characterId);
    const mouth = this.mouthShapes.get(characterId);
    const face = this.faceShapes.get(characterId);
    const eyes = preset?.eyes;
    const mouthPreset = preset?.mouth;
    const facePreset = preset?.face;
    const eyeScale = (avatar?.eyes.scale ?? 1) * (eyes?.scale ?? 1);
    const mouthScale = (avatar?.mouth.scale ?? 1) * (mouthPreset?.scale ?? 1);

    face?.set({
      top: facePreset?.offsetY ?? 0,
      scaleX: facePreset?.scale ?? 1,
      scaleY: facePreset?.scale ?? 1,
    });

    leftEye?.set({
      left: -16 + (avatar?.eyes.offsetX ?? 0) + (eyes?.offsetX ?? 0),
      top: -5 + (avatar?.eyes.offsetY ?? 0) + (eyes?.offsetY ?? 0),
      angle: (avatar?.eyes.rotate ?? 0) + (eyes?.rotate ?? 0),
      scaleX: eyeScale,
      scaleY: eyeScale,
    });

    rightEye?.set({
      left: 16 + (avatar?.eyes.offsetX ?? 0) - (eyes?.offsetX ?? 0),
      top: -5 + (avatar?.eyes.offsetY ?? 0) + (eyes?.offsetY ?? 0),
      angle: (avatar?.eyes.rotate ?? 0) - (eyes?.rotate ?? 0),
      scaleX: eyeScale,
      scaleY: eyeScale,
    });

    mouth?.set({
      left: (avatar?.mouth.offsetX ?? 0) + (mouthPreset?.offsetX ?? 0),
      top: 22 + (avatar?.mouth.offsetY ?? 0) + (mouthPreset?.offsetY ?? 0),
      angle: (avatar?.mouth.rotate ?? 0) + (mouthPreset?.rotate ?? 0),
      scaleX: mouthScale,
      scaleY: avatar?.mouth.scale ?? 1,
    });
  }
}
