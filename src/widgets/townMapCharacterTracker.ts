import { Canvas, FabricImage, Group, Rect, Text, type FabricObject } from 'fabric';
import { UI_COLORS } from '~/constants/ui';
import { tintImgByLuminance } from '~/utils/tintImgByLuminance';

import { TownMapCamera, type TownMapCameraPoint } from './townMapCamera';

const trackArrowImageUrl = new URL('../assets/ui/arrow.png', import.meta.url).href;

interface TownMapCharacterTrackerOptions {
  canvas: Canvas;
  camera: TownMapCamera;
  getCharacterCenter: (characterId: string) => TownMapCameraPoint | null;
}

const TRACK_BUTTON_WIDTH = 58;
const TRACK_BUTTON_HEIGHT = 24;
const TRACK_BUTTON_RADIUS = 6;
const TRACK_BUTTON_OFFSET_Y = 34;
const UNTRACK_LABEL_OFFSET_Y = 28;
const UNTRACK_ARROW_OFFSET_Y = 40;
const UNTRACK_ARROW_WIDTH = 11;
const UNTRACK_ARROW_FRAME_HEIGHT = 8;
const UNTRACK_ARROW_FRAME_GAP = 1;
const UNTRACK_ARROW_FRAME_COUNT = 4;
const UNTRACK_ARROW_FRAME_MS = 150;
const UNTRACK_ARROW_FRAME_HOLD_MS = 90;
const UNTRACK_ARROW_STEP_MS = UNTRACK_ARROW_FRAME_MS + UNTRACK_ARROW_FRAME_HOLD_MS;
const UNTRACK_ARROW_RENDER_WIDTH = 11;
const UNTRACK_ARROW_RENDER_HEIGHT = 8;
const TRACKING_LAYER_RANK = 9_000;

export class TownMapCharacterTracker {
  private readonly canvas: Canvas;
  private readonly camera: TownMapCamera;
  private readonly getCharacterCenter: (characterId: string) => TownMapCameraPoint | null;
  private readonly trackButton: Group;
  private readonly untrackLabel: Text;
  private readonly arrowSprite: FabricImage;
  private readonly arrowImage = new Image();
  private tintedArrowCanvas: HTMLCanvasElement | null = null;
  private selectedCharacterId: string | null = null;
  private trackedCharacterId: string | null = null;
  private arrowAnimationTimeoutId: number | null = null;
  private arrowFrameIndex = 0;

  constructor(options: TownMapCharacterTrackerOptions) {
    this.canvas = options.canvas;
    this.camera = options.camera;
    this.getCharacterCenter = options.getCharacterCenter;
    this.trackButton = this.createTrackButton();
    this.arrowSprite = this.createArrowSprite();
    this.untrackLabel = this.createUntrackLabel();
    this.arrowImage.onload = () => {
      this.tintedArrowCanvas = tintImgByLuminance(this.arrowImage, UI_COLORS.trackingArrow);
      this.arrowSprite.dirty = true;
      this.canvas.requestRenderAll();
    };
    this.arrowImage.src = trackArrowImageUrl;
  }

  selectCharacter(characterId: string): void {
    this.selectCharacterForTracking(characterId);
  }

  selectCharacterForTracking(characterId: string): boolean {
    if (!this.getCharacterCenter(characterId)) {
      this.clearSelection();
      return false;
    }

    this.selectedCharacterId = characterId;
    this.ensureTrackButtonMounted();
    this.update();
    return true;
  }

  handlePointerTarget(target: unknown): boolean {
    if (this.isUntrackControl(target)) {
      this.clearTracking();
      return true;
    }

    if (!this.isTrackButton(target) || !this.selectedCharacterId) {
      return false;
    }

    this.trackedCharacterId = this.selectedCharacterId;
    this.clearSelection();
    this.update();
    return true;
  }

  isTrackingControl(target: unknown): boolean {
    return this.isTrackButton(target) || this.isUntrackControl(target);
  }

  clearSelection(): void {
    this.selectedCharacterId = null;
    this.removeTrackButton();
  }

  dispose(): void {
    this.selectedCharacterId = null;
    this.trackedCharacterId = null;
    this.removeTrackButton();
    this.removeUntrackControl();
    this.stopArrowAnimationLoop();
  }

  update(): void {
    this.updateTrackButtonPosition();
    this.updateUntrackControlPosition();
    this.centerTrackedCharacter();
    this.canvas.requestRenderAll();
  }

  removeCharacter(characterId: string): void {
    if (this.selectedCharacterId === characterId) {
      this.selectedCharacterId = null;
      this.removeTrackButton();
    }

    if (this.trackedCharacterId === characterId) {
      this.trackedCharacterId = null;
      this.removeUntrackControl();
    }
  }

  private centerTrackedCharacter(): void {
    if (!this.trackedCharacterId) {
      return;
    }

    const center = this.getCharacterCenter(this.trackedCharacterId);

    if (center) {
      this.camera.centerOn(center);
    }
  }

  private updateTrackButtonPosition(): void {
    if (!this.selectedCharacterId || this.selectedCharacterId === this.trackedCharacterId) {
      this.removeTrackButton();
      return;
    }

    const center = this.getCharacterCenter(this.selectedCharacterId);

    if (!center) {
      this.removeTrackButton();
      return;
    }

    this.ensureTrackButtonMounted();
    this.trackButton.set({
      left: center.x,
      top: center.y - TRACK_BUTTON_OFFSET_Y,
    });
    this.trackButton.setCoords();
  }

  private updateUntrackControlPosition(): void {
    if (!this.trackedCharacterId) {
      this.removeUntrackControl();
      return;
    }

    const center = this.getCharacterCenter(this.trackedCharacterId);

    if (!center) {
      this.removeUntrackControl();
      return;
    }

    this.ensureUntrackControlMounted();
    this.arrowSprite.set({
      left: center.x,
      top: center.y - UNTRACK_ARROW_OFFSET_Y,
    });
    this.arrowSprite.setCoords();
    this.untrackLabel.set({
      left: center.x,
      top: center.y - UNTRACK_ARROW_OFFSET_Y - UNTRACK_LABEL_OFFSET_Y,
    });
    this.untrackLabel.setCoords();
  }

  private ensureTrackButtonMounted(): void {
    if (!this.canvas.contains(this.trackButton)) {
      this.canvas.add(this.trackButton);
    }
  }

  private ensureUntrackControlMounted(): void {
    if (!this.canvas.contains(this.arrowSprite)) {
      this.untrackLabel.set({ visible: false });
      this.canvas.add(this.arrowSprite);
      this.canvas.add(this.untrackLabel);
      this.startArrowAnimationLoop();
    }
  }

  private removeTrackButton(): void {
    if (this.canvas.contains(this.trackButton)) {
      this.canvas.remove(this.trackButton);
      this.canvas.requestRenderAll();
    }
  }

  private removeUntrackControl(): void {
    if (this.canvas.contains(this.arrowSprite)) {
      this.untrackLabel.set({ visible: false });
      this.canvas.remove(this.arrowSprite);
      this.canvas.remove(this.untrackLabel);
      this.stopArrowAnimationLoop();
      this.canvas.requestRenderAll();
    }
  }

  private clearTracking(): void {
    this.trackedCharacterId = null;
    this.removeUntrackControl();
  }

  private createTrackButton(): Group {
    const background = new Rect({
      width: TRACK_BUTTON_WIDTH,
      height: TRACK_BUTTON_HEIGHT,
      rx: TRACK_BUTTON_RADIUS,
      ry: TRACK_BUTTON_RADIUS,
      fill: UI_COLORS.trackingButtonBackground,
      stroke: UI_COLORS.trackingButtonBorder,
      strokeWidth: 1,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });
    const label = new Text('Track', {
      fontSize: 12,
      fontFamily: 'Arial, sans-serif',
      fontWeight: '700',
      fill: UI_COLORS.trackingText,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    });
    const button = new Group([background, label], {
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: true,
      hoverCursor: 'pointer',
      objectCaching: false,
    });

    button.set('characterTrackControl', true);
    button.set('sortBottomY', Number.POSITIVE_INFINITY);
    button.set('entityLayerRank', TRACKING_LAYER_RANK);
    return button;
  }

  private createArrowSprite(): FabricImage {
    const arrowSprite = new FabricImage(this.arrowImage, {
      width: UNTRACK_ARROW_RENDER_WIDTH,
      height: UNTRACK_ARROW_RENDER_HEIGHT,
      originX: 'center',
      originY: 'center',
      left: 0,
      top: 0,
      selectable: false,
      evented: true,
      hoverCursor: 'pointer',
      objectCaching: false,
    });

    arrowSprite.on('mouseover', () => {
      this.untrackLabel.set({ visible: true });
      this.canvas.requestRenderAll();
    });
    arrowSprite.on('mouseout', () => {
      this.untrackLabel.set({ visible: false });
      this.canvas.requestRenderAll();
    });
    arrowSprite.set('characterUntrackControl', true);
    arrowSprite.set('sortBottomY', Number.POSITIVE_INFINITY);
    arrowSprite.set('entityLayerRank', TRACKING_LAYER_RANK);
    arrowSprite._render = (context: CanvasRenderingContext2D) => {
      if (!this.tintedArrowCanvas) {
        return;
      }

      const sourceY = this.arrowFrameIndex * (UNTRACK_ARROW_FRAME_HEIGHT + UNTRACK_ARROW_FRAME_GAP);

      context.save();
      context.imageSmoothingEnabled = false;
      context.drawImage(
        this.tintedArrowCanvas,
        0,
        sourceY,
        UNTRACK_ARROW_WIDTH,
        UNTRACK_ARROW_FRAME_HEIGHT,
        -UNTRACK_ARROW_RENDER_WIDTH / 2,
        -UNTRACK_ARROW_RENDER_HEIGHT / 2,
        UNTRACK_ARROW_RENDER_WIDTH,
        UNTRACK_ARROW_RENDER_HEIGHT,
      );
      context.restore();
    };

    return arrowSprite;
  }

  private createUntrackLabel(): Text {
    const label = new Text('untrack', {
      left: 0,
      top: -UNTRACK_LABEL_OFFSET_Y,
      originX: 'center',
      originY: 'center',
      fontSize: 12,
      fontFamily: 'Arial, sans-serif',
      fontWeight: '700',
      fill: UI_COLORS.trackingText,
      stroke: UI_COLORS.trackingTextStroke,
      strokeWidth: 4,
      paintFirst: 'stroke',
      selectable: false,
      evented: false,
      visible: false,
    });

    label.set('sortBottomY', Number.POSITIVE_INFINITY);
    label.set('entityLayerRank', TRACKING_LAYER_RANK);
    return label;
  }

  private startArrowAnimationLoop(): void {
    if (this.arrowAnimationTimeoutId !== null) {
      return;
    }

    const animateArrow = () => {
      if (!this.canvas.contains(this.arrowSprite)) {
        this.arrowAnimationTimeoutId = null;
        return;
      }

      this.arrowFrameIndex = (this.arrowFrameIndex + 1) % UNTRACK_ARROW_FRAME_COUNT;
      this.arrowSprite.dirty = true;
      this.canvas.requestRenderAll();
      this.arrowAnimationTimeoutId = window.setTimeout(animateArrow, UNTRACK_ARROW_STEP_MS);
    };

    this.arrowFrameIndex = 0;
    this.arrowSprite.dirty = true;
    this.arrowAnimationTimeoutId = window.setTimeout(animateArrow, UNTRACK_ARROW_STEP_MS);
  }

  private stopArrowAnimationLoop(): void {
    if (this.arrowAnimationTimeoutId === null) {
      return;
    }

    window.clearTimeout(this.arrowAnimationTimeoutId);
    this.arrowAnimationTimeoutId = null;
  }

  private isTrackButton(target: unknown): boolean {
    const maybeObject = target as FabricObject | undefined;
    return maybeObject?.get?.('characterTrackControl') === true;
  }

  private isUntrackControl(target: unknown): boolean {
    const maybeObject = target as FabricObject | undefined;
    return maybeObject?.get?.('characterUntrackControl') === true;
  }
}
