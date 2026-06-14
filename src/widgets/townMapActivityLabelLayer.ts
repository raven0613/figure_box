import { Canvas, Text } from 'fabric';
import { PausableTimeoutScheduler } from '~/services/pausableTimeoutScheduler';
import type { MapActivityView } from '~/typing/eventDialoguePresentation';
import {
  FLOATING_UI_LAYER_RANK,
  TOWN_MAP_CHARACTER_RENDER_SCALE,
} from '../constants/townMapWidgetConstants';
import type { GridCoordinate } from './townMapGrid';

interface TownMapActivityLabelLayerOptions {
  canvas: Canvas;
  cellSize: number;
  timerScheduler: PausableTimeoutScheduler;
  getCharacterCenter: (characterId: string) => GridCoordinate | null;
  getZoom: () => number;
  onMapActivityObserve?: (activityId: string) => void;
}

export class TownMapActivityLabelLayer {
  private readonly canvas: Canvas;
  private readonly cellSize: number;
  private readonly timerScheduler: PausableTimeoutScheduler;
  private readonly getCharacterCenter: (characterId: string) => GridCoordinate | null;
  private readonly getZoom: () => number;
  private readonly onMapActivityObserve?: (activityId: string) => void;
  private readonly labels = new Map<string, Text>();
  private readonly timers = new Map<string, number>();
  private viewportZoom = 1;

  constructor(options: TownMapActivityLabelLayerOptions) {
    this.canvas = options.canvas;
    this.cellSize = options.cellSize;
    this.timerScheduler = options.timerScheduler;
    this.getCharacterCenter = options.getCharacterCenter;
    this.getZoom = options.getZoom;
    this.onMapActivityObserve = options.onMapActivityObserve;
  }

  dispose(): void {
    Array.from(this.labels.keys()).forEach(activityId => this.remove(activityId));
    this.timers.forEach(timer => this.timerScheduler.cancel(timer));
    this.timers.clear();
  }

  show(activity: MapActivityView, durationMs: number | null = 4800): void {
    if (activity.visibleAtZoom !== undefined && this.getZoom() < activity.visibleAtZoom) {
      return;
    }

    const points = this.getAnchorPoints(activity);

    if (points.length === 0) {
      return;
    }

    this.clearTimer(activity.id);

    const center = averagePoints(points);
    const label = this.getOrCreateLabel(activity);

    this.configureInteraction(label, activity);
    label.set({
      text: activity.label,
      left: center.x,
      top: center.y - this.cellSize * TOWN_MAP_CHARACTER_RENDER_SCALE * 1.1,
      ...getToneStyle(activity.tone),
    });
    label.setCoords();
    this.canvas.bringObjectToFront(label);
    this.canvas.requestRenderAll();

    if (durationMs !== null) {
      this.timers.set(activity.id, this.timerScheduler.schedule(() => {
        this.remove(activity.id);
      }, durationMs));
    }
  }

  remove(activityId: string): void {
    const currentLabel = this.labels.get(activityId);

    if (!currentLabel) {
      this.clearTimer(activityId);
      return;
    }

    this.canvas.remove(currentLabel);
    this.labels.delete(activityId);
    this.clearTimer(activityId);
    this.canvas.requestRenderAll();
  }

  isInteractionTarget(target: unknown): boolean {
    return Array.from(this.labels.values()).some(label => (
      label === target && label.evented
    ));
  }

  syncViewportZoom(zoom: number): void {
    this.viewportZoom = zoom;
    this.labels.forEach(label => this.applyTextViewportZoom(label));
  }

  private getAnchorPoints(activity: MapActivityView): GridCoordinate[] {
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

  private getOrCreateLabel(activity: MapActivityView): Text {
    const existing = this.labels.get(activity.id);

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
    this.applyTextViewportZoom(label);
    this.labels.set(activity.id, label);
    this.canvas.add(label);
    return label;
  }

  private configureInteraction(label: Text, activity: MapActivityView): void {
    const interaction = activity.interaction;

    label.off('mouseover');
    label.off('mouseout');
    label.off('mouseup');

    if (!interaction) {
      label.set({
        evented: false,
        hoverCursor: 'default',
      });
      return;
    }

    label.set({
      evented: true,
      hoverCursor: 'pointer',
    });
    label.on('mouseover', () => {
      label.set({
        text: `${activity.label}\n[ ${interaction.label} ]`,
      });
      label.setCoords();
      this.canvas.requestRenderAll();
    });
    label.on('mouseout', () => {
      label.set({ text: activity.label });
      label.setCoords();
      this.canvas.requestRenderAll();
    });
    label.on('mouseup', () => {
      this.onMapActivityObserve?.(interaction.activityId);
    });
  }

  private applyTextViewportZoom(text: Text): void {
    const inverseZoom = 1 / this.viewportZoom;

    text.set({
      scaleX: inverseZoom,
      scaleY: inverseZoom,
    });
    text.setCoords();
  }

  private clearTimer(activityId: string): void {
    const timer = this.timers.get(activityId);

    if (!timer) {
      return;
    }

    this.timerScheduler.cancel(timer);
    this.timers.delete(activityId);
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

function getToneStyle(tone: MapActivityView['tone']): {
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
