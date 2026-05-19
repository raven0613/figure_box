import { Canvas, Text } from 'fabric';
import type { Expression } from '~/constants/character';
import type { MapDialogueBubbleAnimation } from '~/constants/event';
import type { MapActivityView, MapBubbleSequence, MapBubbleSequenceLine } from '~/typing/eventDialoguePresentation';
import type { GridCoordinate } from './townMapGrid';
import {
  CHARACTER_SCALE,
  FLOATING_UI_LAYER_RANK,
} from '../constants/townMapWidgetConstants';

interface BubbleAnimationState {
  bubble: Text;
  animation: MapDialogueBubbleAnimation;
  startedAt: number | null;
  durationMs: number;
  startLeft: number;
  startTop: number;
  direction: 1 | -1;
}

interface TownMapFloatingTextLayerOptions {
  canvas: Canvas;
  cellSize: number;
  getCharacterCenter: (characterId: string) => GridCoordinate | null;
  getZoom: () => number;
  updateCharacterExpression: (characterId: string, expression: Expression) => void;
  startAnimationLoop: () => void;
}

// bubble、emote、map activity、bubble sequence、timer
export class TownMapFloatingTextLayer {
  private readonly canvas: Canvas;
  private readonly cellSize: number;
  private readonly getCharacterCenter: (characterId: string) => GridCoordinate | null;
  private readonly getZoom: () => number;
  private readonly updateCharacterExpression: (characterId: string, expression: Expression) => void;
  private readonly startAnimationLoop: () => void;
  private readonly characterBubbles = new Map<string, Text>();
  private readonly characterEmotes = new Map<string, Text>();
  private readonly bubbleTimers = new Map<string, number>();
  private readonly emoteTimers = new Map<string, number>();
  private readonly bubbleAnimations = new Map<string, BubbleAnimationState>();
  private readonly mapActivityLabels = new Map<string, Text>();
  private readonly mapActivityTimers = new Map<string, number>();

  constructor(options: TownMapFloatingTextLayerOptions) {
    this.canvas = options.canvas;
    this.cellSize = options.cellSize;
    this.getCharacterCenter = options.getCharacterCenter;
    this.getZoom = options.getZoom;
    this.updateCharacterExpression = options.updateCharacterExpression;
    this.startAnimationLoop = options.startAnimationLoop;
  }

  dispose(): void {
    this.clearTimerMap(this.bubbleTimers);
    this.clearTimerMap(this.emoteTimers);
    this.clearTimerMap(this.mapActivityTimers);
    this.characterBubbles.clear();
    this.characterEmotes.clear();
    this.mapActivityLabels.clear();
    this.bubbleAnimations.clear();
  }

  hasActiveAnimations(): boolean {
    return this.bubbleAnimations.size > 0;
  }

  showCharacterBubble(
    characterId: string,
    text: string,
    durationMs = 2600,
    animation: MapDialogueBubbleAnimation = 'fade',
  ): void {
    const anchor = this.getCharacterCenter(characterId);

    if (!anchor) {
      return;
    }

    this.clearTimer(this.bubbleTimers, characterId);
    this.bubbleAnimations.delete(characterId);

    const bubble = this.getOrCreateCharacterBubble(characterId, text);
    const top = anchor.y - this.cellSize * CHARACTER_SCALE * 0.46;

    bubble.set({
      text,
      left: anchor.x,
      top,
      opacity: animation === 'fade' ? 0 : 1,
    });
    this.canvas.bringObjectToFront(bubble);
    this.bubbleAnimations.set(characterId, {
      bubble,
      animation,
      startedAt: null,
      durationMs,
      startLeft: anchor.x,
      startTop: top,
      direction: Math.random() > 0.5 ? 1 : -1,
    });
    this.startAnimationLoop();
    this.canvas.requestRenderAll();

    this.bubbleTimers.set(characterId, window.setTimeout(() => {
      this.removeCharacterBubble(characterId);
    }, durationMs));
  }

  showCharacterEmote(characterId: string, text: string, durationMs = 1200): void {
    const anchor = this.getCharacterCenter(characterId);

    if (!anchor) {
      return;
    }

    this.clearTimer(this.emoteTimers, characterId);

    const emote = this.getOrCreateCharacterEmote(characterId, text);

    emote.set({
      text,
      left: anchor.x + this.cellSize * CHARACTER_SCALE * 0.42,
      top: anchor.y - this.cellSize * CHARACTER_SCALE * 0.72,
      opacity: 1,
    });
    this.canvas.bringObjectToFront(emote);
    this.canvas.requestRenderAll();

    this.emoteTimers.set(characterId, window.setTimeout(() => {
      const currentEmote = this.characterEmotes.get(characterId);

      if (currentEmote) {
        this.canvas.remove(currentEmote);
        this.characterEmotes.delete(characterId);
        this.canvas.requestRenderAll();
      }

      this.emoteTimers.delete(characterId);
    }, durationMs));
  }

  playMapBubbleSequence(
    sequence: MapBubbleSequence,
    onLine?: (line: MapBubbleSequenceLine) => void,
  ): () => void {
    if (sequence.visibleAtZoom !== undefined && this.getZoom() < sequence.visibleAtZoom) {
      return () => undefined;
    }

    const timers = sequence.lines.map((line, index) => window.setTimeout(() => {
      onLine?.(line);
      this.showMapBubbleSequenceLine(line, sequence);
    }, index * sequence.intervalMs));

    return () => {
      timers.forEach(timer => window.clearTimeout(timer));
    };
  }

  showMapActivity(activity: MapActivityView, durationMs: number | null = 4800): void {
    if (activity.visibleAtZoom !== undefined && this.getZoom() < activity.visibleAtZoom) {
      return;
    }

    const points = this.getMapActivityAnchorPoints(activity);

    if (points.length === 0) {
      return;
    }

    this.clearTimer(this.mapActivityTimers, activity.id);

    const center = averagePoints(points);
    const label = this.getOrCreateMapActivityLabel(activity);

    label.set({
      text: activity.label,
      left: center.x,
      top: center.y - this.cellSize * CHARACTER_SCALE * 1.1,
      ...getMapActivityToneStyle(activity.tone),
    });
    this.canvas.bringObjectToFront(label);
    this.canvas.requestRenderAll();

    if (durationMs !== null) {
      this.mapActivityTimers.set(activity.id, window.setTimeout(() => {
        this.removeMapActivity(activity.id);
        this.mapActivityTimers.delete(activity.id);
      }, durationMs));
    }
  }

  removeMapActivity(activityId: string): void {
    const currentLabel = this.mapActivityLabels.get(activityId);

    if (!currentLabel) {
      this.clearTimer(this.mapActivityTimers, activityId);
      return;
    }

    this.canvas.remove(currentLabel);
    this.mapActivityLabels.delete(activityId);
    this.clearTimer(this.mapActivityTimers, activityId);
    this.canvas.requestRenderAll();
  }

  removeCharacterBubbleById(characterId: string): void {
    this.removeCharacterBubble(characterId);
  }

  removeCharacterUi(characterId: string): void {
    this.removeCanvasObject(this.characterBubbles, characterId);
    this.removeCanvasObject(this.characterEmotes, characterId);
    this.bubbleAnimations.delete(characterId);
    this.clearTimer(this.bubbleTimers, characterId);
    this.clearTimer(this.emoteTimers, characterId);
  }

  advanceBubbleAnimations(timestamp: number): void {
    const completedCharacterIds: string[] = [];

    this.bubbleAnimations.forEach((state, characterId) => {
      if (state.startedAt === null) {
        state.startedAt = timestamp;
      }

      const progress = Math.min(1, (timestamp - state.startedAt) / state.durationMs);

      if (state.animation === 'fade') {
        applyFadeBubbleAnimation(state, progress, this.cellSize);
      } else {
        applyBounceAwayBubbleAnimation(state, progress, this.cellSize);
      }

      if (progress >= 1) {
        completedCharacterIds.push(characterId);
      }
    });

    completedCharacterIds.forEach(characterId => {
      this.removeCharacterBubble(characterId);
    });
  }

  private showMapBubbleSequenceLine(line: MapBubbleSequenceLine, sequence: MapBubbleSequence): void {
    if (line.expression) {
      this.updateCharacterExpression(line.characterId, line.expression);
    }

    this.showCharacterBubble(
      line.characterId,
      line.text,
      sequence.bubbleDurationMs,
      sequence.animation,
    );
  }

  private getMapActivityAnchorPoints(activity: MapActivityView): GridCoordinate[] {
    const participantPoints = activity.participantIds
      .map(characterId => this.getCharacterCenter(characterId))
      .filter((point): point is GridCoordinate => point !== null);

    if (participantPoints.length > 0) {
      return participantPoints;
    }

    if (!activity.anchorTile) {
      return [];
    }

    return [{
      x: (activity.anchorTile.x + 0.5) * this.cellSize,
      y: (activity.anchorTile.y + 0.5) * this.cellSize,
    }];
  }

  private removeCharacterBubble(characterId: string): void {
    this.clearTimer(this.bubbleTimers, characterId);

    const currentBubble = this.characterBubbles.get(characterId);

    if (!currentBubble) {
      this.bubbleAnimations.delete(characterId);
      return;
    }

    this.canvas.remove(currentBubble);
    this.characterBubbles.delete(characterId);
    this.bubbleAnimations.delete(characterId);
    this.canvas.requestRenderAll();
  }

  private getOrCreateCharacterBubble(characterId: string, text: string): Text {
    const existing = this.characterBubbles.get(characterId);

    if (existing) {
      return existing;
    }

    const bubble = new Text(text, {
      fontSize: 13,
      fontFamily: 'Arial, sans-serif',
      fill: '#18252c',
      backgroundColor: 'rgba(255, 255, 255, 0.92)',
      originX: 'center',
      originY: 'bottom',
      selectable: false,
      evented: false,
    });

    bubble.set('sortBottomY', Number.POSITIVE_INFINITY);
    bubble.set('entityLayerRank', FLOATING_UI_LAYER_RANK);
    this.characterBubbles.set(characterId, bubble);
    this.canvas.add(bubble);
    return bubble;
  }

  private getOrCreateCharacterEmote(characterId: string, text: string): Text {
    const existing = this.characterEmotes.get(characterId);

    if (existing) {
      return existing;
    }

    const emote = new Text(text, {
      fontSize: 15,
      fontFamily: 'Arial, sans-serif',
      fontWeight: '700',
      fill: '#24313a',
      backgroundColor: 'rgba(255, 236, 153, 0.92)',
      originX: 'center',
      originY: 'bottom',
      selectable: false,
      evented: false,
    });

    emote.set('sortBottomY', Number.POSITIVE_INFINITY);
    emote.set('entityLayerRank', FLOATING_UI_LAYER_RANK);
    this.characterEmotes.set(characterId, emote);
    this.canvas.add(emote);
    return emote;
  }

  private getOrCreateMapActivityLabel(activity: MapActivityView): Text {
    const existing = this.mapActivityLabels.get(activity.id);

    if (existing) {
      return existing;
    }

    const label = new Text(activity.label, {
      fontSize: 12,
      fontFamily: 'Arial, sans-serif',
      fontWeight: '700',
      fill: '#24313a',
      backgroundColor: 'rgba(246, 232, 184, 0.94)',
      originX: 'center',
      originY: 'bottom',
      selectable: false,
      evented: false,
    });

    label.set('sortBottomY', Number.POSITIVE_INFINITY);
    label.set('entityLayerRank', FLOATING_UI_LAYER_RANK);
    this.mapActivityLabels.set(activity.id, label);
    this.canvas.add(label);
    return label;
  }

  private removeCanvasObject(objects: Map<string, Text>, id: string): void {
    const object = objects.get(id);

    if (!object) {
      return;
    }

    this.canvas.remove(object);
    objects.delete(id);
  }

  private clearTimerMap(timerMap: Map<string, number>): void {
    timerMap.forEach(timer => window.clearTimeout(timer));
    timerMap.clear();
  }

  private clearTimer(timerMap: Map<string, number>, timerKey: string): void {
    const timer = timerMap.get(timerKey);

    if (!timer) {
      return;
    }

    window.clearTimeout(timer);
    timerMap.delete(timerKey);
  }
}

function averagePoints(points: readonly GridCoordinate[]): GridCoordinate {
  return points.reduce(
    (sum, point) => ({
      x: sum.x + point.x / points.length,
      y: sum.y + point.y / points.length,
    }),
    { x: 0, y: 0 },
  );
}

function getMapActivityToneStyle(tone: MapActivityView['tone']): {
  fill: string;
  backgroundColor: string;
} {
  if (tone === 'critical') {
    return {
      fill: '#7c2626',
      backgroundColor: 'rgba(255, 220, 220, 0.96)',
    };
  }

  if (tone === 'social') {
    return {
      fill: '#1f5f9f',
      backgroundColor: 'rgba(221, 237, 255, 0.96)',
    };
  }

  if (tone === 'minor') {
    return {
      fill: '#256a43',
      backgroundColor: 'rgba(222, 244, 229, 0.96)',
    };
  }

  return {
    fill: '#24313a',
    backgroundColor: 'rgba(246, 232, 184, 0.94)',
  };
}

function applyFadeBubbleAnimation(state: BubbleAnimationState, progress: number, cellSize: number): void {
  const opacity = progress < 0.18
    ? progress / 0.18
    : progress > 0.78
      ? Math.max(0, (1 - progress) / 0.22)
      : 1;

  state.bubble.set({
    opacity,
    left: state.startLeft,
    top: state.startTop - easeOutCubic(progress) * cellSize * 0.35,
  });
}

function applyBounceAwayBubbleAnimation(state: BubbleAnimationState, progress: number, cellSize: number): void {
  const travel = easeOutBack(progress) * cellSize * 1.35 * state.direction;
  const hop = Math.sin(progress * Math.PI) * cellSize * 0.34;
  const opacity = progress < 0.62 ? 1 : Math.max(0, (1 - progress) / 0.38);

  state.bubble.set({
    opacity,
    left: state.startLeft + travel,
    top: state.startTop - hop,
    angle: state.direction * progress * 7,
  });
}

function easeOutCubic(progress: number): number {
  return 1 - Math.pow(1 - progress, 3);
}

function easeOutBack(progress: number): number {
  const overshoot = 1.45;
  const shifted = progress - 1;

  return 1 + (overshoot + 1) * Math.pow(shifted, 3) + overshoot * Math.pow(shifted, 2);
}
