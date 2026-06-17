import { isAvatarPartOptionColorEditable } from '../../avatar/avatarDefinitions';
import type {
  AvatarGradientCoordinateSpace,
  AvatarPartKey,
  AvatarState,
  AvatarTintSource,
} from '../../avatar/avatarTypes';
import {
  formatMiniOptionId,
  getFirstAvailableMiniOptionId,
  hasMiniAvatarAsset,
} from '../miniAvatarAssets';
import type {
  MiniLayer,
  MiniLocalLayer,
  MiniPoint,
  MiniPose,
  MiniRigNode,
  MiniTransform,
} from '../miniAvatarTypes';
import {
  MiniLayerBuilder,
  type MiniMirroredSocketPoints,
} from './miniLayerBuilder';

export abstract class MiniBaseIdleLayerRenderer {
  protected readonly state: AvatarState;
  protected readonly pose: MiniPose;

  private readonly layerBuilder = new MiniLayerBuilder();
  private readonly fallbackLineColor: string;

  constructor(state: AvatarState, pose: MiniPose, fallbackLineColor: string) {
    this.state = state;
    this.pose = pose;
    this.fallbackLineColor = fallbackLineColor;
  }

  protected getPartOptionId(key: AvatarPartKey): number {
    return this.state[key].optionId;
  }

  protected getPartColor(key: AvatarPartKey, fallbackColor: string): AvatarTintSource {
    return this.state[key].colorGradient ?? this.state[key].color ?? fallbackColor;
  }

  protected getPartSecondaryTintSource(key: AvatarPartKey, fallbackColor: AvatarTintSource): AvatarTintSource {
    return this.state[key].secondaryColorGradient ?? this.state[key].secondaryColor ?? fallbackColor;
  }

  protected getPartSecondaryColor(key: AvatarPartKey, fallbackColor: string): string {
    return this.state[key].secondaryColor ?? fallbackColor;
  }

  protected getPartLineTintSource(key: AvatarPartKey): AvatarTintSource {
    return this.state[key].lineColorGradient ?? this.state[key].lineColor ?? this.fallbackLineColor;
  }

  protected getPartColorGradientSpace(key: AvatarPartKey): AvatarGradientCoordinateSpace | undefined {
    return this.state[key].colorGradientSpace;
  }

  protected getEditablePartColor(key: AvatarPartKey, fallbackColor: string): AvatarTintSource | undefined {
    return this.isPartColorEditable(key) ? this.getPartColor(key, fallbackColor) : undefined;
  }

  protected isPartColorEditable(key: AvatarPartKey): boolean {
    return isAvatarPartOptionColorEditable(key, this.getPartOptionId(key));
  }

  protected isPartVisible(key: AvatarPartKey): boolean {
    return this.state[key].isVisible !== false;
  }

  protected getPartLayerOrder(key: AvatarPartKey): number {
    return this.state[key].layerOrder ?? (key === 'mini.clothingTop' ? 1 : 0);
  }

  protected resolveOptionId(folder: string, requestedOptionId: number): string {
    const requestedId = formatMiniOptionId(requestedOptionId);

    if (hasMiniAvatarAsset(folder, `${requestedId}_color.png`) || hasMiniAvatarAsset(folder, `${requestedId}_line.png`)) {
      return requestedId;
    }

    return getFirstAvailableMiniOptionId(folder) ?? '01';
  }

  protected getPoseNodeTransform(nodeKey: keyof NonNullable<MiniPose['nodes']>): MiniTransform {
    return this.pose.nodes?.[nodeKey] ?? {};
  }

  protected createColorAndLineLayers(
    folder: string,
    optionId: string,
    color: AvatarTintSource,
    lineColor: AvatarTintSource,
    x: number,
    y: number,
    zIndex: number,
    colorGradientSpace?: AvatarGradientCoordinateSpace,
  ): MiniLayer[] {
    return this.layerBuilder.createColorAndLineLayers(folder, optionId, color, lineColor, x, y, zIndex, colorGradientSpace);
  }

  protected createColorOnlyLayers(
    folder: string,
    optionId: string,
    color: AvatarTintSource,
    x: number,
    y: number,
    zIndex: number,
  ): MiniLayer[] {
    return this.layerBuilder.createColorOnlyLayers(folder, optionId, color, x, y, zIndex);
  }

  protected createLineOnlyLayers(
    folder: string,
    optionId: string,
    color: AvatarTintSource,
    x: number,
    y: number,
    zIndex: number,
  ): MiniLayer[] {
    return this.layerBuilder.createLineOnlyLayers(folder, optionId, color, x, y, zIndex);
  }

  protected createNamedColorAndLineLayers(
    folder: string,
    colorFile: string,
    lineFile: string,
    color: AvatarTintSource | undefined,
    lineColor: AvatarTintSource | undefined,
    x: number,
    y: number,
    zIndex: number,
  ): MiniLayer[] {
    return this.layerBuilder.createNamedColorAndLineLayers(folder, colorFile, lineFile, color, lineColor, x, y, zIndex);
  }

  protected createNamedSingleFileLayers(
    folder: string,
    file: string,
    color: AvatarTintSource | undefined,
    x: number,
    y: number,
    zIndex: number,
  ): MiniLayer[] {
    return this.layerBuilder.createNamedSingleFileLayers(folder, file, color, x, y, zIndex);
  }

  protected createNamedColorAndLineLocalLayers(
    folder: string,
    colorFile: string,
    lineFile: string,
    color: AvatarTintSource | undefined,
    lineColor: AvatarTintSource | undefined,
    zIndex: number,
    x = 0,
    y = 0,
    flipX = false,
  ): MiniLocalLayer[] {
    return this.layerBuilder.createNamedColorAndLineLocalLayers(
      folder,
      colorFile,
      lineFile,
      color,
      lineColor,
      zIndex,
      x,
      y,
      flipX,
    );
  }

  protected createColorAndLineLocalLayers(
    folder: string,
    optionId: string,
    color: AvatarTintSource,
    lineColor: AvatarTintSource,
    zIndex: number,
    flipX = false,
    anchorOffset: MiniPoint = { x: 0, y: 0 },
    colorGradientSpace?: AvatarGradientCoordinateSpace,
  ): MiniLocalLayer[] {
    return this.layerBuilder.createColorAndLineLocalLayers(
      folder,
      optionId,
      color,
      lineColor,
      zIndex,
      flipX,
      anchorOffset,
      colorGradientSpace,
    );
  }

  protected createMirroredColorAndLineLayers(
    folder: string,
    optionId: string,
    color: AvatarTintSource,
    lineColor: AvatarTintSource,
    distance: number,
    y: number,
    zIndex: number,
    angle = 0,
  ): MiniLayer[] {
    return this.layerBuilder.createMirroredColorAndLineLayers(folder, optionId, color, lineColor, distance, y, zIndex, angle);
  }

  protected createMirroredColorAndLineNodes(
    folder: string,
    optionId: string,
    color: AvatarTintSource,
    lineColor: AvatarTintSource,
    socketPoints: MiniMirroredSocketPoints,
    zIndex: number,
    leftTransform: MiniTransform = {},
    rightTransform: MiniTransform = {},
    extraLayers: MiniLocalLayer[] = [],
    anchorOffset?: MiniPoint,
    shouldPreserveVisualPoint = false,
  ): MiniRigNode[] {
    return this.layerBuilder.createMirroredColorAndLineNodes(
      folder,
      optionId,
      color,
      lineColor,
      socketPoints,
      zIndex,
      leftTransform,
      rightTransform,
      extraLayers,
      anchorOffset,
      shouldPreserveVisualPoint,
    );
  }

  protected createMirroredColorOnlyLayers(
    folder: string,
    optionId: string,
    leftColor: AvatarTintSource,
    rightColor: AvatarTintSource | undefined,
    distance: number,
    y: number,
    zIndex: number,
    angle = 0,
  ): MiniLayer[] {
    return this.layerBuilder.createMirroredColorOnlyLayers(folder, optionId, leftColor, rightColor, distance, y, zIndex, angle);
  }

  protected createMirroredLineOnlyLayers(
    folder: string,
    optionId: string,
    color: AvatarTintSource,
    distance: number,
    y: number,
    zIndex: number,
    angle = 0,
    centerOffsetX = 0,
  ): MiniLayer[] {
    return this.layerBuilder.createMirroredLineOnlyLayers(folder, optionId, color, distance, y, zIndex, angle, centerOffsetX);
  }

  protected createMirroredSingleFileLayers(
    folder: string,
    file: string,
    leftColor: AvatarTintSource,
    rightColor: AvatarTintSource | undefined,
    distance: number,
    y: number,
    zIndex: number,
    angle = 0,
  ): MiniLayer[] {
    return this.layerBuilder.createMirroredSingleFileLayers(folder, file, leftColor, rightColor, distance, y, zIndex, angle);
  }

  protected createAccessoryImageLayers(
    folder: string,
    optionId: string,
    colorFile: string,
    color: AvatarTintSource,
    lineColor: AvatarTintSource,
    zIndex: number,
    colorGradientSpace?: AvatarGradientCoordinateSpace,
  ): MiniLocalLayer[] {
    return this.layerBuilder.createAccessoryImageLayers(folder, optionId, colorFile, color, lineColor, zIndex, colorGradientSpace);
  }
}
