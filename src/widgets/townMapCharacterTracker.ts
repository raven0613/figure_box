import { Canvas, Group, Rect, Text, type FabricObject } from 'fabric';

import { TownMapCamera, type TownMapCameraPoint } from './townMapCamera';

interface TownMapCharacterTrackerOptions {
  canvas: Canvas;
  camera: TownMapCamera;
  getCharacterCenter: (characterId: string) => TownMapCameraPoint | null;
}

const TRACK_BUTTON_WIDTH = 58;
const TRACK_BUTTON_HEIGHT = 24;
const TRACK_BUTTON_RADIUS = 6;
const TRACK_BUTTON_OFFSET_Y = 34;
const TRACKING_LAYER_RANK = 9_000;

export class TownMapCharacterTracker {
  private readonly canvas: Canvas;
  private readonly camera: TownMapCamera;
  private readonly getCharacterCenter: (characterId: string) => TownMapCameraPoint | null;
  private readonly trackButton: Group;
  private selectedCharacterId: string | null = null;
  private trackedCharacterId: string | null = null;

  constructor(options: TownMapCharacterTrackerOptions) {
    this.canvas = options.canvas;
    this.camera = options.camera;
    this.getCharacterCenter = options.getCharacterCenter;
    this.trackButton = this.createTrackButton();
  }

  selectCharacter(characterId: string): void {
    this.selectedCharacterId = characterId;
    this.ensureTrackButtonMounted();
    this.update();
  }

  handlePointerTarget(target: unknown): boolean {
    if (!this.isTrackButton(target) || !this.selectedCharacterId) {
      return false;
    }

    this.trackedCharacterId = this.selectedCharacterId;
    this.centerTrackedCharacter();
    return true;
  }

  isTrackingControl(target: unknown): boolean {
    return this.isTrackButton(target);
  }

  update(): void {
    this.updateTrackButtonPosition();
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
    if (!this.selectedCharacterId) {
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

  private ensureTrackButtonMounted(): void {
    if (!this.canvas.contains(this.trackButton)) {
      this.canvas.add(this.trackButton);
    }
  }

  private removeTrackButton(): void {
    if (this.canvas.contains(this.trackButton)) {
      this.canvas.remove(this.trackButton);
      this.canvas.requestRenderAll();
    }
  }

  private createTrackButton(): Group {
    const background = new Rect({
      width: TRACK_BUTTON_WIDTH,
      height: TRACK_BUTTON_HEIGHT,
      rx: TRACK_BUTTON_RADIUS,
      ry: TRACK_BUTTON_RADIUS,
      fill: 'rgba(36, 49, 58, 0.92)',
      stroke: 'rgba(255, 255, 255, 0.88)',
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
      fill: '#ffffff',
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

  private isTrackButton(target: unknown): boolean {
    const maybeObject = target as FabricObject | undefined;
    return maybeObject?.get?.('characterTrackControl') === true;
  }
}
