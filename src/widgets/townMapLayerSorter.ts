import type { Canvas, FabricObject } from 'fabric';
import { DEFAULT_ENTITY_LAYER_RANK } from '../constants/townMapWidgetConstants';

// Fabric layer sorting metadata
export function sortEntityLayer(canvas: Canvas): void {
  const sortedObjects = [...canvas.getObjects()].sort((first, second) => {
    const firstBottomY = getNumericFabricValue(first, 'sortBottomY');
    const secondBottomY = getNumericFabricValue(second, 'sortBottomY');

    if (firstBottomY !== secondBottomY) {
      return firstBottomY - secondBottomY;
    }

    return getNumericFabricValue(first, 'entityLayerRank') - getNumericFabricValue(second, 'entityLayerRank');
  });

  sortedObjects.forEach((object, index) => {
    canvas.moveObjectTo(object, index);
  });
}

export function updateEntitySortMetadata(object: FabricObject, bottomY: number): void {
  object.set('sortBottomY', bottomY);
  object.set('entityLayerRank', object.get('entityLayerRank') ?? DEFAULT_ENTITY_LAYER_RANK);
}

function getNumericFabricValue(object: FabricObject, key: string): number {
  const value = object.get(key);
  return typeof value === 'number' ? value : 0;
}
