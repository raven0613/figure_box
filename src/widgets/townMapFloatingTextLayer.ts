import { Canvas, Text } from 'fabric';
import type { ExpressionPresetId } from '~/constants/character';
import type { MapDialogueBubbleAnimation } from '~/constants/event';
import { PausableTimeoutScheduler } from '~/services/pausableTimeoutScheduler';
import type { MapActivityView, MapBubbleSequence, MapBubbleSequenceLine } from '~/typing/eventDialoguePresentation';
import type { ExpressionBubbleId } from '~/typing/expressionBubble';
import { TownMapActivityLabelLayer } from './townMapActivityLabelLayer';
import { TownMapExpressionBubbleLayer } from './townMapExpressionBubbleLayer';
import type { GridCoordinate } from './townMapGrid';
import {
  FLOATING_UI_LAYER_RANK,
  TOWN_MAP_CHARACTER_RENDER_SCALE,
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
  updateCharacterExpressionPreset: (characterId: string, expressionPresetId: ExpressionPresetId) => void;
  startAnimationLoop: () => void;
  onMapActivityObserve?: (activityId: string) => void;
}

export class TownMapFloatingTextLayer {
  private readonly canvas: Canvas;
  private readonly cellSize: number;
  private readonly getCharacterCenter: (characterId: string) => GridCoordinate | null;
  private readonly getZoom: () => number;
  private readonly updateCharacterExpressionPreset: (characterId: string, expressionPresetId: ExpressionPresetId) => void;
  private readonly startAnimationLoop: () => void;
  private readonly timerScheduler = new PausableTimeoutScheduler();
  private readonly expressionBubbleLayer: TownMapExpressionBubbleLayer;
  private readonly activityLabelLayer: TownMapActivityLabelLayer;
  private readonly characterBubbles = new Map<string, Text>();
  private readonly bubbleTimers = new Map<string, number>();
  private readonly expressionBubbleTimers = new Map<string, number>();
  private readonly bubbleAnimations = new Map<string, BubbleAnimationState>();
  private pausedAt: number | null = null;
  private viewportZoom = 1;

  constructor(options: TownMapFloatingTextLayerOptions) {
    this.canvas = options.canvas;
    this.cellSize = options.cellSize;
    this.getCharacterCenter = options.getCharacterCenter;
    this.getZoom = options.getZoom;
    this.updateCharacterExpressionPreset = options.updateCharacterExpressionPreset;
    this.startAnimationLoop = options.startAnimationLoop;
    this.expressionBubbleLayer = new TownMapExpressionBubbleLayer({
      canvas: this.canvas,
      cellSize: this.cellSize,
      getCharacterCenter: this.getCharacterCenter,
      startAnimationLoop: this.startAnimationLoop,
    });
    this.activityLabelLayer = new TownMapActivityLabelLayer({
      canvas: this.canvas,
      cellSize: this.cellSize,
      timerScheduler: this.timerScheduler,
      getCharacterCenter: this.getCharacterCenter,
      getZoom: this.getZoom,
      onMapActivityObserve: options.onMapActivityObserve,
    });
  }

  dispose(): void {
    this.timerScheduler.clear();
    this.bubbleTimers.clear();
    this.expressionBubbleTimers.clear();
    this.characterBubbles.clear();
    this.expressionBubbleLayer.dispose();
    this.activityLabelLayer.dispose();
    this.bubbleAnimations.clear();
  }

  hasActiveAnimations(): boolean {
    return this.pausedAt === null && (
      this.bubbleAnimations.size > 0
      || this.expressionBubbleLayer.hasActiveAnimations()
    );
  }

  setPaused(isPaused: boolean): void {
    if (isPaused) {
      if (this.pausedAt !== null) {
        return;
      }

      this.pausedAt = performance.now();
      this.timerScheduler.pause();
      this.expressionBubbleLayer.setPaused(true);
      return;
    }

    if (this.pausedAt === null) {
      return;
    }

    const pausedDurationMs = Math.max(0, performance.now() - this.pausedAt);

    this.bubbleAnimations.forEach(state => {
      if (state.startedAt !== null) {
        state.startedAt += pausedDurationMs;
      }
    });
    this.pausedAt = null;
    this.timerScheduler.resume();
    this.expressionBubbleLayer.setPaused(false);

    if (this.hasActiveAnimations()) {
      this.startAnimationLoop();
    }
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
    const top = getCharacterBubbleTop(anchor, this.cellSize);

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

    this.bubbleTimers.set(characterId, this.timerScheduler.schedule(() => {
      this.removeCharacterBubble(characterId);
    }, durationMs));
  }

  showCharacterExpressionBubble(
    characterId: string,
    expressionBubbleId: ExpressionBubbleId,
    durationMs = 1200,
  ): void {
    const anchor = this.getCharacterCenter(characterId);

    if (!anchor) {
      return;
    }

    this.clearTimer(this.expressionBubbleTimers, characterId);
    this.expressionBubbleLayer.show(characterId, expressionBubbleId);

    this.expressionBubbleTimers.set(characterId, this.timerScheduler.schedule(() => {
      this.removeCharacterExpressionBubble(characterId);
    }, durationMs));
  }

  playMapBubbleSequence(
    sequence: MapBubbleSequence,
    onLine?: (line: MapBubbleSequenceLine) => void,
  ): () => void {
    if (sequence.visibleAtZoom !== undefined && this.getZoom() < sequence.visibleAtZoom) {
      return () => undefined;
    }

    const timers = sequence.lines.map((line, index) => this.timerScheduler.schedule(() => {
      onLine?.(line);
      this.showMapBubbleSequenceLine(line, sequence);
    }, index * sequence.intervalMs));

    return () => {
      timers.forEach(timer => this.timerScheduler.cancel(timer));
    };
  }

  showMapActivity(activity: MapActivityView, durationMs: number | null = 4800): void {
    this.activityLabelLayer.show(activity, durationMs);
  }

  syncViewportZoom(zoom: number): void {
    if (this.viewportZoom === zoom) {
      return;
    }

    this.viewportZoom = zoom;
    this.characterBubbles.forEach(text => this.applyTextViewportZoom(text));
    this.expressionBubbleLayer.syncViewportZoom(zoom);
    this.activityLabelLayer.syncViewportZoom(zoom);
    this.canvas.requestRenderAll();
  }

  removeMapActivity(activityId: string): void {
    this.activityLabelLayer.remove(activityId);
  }

  isMapActivityInteractionTarget(target: unknown): boolean {
    return this.activityLabelLayer.isInteractionTarget(target);
  }

  removeCharacterBubbleById(characterId: string): void {
    this.removeCharacterBubble(characterId);
  }

  removeCharacterExpressionBubble(characterId: string): void {
    this.clearTimer(this.expressionBubbleTimers, characterId);
    this.expressionBubbleLayer.remove(characterId);
  }

  removeCharacterUi(characterId: string): void {
    this.removeCanvasObject(this.characterBubbles, characterId);
    this.expressionBubbleLayer.remove(characterId);
    this.bubbleAnimations.delete(characterId);
    this.clearTimer(this.bubbleTimers, characterId);
    this.clearTimer(this.expressionBubbleTimers, characterId);
  }

  syncCharacterPosition(characterId: string, anchor: GridCoordinate): void {
    this.expressionBubbleLayer.syncCharacterPosition(characterId, anchor);

    const animationState = this.bubbleAnimations.get(characterId);

    if (!animationState) {
      return;
    }

    const nextStartTop = getCharacterBubbleTop(anchor, this.cellSize);
    const offsetX = anchor.x - animationState.startLeft;
    const offsetY = nextStartTop - animationState.startTop;

    animationState.startLeft = anchor.x;
    animationState.startTop = nextStartTop;
    animationState.bubble.set({
      left: (animationState.bubble.left ?? 0) + offsetX,
      top: (animationState.bubble.top ?? 0) + offsetY,
    });
    animationState.bubble.setCoords();
  }

  advanceBubbleAnimations(timestamp: number): void {
    if (this.pausedAt !== null) {
      return;
    }

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

    this.expressionBubbleLayer.markSpritesDirty();
  }

  private showMapBubbleSequenceLine(line: MapBubbleSequenceLine, sequence: MapBubbleSequence): void {
    if (line.expressionPresetId) {
      this.updateCharacterExpressionPreset(line.characterId, line.expressionPresetId);
    }

    this.showCharacterBubble(
      line.characterId,
      line.text,
      sequence.bubbleDurationMs,
      sequence.animation,
    );
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
    this.applyTextViewportZoom(bubble);
    this.characterBubbles.set(characterId, bubble);
    this.canvas.add(bubble);
    return bubble;
  }

  private removeCanvasObject(objects: Map<string, Text>, id: string): void {
    const object = objects.get(id);

    if (!object) {
      return;
    }

    this.canvas.remove(object);
    objects.delete(id);
  }

  private applyTextViewportZoom(text: Text): void {
    const inverseZoom = 1 / this.viewportZoom;

    text.set({
      scaleX: inverseZoom,
      scaleY: inverseZoom,
    });
    text.setCoords();
  }

  private clearTimer(timerMap: Map<string, number>, timerKey: string): void {
    const timer = timerMap.get(timerKey);

    if (!timer) {
      return;
    }

    this.timerScheduler.cancel(timer);
    timerMap.delete(timerKey);
  }
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

function getCharacterBubbleTop(anchor: GridCoordinate, cellSize: number): number {
  return anchor.y - cellSize * TOWN_MAP_CHARACTER_RENDER_SCALE * 0.46;
}

function easeOutCubic(progress: number): number {
  return 1 - Math.pow(1 - progress, 3);
}

function easeOutBack(progress: number): number {
  const overshoot = 1.45;
  const shifted = progress - 1;

  return 1 + (overshoot + 1) * Math.pow(shifted, 3) + overshoot * Math.pow(shifted, 2);
}
