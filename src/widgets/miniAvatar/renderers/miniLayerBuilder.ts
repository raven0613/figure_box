import type { AvatarGradientCoordinateSpace, AvatarTintSource } from '../../avatar/avatarTypes';
import { hasMiniAvatarAsset } from '../miniAvatarAssets';
import { getMiniAvatarAnchorOffset } from '../miniAvatarAnchors';
import { MINI_CLOTHING_LINE_Z_OFFSET } from '../miniAvatarRig';
import type {
  MiniLayer,
  MiniLocalLayer,
  MiniPoint,
  MiniRigNode,
  MiniTransform,
} from '../miniAvatarTypes';
import {
  cloneMiniLocalLayers,
  createMiniNodeTransform,
  mirrorMiniPointX,
  subtractMiniPoints,
  type MiniMirroredSocketPoints,
} from './miniRendererUtils';

export class MiniLayerBuilder {
  createColorAndLineLayers(
    folder: string,
    optionId: string,
    color: AvatarTintSource,
    lineColor: AvatarTintSource,
    x: number,
    y: number,
    zIndex: number,
    colorGradientSpace?: AvatarGradientCoordinateSpace,
  ): MiniLayer[] {
    return [
      { folder, file: `${optionId}_color.png`, color, colorGradientSpace, x, y, zIndex },
      { folder, file: `${optionId}_line.png`, color: lineColor, x, y, zIndex: zIndex + 0.1 },
    ].filter(layer => hasMiniAvatarAsset(layer.folder, layer.file));
  }

  createColorOnlyLayers(
    folder: string,
    optionId: string,
    color: AvatarTintSource,
    x: number,
    y: number,
    zIndex: number,
  ): MiniLayer[] {
    const file = `${optionId}_color.png`;
    return hasMiniAvatarAsset(folder, file)
      ? [{ folder, file, color, x, y, zIndex }]
      : [];
  }

  createLineOnlyLayers(
    folder: string,
    optionId: string,
    color: AvatarTintSource,
    x: number,
    y: number,
    zIndex: number,
  ): MiniLayer[] {
    const file = `${optionId}_line.png`;
    return hasMiniAvatarAsset(folder, file)
      ? [{ folder, file, color, x, y, zIndex }]
      : [];
  }

  createNamedColorAndLineLayers(
    folder: string,
    colorFile: string,
    lineFile: string,
    color: AvatarTintSource | undefined,
    lineColor: AvatarTintSource | undefined,
    x: number,
    y: number,
    zIndex: number,
  ): MiniLayer[] {
    return [
      { folder, file: colorFile, color, x, y, zIndex },
      { folder, file: lineFile, color: lineColor, x, y, zIndex: zIndex + MINI_CLOTHING_LINE_Z_OFFSET },
    ].filter(layer => hasMiniAvatarAsset(layer.folder, layer.file));
  }

  createNamedSingleFileLayers(
    folder: string,
    file: string,
    color: AvatarTintSource | undefined,
    x: number,
    y: number,
    zIndex: number,
  ): MiniLayer[] {
    return hasMiniAvatarAsset(folder, file)
      ? [{ folder, file, color, x, y, zIndex }]
      : [];
  }

  createNamedColorAndLineLocalLayers(
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
    return [
      { folder, file: colorFile, color, x, y, zIndex, flipX },
      { folder, file: lineFile, color: lineColor, x, y, zIndex: zIndex + MINI_CLOTHING_LINE_Z_OFFSET, flipX },
    ].filter(layer => hasMiniAvatarAsset(layer.folder, layer.file));
  }

  createColorAndLineLocalLayers(
    folder: string,
    optionId: string,
    color: AvatarTintSource,
    lineColor: AvatarTintSource,
    zIndex: number,
    flipX = false,
    anchorOffset: MiniPoint = { x: 0, y: 0 },
    colorGradientSpace?: AvatarGradientCoordinateSpace,
  ): MiniLocalLayer[] {
    return [
      { folder, file: `${optionId}_color.png`, color, colorGradientSpace, x: anchorOffset.x, y: anchorOffset.y, zIndex, flipX },
      { folder, file: `${optionId}_line.png`, color: lineColor, x: anchorOffset.x, y: anchorOffset.y, zIndex: zIndex + 0.1, flipX },
    ].filter(layer => hasMiniAvatarAsset(layer.folder, layer.file));
  }

  createMirroredColorAndLineLayers(
    folder: string,
    optionId: string,
    color: AvatarTintSource,
    lineColor: AvatarTintSource,
    distance: number,
    y: number,
    zIndex: number,
    angle = 0,
  ): MiniLayer[] {
    return [
      ...this.createMirroredColorOnlyLayers(folder, optionId, color, color, distance, y, zIndex, angle),
      ...this.createMirroredLineOnlyLayers(folder, optionId, lineColor, distance, y, zIndex + 0.1, angle),
    ];
  }

  createMirroredColorAndLineNodes(
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
    const rightAnchorOffset = anchorOffset ?? getMiniAvatarAnchorOffset(folder, optionId);
    const leftAnchorOffset = mirrorMiniPointX(rightAnchorOffset);
    const leftSocketPoint = shouldPreserveVisualPoint
      ? subtractMiniPoints(socketPoints.left, leftAnchorOffset)
      : socketPoints.left;
    const rightSocketPoint = shouldPreserveVisualPoint
      ? subtractMiniPoints(socketPoints.right, rightAnchorOffset)
      : socketPoints.right;

    return [
      {
        transform: createMiniNodeTransform(leftSocketPoint, leftTransform),
        layers: [
          ...this.createColorAndLineLocalLayers(folder, optionId, color, lineColor, zIndex, true, leftAnchorOffset),
          ...cloneMiniLocalLayers(extraLayers, true, leftAnchorOffset),
        ],
      },
      {
        transform: createMiniNodeTransform(rightSocketPoint, rightTransform),
        layers: [
          ...this.createColorAndLineLocalLayers(folder, optionId, color, lineColor, zIndex, false, rightAnchorOffset),
          ...cloneMiniLocalLayers(extraLayers, false, rightAnchorOffset),
        ],
      },
    ];
  }

  createMirroredColorOnlyLayers(
    folder: string,
    optionId: string,
    leftColor: AvatarTintSource,
    rightColor: AvatarTintSource | undefined,
    distance: number,
    y: number,
    zIndex: number,
    angle = 0,
  ): MiniLayer[] {
    const file = `${optionId}_color.png`;

    if (!hasMiniAvatarAsset(folder, file)) {
      return [];
    }

    return createMirroredMiniLayers(folder, file, leftColor, rightColor ?? leftColor, distance, y, zIndex, angle);
  }

  createMirroredLineOnlyLayers(
    folder: string,
    optionId: string,
    color: AvatarTintSource,
    distance: number,
    y: number,
    zIndex: number,
    angle = 0,
    centerOffsetX = 0,
  ): MiniLayer[] {
    const file = `${optionId}_line.png`;

    if (!hasMiniAvatarAsset(folder, file)) {
      return [];
    }

    return createMirroredMiniLayers(folder, file, color, color, distance, y, zIndex, angle, centerOffsetX);
  }

  createMirroredSingleFileLayers(
    folder: string,
    file: string,
    leftColor: AvatarTintSource,
    rightColor: AvatarTintSource | undefined,
    distance: number,
    y: number,
    zIndex: number,
    angle = 0,
  ): MiniLayer[] {
    if (!hasMiniAvatarAsset(folder, file)) {
      return [];
    }

    return createMirroredMiniLayers(folder, file, leftColor, rightColor ?? leftColor, distance, y, zIndex, angle);
  }

  createAccessoryImageLayers(
    folder: string,
    optionId: string,
    colorFile: string,
    color: AvatarTintSource,
    lineColor: AvatarTintSource,
    zIndex: number,
    colorGradientSpace?: AvatarGradientCoordinateSpace,
  ): MiniLocalLayer[] {
    return [
      { folder, file: colorFile, color, colorGradientSpace, zIndex },
      { folder, file: `${optionId}_line.png`, color: lineColor, zIndex: zIndex + 0.1 },
    ].filter(layer => hasMiniAvatarAsset(layer.folder, layer.file));
  }
}

function createMirroredMiniLayers(
  folder: string,
  file: string,
  leftColor: AvatarTintSource | undefined,
  rightColor: AvatarTintSource | undefined,
  distance: number,
  y: number,
  zIndex: number,
  angle = 0,
  centerOffsetX = 0,
): MiniLayer[] {
  return [
    {
      folder,
      file,
      color: leftColor,
      x: centerOffsetX - distance,
      y,
      zIndex,
      angle: -angle,
      flipX: true,
    },
    {
      folder,
      file,
      color: rightColor,
      x: centerOffsetX + distance,
      y,
      zIndex,
      angle,
    },
  ];
}
