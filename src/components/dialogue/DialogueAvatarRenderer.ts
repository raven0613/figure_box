import {
  Canvas,
  Ellipse,
  FabricImage,
  Group,
  Rect,
  Text,
  Textbox,
  type FabricObject,
} from 'fabric';
import { DEFAULT_EXPRESSION_PRESET_ID } from '~/constants/expressionCatalog';
import { getAvatarExpressionPreset } from '~/services/characterAvatarCatalogService';
import {
  ExpressionMotionRuntime,
  type ExpressionMotionFrame,
} from '~/services/expressionMotionRuntime';
import type { DialogueAvatarSlot, DialogueViewParticipant } from '~/typing/dialogueView';
import type {
  ExpressionPresetDefinition,
  ExpressionPresetId,
  ExpressionRenderProfile,
  ExpressionTransform,
} from '~/typing/expression';
import {
  AvatarCanvas,
  normalizeAvatarState,
  type AvatarPartKey,
  type AvatarPartRuntimeTransformPatch,
  type AvatarPartStatePatch,
  type AvatarState,
} from '~/widgets/avatarCanvas';

const STAGE_WIDTH = 960;
const STAGE_HEIGHT = 300;
const PORTRAIT_SOURCE_WIDTH = 520;
const PORTRAIT_SOURCE_HEIGHT = 560;
const PORTRAIT_SCALE = 0.38;
const BUBBLE_WIDTH = 220;
const BUBBLE_HEIGHT = 64;

const SLOT_POSITION_BY_NAME: Record<DialogueAvatarSlot, { x: number; y: number }> = {
  left: { x: 138, y: 160 },
  'center-left': { x: 360, y: 126 },
  'center-right': { x: 600, y: 126 },
  right: { x: 822, y: 160 },
};

const EXPRESSION_PART_KEYS: readonly AvatarPartKey[] = [
  'face',
  'face.color',
  'face.line',
  'ear',
  'eyes',
  'eyes.sclera',
  'eyes.color',
  'eyes.light',
  'eyes.lowerEyelid',
  'eyes.upperEyelid',
  'eyes.eyelid',
  'eyes.eyebrow',
  'mouth',
];

interface PortraitEffectShapes {
  sparkleLeft: Text;
  sparkleRight: Text;
  tearLeft: Ellipse;
  tearRight: Ellipse;
}

interface PortraitRig {
  root: Group;
  avatarCanvas: AvatarCanvas;
  portraitImage: FabricImage;
  baseAvatarState: AvatarState;
  effectShapes: PortraitEffectShapes;
  expressionLabel: Text;
  statusLabel: Text;
  bubbleLabel: Textbox;
}

export interface DialogueAvatarState {
  activeSpeakerId: string | null;
  expressionPresetId: ExpressionPresetId | null;
  expressionRunId: string;
  thinkingSpeakerIds: string[];
  bubbleBySpeakerId: Record<string, string>;
}

export class DialogueAvatarRenderer {
  private readonly canvas: Canvas;
  private readonly rigs = new Map<string, PortraitRig>();
  private readonly motionRuntime = new ExpressionMotionRuntime();
  private participants: DialogueViewParticipant[] = [];
  private activeExpressionRunId: string | null = null;

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
    this.motionRuntime.cancel();
    this.activeExpressionRunId = null;
    this.rigs.forEach(rig => {
      void rig.avatarCanvas.destroy();
    });
    this.rigs.clear();
    this.participants = participants;
    this.canvas.clear();

    participants.forEach(participant => {
      const rig = this.createPortraitRig(participant);
      this.rigs.set(participant.id, rig);
      this.canvas.add(rig.root);
    });

    this.canvas.requestRenderAll();
  }

  setDialogueState(state: DialogueAvatarState): void {
    const thinkingSpeakerIds = new Set(state.thinkingSpeakerIds);

    this.participants.forEach(participant => {
      const rig = this.rigs.get(participant.id);

      if (!rig) {
        return;
      }

      const isActive = participant.id === state.activeSpeakerId;
      const position = SLOT_POSITION_BY_NAME[participant.slot];

      rig.root.set({
        left: position.x,
        top: position.y,
        opacity: isActive ? 1 : 0,
        visible: isActive,
      });
      rig.expressionLabel.set({
        text: isActive && state.expressionPresetId ? state.expressionPresetId : '',
      });
      rig.statusLabel.set({
        text: isActive && thinkingSpeakerIds.has(participant.id) ? 'thinking' : '',
      });
      rig.bubbleLabel.set({
        text: isActive ? state.bubbleBySpeakerId[participant.id] ?? '' : '',
      });
      rig.bubbleLabel.initDimensions();
    });

    if (state.expressionRunId !== this.activeExpressionRunId) {
      this.activeExpressionRunId = state.expressionRunId;
      this.startExpression(
        state.activeSpeakerId,
        state.expressionPresetId ?? DEFAULT_EXPRESSION_PRESET_ID,
      );
    }

    this.canvas.requestRenderAll();
  }

  async destroy(): Promise<void> {
    this.motionRuntime.cancel();
    const canvasDispose = this.canvas.dispose();
    const avatarCanvasDisposals = Array.from(
      this.rigs.values(),
      rig => rig.avatarCanvas.destroy(),
    );

    this.rigs.clear();
    await Promise.all(
      [canvasDispose, ...avatarCanvasDisposals],
    );
  }

  private startExpression(
    characterId: string | null,
    presetId: ExpressionPresetId,
  ): void {
    this.motionRuntime.cancel();

    this.rigs.forEach((rig, rigCharacterId) => {
      resetExpressionParts(rig);
      applyEffectPose(rig, undefined);

      if (rigCharacterId !== characterId) {
        rig.root.set({ visible: false, opacity: 0 });
      }
    });

    if (!characterId) {
      return;
    }

    const rig = this.rigs.get(characterId);

    if (!rig) {
      return;
    }

    const preset = getAvatarExpressionPreset(presetId);
    const expressionRunId = this.activeExpressionRunId;

    applyExpressionPose(rig, preset);
    applyExpressionFrame(rig, preset.portrait, {});
    this.motionRuntime.play({
      profile: preset.portrait,
      onFrame: frame => {
        if (this.activeExpressionRunId !== expressionRunId) {
          return;
        }

        applyExpressionFrame(rig, preset.portrait, frame);
      },
    });
  }

  private createPortraitRig(participant: DialogueViewParticipant): PortraitRig {
    const position = SLOT_POSITION_BY_NAME[participant.slot];
    const baseAvatarState = normalizeAvatarState(participant.avatarState);
    const sourceCanvas = document.createElement('canvas');
    let portraitImage: FabricImage | null = null;
    const avatarCanvas = new AvatarCanvas(sourceCanvas, {
      width: PORTRAIT_SOURCE_WIDTH,
      height: PORTRAIT_SOURCE_HEIGHT,
      initialState: baseAvatarState,
      backgroundColor: 'transparent',
      onRender: () => {
        if (
          this.rigs.get(participant.id)?.avatarCanvas.getCanvasElement() !== sourceCanvas
        ) {
          return;
        }

        portraitImage?.set({ dirty: true });
        this.canvas.requestRenderAll();
      },
    });

    portraitImage = new FabricImage(avatarCanvas.getCanvasElement(), {
      left: 0,
      top: 4,
      originX: 'center',
      originY: 'center',
      scaleX: PORTRAIT_SCALE,
      scaleY: PORTRAIT_SCALE,
      selectable: false,
      evented: false,
      objectCaching: false,
      imageSmoothing: false,
    });

    const effectShapes = createEffectShapes();
    const effects = createPartGroup(Object.values(effectShapes), 0, -18);
    const label = new Text(participant.label, {
      fill: '#1f2428',
      fontSize: 20,
      fontWeight: '700',
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 108,
      selectable: false,
      evented: false,
    });
    const expressionLabel = new Text('', {
      fill: '#fff8e8',
      fontSize: 15,
      fontWeight: '700',
      originX: 'center',
      originY: 'center',
      left: 0,
      top: -116,
      selectable: false,
      evented: false,
    });
    const bubbleBounds = new Rect({
      width: BUBBLE_WIDTH,
      height: BUBBLE_HEIGHT,
      fill: 'rgba(0, 0, 0, 0)',
      originX: 'center',
      originY: 'center',
      left: 0,
      top: -148,
      selectable: false,
      evented: false,
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
      top: -148,
      splitByGrapheme: true,
      textAlign: 'center',
      selectable: false,
      evented: false,
    });
    const statusLabel = new Text('', {
      fill: '#aee6cc',
      fontSize: 13,
      fontWeight: '700',
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 130,
      selectable: false,
      evented: false,
    });
    const root = new Group(
      [
        portraitImage,
        effects,
        bubbleBounds,
        bubbleLabel,
        expressionLabel,
        label,
        statusLabel,
      ],
      {
        left: position.x,
        top: position.y,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
        visible: false,
        opacity: 0,
        objectCaching: false,
      },
    );

    return {
      root,
      avatarCanvas,
      portraitImage,
      baseAvatarState,
      effectShapes,
      expressionLabel,
      statusLabel,
      bubbleLabel,
    };
  }
}

function resetExpressionParts(rig: PortraitRig): void {
  const patches: AvatarPartStatePatch[] = EXPRESSION_PART_KEYS.map(key => ({
    key,
    patch: rig.baseAvatarState[key],
  }));

  rig.avatarCanvas.setPartStates(patches);
  rig.avatarCanvas.setPartRuntimeTransforms(
    EXPRESSION_PART_KEYS.map(key => ({
      key,
      transform: {},
    })),
  );
}

function applyExpressionPose(
  rig: PortraitRig,
  preset: ExpressionPresetDefinition,
): void {
  const profile = preset.portrait;
  const patches: AvatarPartStatePatch[] = [];
  const eyePoseId = profile.eyes?.poseId;
  const eyebrowOptionId = getEyebrowOptionId(eyePoseId);
  const mouthOptionId = getMouthOptionId(
    profile.mouth?.poseId,
    rig.baseAvatarState.mouth.optionId,
  );

  if (eyePoseId === 'laugh') {
    patches.push(
      createVisibilityPatch('eyes.sclera', false),
      createVisibilityPatch('eyes.color', false),
      createVisibilityPatch('eyes.light', false),
      createVisibilityPatch('eyes.lowerEyelid', false),
      createVisibilityPatch('eyes.upperEyelid', false),
      {
        key: 'eyes.eyelid',
        patch: {
          ...rig.baseAvatarState['eyes.eyelid'],
          optionId: 1,
          isVisible: true,
        },
      },
    );
  }

  if (profile.upperEyelids?.poseId === 'look_up') {
    patches.push({
      key: 'eyes.upperEyelid',
      patch: {
        ...rig.baseAvatarState['eyes.upperEyelid'],
        isVisible: true,
      },
    });
  }

  if (eyebrowOptionId !== null) {
    patches.push({
      key: 'eyes.eyebrow',
      patch: {
        ...rig.baseAvatarState['eyes.eyebrow'],
        optionId: eyebrowOptionId,
        isVisible: true,
      },
    });
  }

  patches.push({
    key: 'mouth',
    patch: {
      ...rig.baseAvatarState.mouth,
      optionId: mouthOptionId,
      isVisible: true,
    },
  });

  rig.avatarCanvas.setPartStates(patches);
  applyEffectPose(rig, profile.effectId);
}

function applyExpressionFrame(
  rig: PortraitRig,
  profile: ExpressionRenderProfile,
  motionFrame: ExpressionMotionFrame,
): void {
  const face = combineTransforms(profile.face?.transform, motionFrame.face);
  const eyes = combineTransforms(profile.eyes?.transform, motionFrame.eyes);
  const upperEyelids = combineTransforms(
    profile.upperEyelids?.transform,
    motionFrame.upperEyelids,
  );
  const eyeballs = combineTransforms(
    profile.eyeballs?.transform,
    motionFrame.eyeballs,
  );
  const eyebrows = combineTransforms(
    profile.eyebrows?.transform,
    motionFrame.eyebrows,
  );
  const mouth = combineTransforms(profile.mouth?.transform, motionFrame.mouth);
  const eyeBase = eyes;
  const upperEyelidTransform = combineTransforms(eyeBase, upperEyelids);
  const eyeballTransform = combineTransforms(eyeBase, eyeballs);
  const eyebrowTransform = combineTransforms(eyeBase, eyebrows);
  const patches: AvatarPartRuntimeTransformPatch[] = [
    { key: 'face.color', transform: face },
    { key: 'face.line', transform: face },
    { key: 'ear', transform: face },
    { key: 'eyes.sclera', transform: eyeBase },
    { key: 'eyes.lowerEyelid', transform: eyeBase },
    { key: 'eyes.eyelid', transform: eyeBase },
    { key: 'eyes.upperEyelid', transform: upperEyelidTransform },
    { key: 'eyes.color', transform: eyeballTransform },
    { key: 'eyes.light', transform: eyeballTransform },
    { key: 'eyes.eyebrow', transform: eyebrowTransform },
    { key: 'mouth', transform: mouth },
  ];

  rig.avatarCanvas.setPartRuntimeTransforms(patches);
  rig.portraitImage.set({ dirty: true });
}

function createVisibilityPatch(
  key: AvatarPartKey,
  isVisible: boolean,
): AvatarPartStatePatch {
  return {
    key,
    patch: { isVisible },
  };
}

function getEyebrowOptionId(eyePoseId: string | undefined): number | null {
  if (eyePoseId === 'mad') {
    return 2;
  }

  if (eyePoseId === 'cry') {
    return 3;
  }

  if (eyePoseId === 'curious') {
    return 4;
  }

  return null;
}

function getMouthOptionId(
  poseId: string | undefined,
  defaultOptionId: number,
): number {
  if (poseId === 'open_smile') {
    return 3;
  }

  if (poseId === 'small_open') {
    return 2;
  }

  if (
    poseId === 'smile_up'
    || poseId === 'small_smile'
    || poseId === 'flat_down'
  ) {
    return 1;
  }

  return defaultOptionId;
}

function createEffectShapes(): PortraitEffectShapes {
  return {
    sparkleLeft: new Text('*', {
      left: -45,
      top: -22,
      fill: '#f7df74',
      fontSize: 24,
      fontWeight: '700',
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      visible: false,
    }),
    sparkleRight: new Text('*', {
      left: 47,
      top: -31,
      fill: '#fff1a8',
      fontSize: 16,
      fontWeight: '700',
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      visible: false,
    }),
    tearLeft: new Ellipse({
      left: -25,
      top: 9,
      rx: 2.5,
      ry: 7,
      fill: '#77c5ee',
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      visible: false,
    }),
    tearRight: new Ellipse({
      left: 25,
      top: 9,
      rx: 2.5,
      ry: 7,
      fill: '#77c5ee',
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      visible: false,
    }),
  };
}

function createPartGroup(
  objects: FabricObject[],
  left: number,
  top: number,
): Group {
  return new Group(objects, {
    left,
    top,
    originX: 'center',
    originY: 'center',
    selectable: false,
    evented: false,
    subTargetCheck: false,
    objectCaching: false,
  });
}

function applyEffectPose(rig: PortraitRig, effectId: string | undefined): void {
  Object.values(rig.effectShapes).forEach(shape => {
    shape.set({ visible: false });
  });

  if (effectId === 'sparkle_light') {
    rig.effectShapes.sparkleLeft.set({ visible: true });
    rig.effectShapes.sparkleRight.set({ visible: true });
    return;
  }

  if (effectId === 'tear') {
    rig.effectShapes.tearLeft.set({ visible: true });
    rig.effectShapes.tearRight.set({ visible: true });
  }
}

function combineTransforms(
  staticTransform: ExpressionTransform | undefined,
  motionTransform: ExpressionTransform | undefined,
): ExpressionTransform {
  return {
    offsetX: (staticTransform?.offsetX ?? 0) + (motionTransform?.offsetX ?? 0),
    offsetY: (staticTransform?.offsetY ?? 0) + (motionTransform?.offsetY ?? 0),
    rotate: (staticTransform?.rotate ?? 0) + (motionTransform?.rotate ?? 0),
    scale: (staticTransform?.scale ?? 1) * (motionTransform?.scale ?? 1),
    opacity: (staticTransform?.opacity ?? 1) * (motionTransform?.opacity ?? 1),
  };
}
