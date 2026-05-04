import type { DrawingTool } from '../../widgets/fabricDrawingBoard';
import styles from './drawingBoard.module.scss';

interface DrawingBoardToolPanelProps {
  tool: DrawingTool;
  color: string;
  pencilWidth: number;
  eraserWidth: number;
  canUndo: boolean;
  canRedo: boolean;
  canUseEyeDropper: boolean;
  onToolChange: (tool: DrawingTool) => void;
  onColorChange: (color: string) => void;
  onPencilWidthChange: (width: number) => void;
  onEraserWidthChange: (width: number) => void;
  onPickColor: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onOpenImport: () => void;
  onClose?: () => void;
}

const tools: Array<{ value: DrawingTool; label: string }> = [
  { value: 'pencil', label: '鉛筆' },
  { value: 'eraser', label: '橡皮擦' },
  { value: 'fill', label: '填色' },
  { value: 'line', label: '直線' },
  { value: 'circle', label: '圓圈' },
];

export function DrawingBoardToolPanel({
  tool,
  color,
  pencilWidth,
  eraserWidth,
  canUndo,
  canRedo,
  canUseEyeDropper,
  onToolChange,
  onColorChange,
  onPencilWidthChange,
  onEraserWidthChange,
  onPickColor,
  onUndo,
  onRedo,
  onExport,
  onOpenImport,
  onClose,
}: DrawingBoardToolPanelProps) {
  return (
    <aside className={styles.panel}>
      <div className={styles.panelHeader}>
        <span>畫板工具</span>
        {onClose && (
          <button className={styles.iconButton} type="button" onClick={onClose} aria-label="關閉畫板">
            X
          </button>
        )}
      </div>

      <div className={styles.toolGroup} role="radiogroup" aria-label="繪圖工具">
        {tools.map(item => (
          <button
            className={item.value === tool ? styles.activeToolButton : styles.toolButton}
            type="button"
            key={item.value}
            onClick={() => onToolChange(item.value)}
            role="radio"
            aria-checked={item.value === tool}
          >
            {item.label}
          </button>
        ))}
      </div>

      <label className={styles.field}>
        <span>鉛筆粗細 {pencilWidth}px</span>
        <input
          type="range"
          min="1"
          max="30"
          value={pencilWidth}
          onChange={event => onPencilWidthChange(Number(event.target.value))}
        />
      </label>

      <label className={styles.field}>
        <span>橡皮擦粗細 {eraserWidth}px</span>
        <input
          type="range"
          min="1"
          max="30"
          value={eraserWidth}
          onChange={event => onEraserWidthChange(Number(event.target.value))}
        />
      </label>

      <div className={styles.colorRow}>
        <label className={styles.colorField}>
          <span>顏色</span>
          <input type="color" value={color} onChange={event => onColorChange(event.target.value)} />
        </label>
        <button
          className={styles.secondaryButton}
          type="button"
          onClick={onPickColor}
          disabled={!canUseEyeDropper}
          title={canUseEyeDropper ? '使用滴管吸取螢幕顏色' : '目前瀏覽器不支援滴管'}
        >
          滴管
        </button>
      </div>

      <div className={styles.historyRow}>
        <button className={styles.secondaryButton} type="button" onClick={onUndo} disabled={!canUndo}>
          復原
        </button>
        <button className={styles.secondaryButton} type="button" onClick={onRedo} disabled={!canRedo}>
          重複
        </button>
      </div>

      <div className={styles.historyRow}>
        <button className={styles.secondaryButton} type="button" onClick={onExport}>
          匯出
        </button>
        <button className={styles.secondaryButton} type="button" onClick={onOpenImport}>
          匯入
        </button>
      </div>
    </aside>
  );
}
