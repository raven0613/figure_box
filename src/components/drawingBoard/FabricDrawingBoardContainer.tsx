import { useEffect, useRef, useState } from 'react';

import styles from './drawingBoard.module.scss';
import { DrawingBoardActionData, DrawingTool, FabricDrawingBoard } from '../../widgets/fabricDrawingBoard';
import { DrawingBoardToolPanel } from './DrawingBoardToolPanel';

interface EyeDropperResult {
  sRGBHex: string;
}

interface EyeDropperConstructor {
  new(): {
    open: () => Promise<EyeDropperResult>;
  };
}

declare global {
  interface Window {
    EyeDropper?: EyeDropperConstructor;
  }
}

export interface FabricDrawingBoardContainerProps {
  isOpen?: boolean;
  initialData?: DrawingBoardActionData[];
  onDataChange?: (data: DrawingBoardActionData[]) => void;
  onClose?: () => void;
}

export function FabricDrawingBoardContainer({
  isOpen = true,
  initialData,
  onDataChange,
  onClose,
}: FabricDrawingBoardContainerProps) {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const boardRef = useRef<FabricDrawingBoard | null>(null);
  const onDataChangeRef = useRef(onDataChange);
  const initialDataRef = useRef(initialData);
  const [tool, setTool] = useState<DrawingTool>('pencil');
  const [color, setColor] = useState('#000000');
  const [pencilWidth, setPencilWidth] = useState(1);
  const [eraserWidth, setEraserWidth] = useState(5);
  const [history, setHistory] = useState({ canUndo: false, canRedo: false });
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');

  useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  useEffect(() => {
    initialDataRef.current = initialData;
  }, [initialData]);

  useEffect(() => {
    if (!isOpen || !canvasHostRef.current) {
      return;
    }

    const canvasHost = canvasHostRef.current;
    const board = FabricDrawingBoard.mount(canvasHostRef.current, {
      initialData: initialDataRef.current,
      brush: { color: '#000000', width: 1 },
      eraserWidth: 5,
      onChange: data => onDataChangeRef.current?.(data),
      onHistoryChange: setHistory,
    });

    boardRef.current = board;

    return () => {
      boardRef.current = null;
      void board.destroy();
      canvasHost.replaceChildren();
    };
  }, [isOpen]);

  useEffect(() => {
    boardRef.current?.setTool(tool);
  }, [tool]);

  useEffect(() => {
    boardRef.current?.setBrushColor(color);
  }, [color]);

  useEffect(() => {
    boardRef.current?.setBrushWidth(pencilWidth);
  }, [pencilWidth]);

  useEffect(() => {
    boardRef.current?.setEraserWidth(eraserWidth);
  }, [eraserWidth]);

  if (!isOpen) {
    return null;
  }

  const pickColor = async () => {
    if (!window.EyeDropper) {
      return;
    }

    const eyeDropper = new window.EyeDropper();
    try {
      const result = await eyeDropper.open();
      setColor(result.sRGBHex);
    } catch {
      return;
    }
  };

  const exportPathData = () => {
    console.log(JSON.stringify(boardRef.current?.getExportPathData() ?? []));
  };

  const confirmImport = async () => {
    try {
      const parsedData = JSON.parse(importText) as unknown;
      const pathData = Array.isArray(parsedData)
        ? parsedData
        : typeof parsedData === 'object' && parsedData !== null && 'pathData' in parsedData
          ? (parsedData as { pathData: unknown }).pathData
          : null;

      if (!Array.isArray(pathData)) {
        setImportError('匯入資料必須是 path data 陣列');
        return;
      }

      await boardRef.current?.loadPathData(pathData as DrawingBoardActionData[]);
      setImportText('');
      setImportError('');
      setIsImportOpen(false);
    } catch {
      setImportError('JSON 格式不正確');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.canvasShell}>
        <div className={styles.canvasHost} ref={canvasHostRef} />
      </div>

      <DrawingBoardToolPanel
        tool={tool}
        color={color}
        pencilWidth={pencilWidth}
        eraserWidth={eraserWidth}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        canUseEyeDropper={Boolean(window.EyeDropper)}
        onToolChange={setTool}
        onColorChange={setColor}
        onPencilWidthChange={setPencilWidth}
        onEraserWidthChange={setEraserWidth}
        onPickColor={pickColor}
        onUndo={() => boardRef.current?.undo()}
        onRedo={() => boardRef.current?.redo()}
        onExport={exportPathData}
        onOpenImport={() => {
          setImportText('');
          setImportError('');
          setIsImportOpen(true);
        }}
        onClose={onClose}
      />

      {isImportOpen && (
        <div className={styles.importDialog} role="dialog" aria-modal="true" aria-label="匯入 path data">
          <div className={styles.importHeader}>匯入 path data</div>
          <textarea
            className={styles.importTextarea}
            value={importText}
            onChange={event => setImportText(event.target.value)}
          />
          {importError && <div className={styles.importError}>{importError}</div>}
          <div className={styles.importActions}>
            <button className={styles.secondaryButton} type="button" onClick={() => setIsImportOpen(false)}>
              取消
            </button>
            <button className={styles.activeToolButton} type="button" onClick={confirmImport}>
              確認
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
