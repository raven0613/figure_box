import type {
  MiniLayer,
  MiniLocalLayer,
  MiniRigNode,
  MiniTransform,
} from './miniAvatarTypes';

interface ResolvedMiniTransform {
  x: number;
  y: number;
  angle: number;
  scale: number;
  flipX: boolean;
  zIndexOffset: number;
}

const IDENTITY_TRANSFORM: ResolvedMiniTransform = {
  x: 0,
  y: 0,
  angle: 0,
  scale: 1,
  flipX: false,
  zIndexOffset: 0,
};

export function flattenMiniRigNode(node: MiniRigNode): MiniLayer[] {
  return flattenNode(node, IDENTITY_TRANSFORM);
}

function flattenNode(node: MiniRigNode, parentTransform: ResolvedMiniTransform): MiniLayer[] {
  const transform = composeMiniTransform(parentTransform, node.transform);

  if (node.precompose === true) {
    return createPrecomposedMiniLayer(node, transform);
  }

  const layers = (node.layers ?? []).map(layer => transformMiniLayer(layer, transform));
  const childLayers = (node.children ?? []).flatMap(child => flattenNode(child, transform));

  return [...layers, ...childLayers];
}

function createPrecomposedMiniLayer(node: MiniRigNode, transform: ResolvedMiniTransform): MiniLayer[] {
  const compositeLayers = flattenNodeContent(node)
    .map(layer => ({
      ...layer,
      colorAnchor: layer.colorGradientSpace === 'sharedHair' && layer.colorAnchor === undefined
        ? {
          x: transform.x + layer.x,
          y: transform.y + layer.y,
        }
        : layer.colorAnchor,
    }));

  if (compositeLayers.length === 0) {
    return [];
  }

  return [{
    folder: '__mini_composite__',
    file: 'node.png',
    compositeLayers,
    x: transform.x,
    y: transform.y,
    zIndex: (node.precomposeZIndex ?? getLowestMiniLayerZIndex(compositeLayers)) + transform.zIndexOffset,
    angle: transform.angle,
    scale: transform.scale,
    flipX: transform.flipX,
  }];
}

function flattenNodeContent(node: MiniRigNode): MiniLayer[] {
  const layers = (node.layers ?? []).map(layer => transformMiniLayer(layer, IDENTITY_TRANSFORM));
  const childLayers = (node.children ?? []).flatMap(child => flattenNode(child, IDENTITY_TRANSFORM));

  return [...layers, ...childLayers];
}

function getLowestMiniLayerZIndex(layers: MiniLayer[]): number {
  return layers.reduce(
    (lowestZIndex, layer) => Math.min(lowestZIndex, layer.zIndex),
    layers[0]?.zIndex ?? 0,
  );
}

function composeMiniTransform(
  parentTransform: ResolvedMiniTransform,
  localTransform: MiniTransform = {},
): ResolvedMiniTransform {
  const localPoint = applyParentFlip(
    {
      x: localTransform.x ?? 0,
      y: localTransform.y ?? 0,
    },
    parentTransform.flipX,
  );
  const rotatedPoint = rotateMiniPoint(localPoint, parentTransform.angle);
  const localFlip = localTransform.flipX === true;

  return {
    x: parentTransform.x + rotatedPoint.x * parentTransform.scale,
    y: parentTransform.y + rotatedPoint.y * parentTransform.scale,
    angle: parentTransform.angle + (localTransform.angle ?? 0) * (parentTransform.flipX ? -1 : 1),
    scale: parentTransform.scale * (localTransform.scale ?? 1),
    flipX: parentTransform.flipX !== localFlip,
    zIndexOffset: parentTransform.zIndexOffset + (localTransform.zIndexOffset ?? 0),
  };
}

function transformMiniLayer(layer: MiniLocalLayer, transform: ResolvedMiniTransform): MiniLayer {
  const localPoint = applyParentFlip(
    {
      x: layer.x ?? 0,
      y: layer.y ?? 0,
    },
    transform.flipX,
  );
  const rotatedPoint = rotateMiniPoint(localPoint, transform.angle);
  const layerScale = layer.scale ?? 1;
  const layerFlip = layer.flipX === true;

  return {
    ...layer,
    x: transform.x + rotatedPoint.x * transform.scale,
    y: transform.y + rotatedPoint.y * transform.scale,
    colorAnchor: layer.colorGradientSpace === 'sharedHair' && layer.colorAnchor === undefined
      ? {
        x: transform.x + rotatedPoint.x * transform.scale,
        y: transform.y + rotatedPoint.y * transform.scale,
      }
      : layer.colorAnchor,
    zIndex: layer.zIndex + transform.zIndexOffset,
    angle: transform.angle + (layer.angle ?? 0) * (transform.flipX ? -1 : 1),
    scale: transform.scale * layerScale,
    flipX: transform.flipX !== layerFlip,
  };
}

function applyParentFlip(point: { x: number; y: number }, isFlipped: boolean): { x: number; y: number } {
  return {
    x: isFlipped ? -point.x : point.x,
    y: point.y,
  };
}

function rotateMiniPoint(point: { x: number; y: number }, angle: number): { x: number; y: number } {
  if (angle === 0) {
    return point;
  }

  const radians = angle * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}
