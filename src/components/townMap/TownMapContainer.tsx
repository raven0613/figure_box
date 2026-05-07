import { useEffect, useRef, useState } from 'react';
import { FabricTownMapWidget } from '~/widgets/fabricTownMapWidget';
import type { TownMapTile } from '~/widgets/townMapGrid';

import styles from './townMap.module.scss';

export function TownMapContainer() {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<FabricTownMapWidget | null>(null);
  const [selectedTile, setSelectedTile] = useState<TownMapTile | null>(null);
  const [nearbyTiles, setNearbyTiles] = useState<TownMapTile[]>([]);

  useEffect(() => {
    if (!canvasHostRef.current) {
      return;
    }

    const canvasHost = canvasHostRef.current;
    const widget = FabricTownMapWidget.mount(canvasHost, {
      cellSize: 48,
      onTileClick: tile => {
        setSelectedTile(tile);
        setNearbyTiles(widget.getNeighbors(tile.x, tile.y, 1));
      },
    });

    widgetRef.current = widget;

    // Public movement interface example for game logic:
    // widget.placeCharacter({ id: 'player-01', x: 4, y: 5, color: '#f7d65a', label: 'P' });
    // widget.moveCharacter('player-01', { x: 5, y: 5 });
    widget.placeCharacter({ id: 'player-01', x: 4, y: 5, color: '#f7d65a', label: 'P' });

    return () => {
      widgetRef.current = null;
      void widget.destroy();
      canvasHost.replaceChildren();
    };
  }, []);

  return (
    <section className={styles.container}>
      <div className={styles.mapShell}>
        <div className={styles.canvasHost} ref={canvasHostRef} />
      </div>

      <aside className={styles.panel}>
        <div className={styles.panelTitle}>Town Grid</div>
        <div className={styles.detailRow}>
          <span>Selected</span>
          <strong>{selectedTile ? `${selectedTile.x}, ${selectedTile.y}` : '-'}</strong>
        </div>
        <div className={styles.detailRow}>
          <span>Terrain</span>
          <strong>{selectedTile?.cell.terrain ?? '-'}</strong>
        </div>
        <div className={styles.detailRow}>
          <span>Walkable</span>
          <strong>{selectedTile ? String(selectedTile.cell.walkable) : '-'}</strong>
        </div>
        <div className={styles.detailRow}>
          <span>Occupant</span>
          <strong>{selectedTile?.cell.occupantId ?? '-'}</strong>
        </div>
        <div className={styles.detailRow}>
          <span>Object</span>
          <strong>{selectedTile?.cell.interactableObject?.label ?? '-'}</strong>
        </div>
        <div className={styles.neighborList}>
          {nearbyTiles.map(tile => (
            <span key={tile.index}>
              {tile.x},{tile.y}
            </span>
          ))}
        </div>
      </aside>
    </section>
  );
}
