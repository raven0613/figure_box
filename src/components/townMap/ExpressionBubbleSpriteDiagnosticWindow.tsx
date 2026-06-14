import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { DraggablePanel } from '~/components/common/DraggablePanel';
import { ExpressionBubbleCanvas } from '~/widgets/expressionBubbleCanvas';
import { bakeCachedExpressionBubbleSpriteSheet } from '~/widgets/expressionBubble/expressionBubbleSpriteBakeCache';
import type {
  ExpressionBubbleAnimation,
  ExpressionBubbleSpriteSheet,
} from '~/widgets/expressionBubble/expressionBubbleTypes';
import {
  createExpressionBubbleSpriteFrameStyle,
  EXPRESSION_BUBBLE_PREVIEW_TICK_MS,
  getExpressionBubblePreviewFrameIndex,
} from './expressionBubbleSpritePreviewUtils';
import styles from './expressionBubbleSpriteDiagnosticWindow.module.scss';

interface ExpressionBubbleSpriteDiagnosticWindowProps {
  animation: ExpressionBubbleAnimation;
  onClose: () => void;
}

const RAW_CANVAS_SCALE = 2;

export function ExpressionBubbleSpriteDiagnosticWindow({
  animation,
  onClose,
}: ExpressionBubbleSpriteDiagnosticWindowProps) {
  const animationStartedAtRef = useRef(performance.now());
  const [nowMs, setNowMs] = useState(() => performance.now());
  const [spriteSheet, setSpriteSheet] = useState<ExpressionBubbleSpriteSheet | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    setSpriteSheet(null);
    setError(null);
    void bakeCachedExpressionBubbleSpriteSheet(animation)
      .then(nextSpriteSheet => {
        if (!isCancelled) {
          setSpriteSheet(nextSpriteSheet);
        }
      })
      .catch(nextError => {
        if (!isCancelled) {
          setError(nextError instanceof Error ? nextError.message : 'Bake failed');
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [animation]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(performance.now());
    }, EXPRESSION_BUBBLE_PREVIEW_TICK_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  const frameIndex = spriteSheet
    ? getExpressionBubblePreviewFrameIndex(
      animation,
      spriteSheet,
      nowMs,
      animationStartedAtRef.current,
    )
    : 0;

  return (
    <DraggablePanel
      title={`${animation.label} / ${animation.id}`}
      initialPosition={{ left: 250, top: 70 }}
      closeAriaLabel="關閉表情泡泡診斷"
      className={styles.panel}
      contentClassName={styles.content}
      onClose={onClose}
    >
      <div className={styles.stageGrid}>
        <section className={styles.stage}>
          <h3>原始動畫</h3>
          <div className={styles.rawViewport}>
            <RawExpressionBubbleAnimation animation={animation} />
          </div>
        </section>
      </div>

      <section className={styles.stage}>
        <h3>烘焙精靈圖</h3>
        {spriteSheet ? (
          <>
            <div className={styles.cropPreview}>
              <div
                className={styles.spriteFrame}
                style={createExpressionBubbleSpriteFrameStyle(spriteSheet, frameIndex)}
              />
            </div>
            <div className={styles.sheetViewport}>
              <img
                alt={`${animation.label} spritesheet`}
                className={styles.sheetImage}
                src={spriteSheet.dataUrl}
                style={createSpriteSheetImageStyle(spriteSheet)}
              />
            </div>
            <div className={styles.meta}>
              {`${spriteSheet.sheetWidth}x${spriteSheet.sheetHeight} / ${spriteSheet.frameWidth}x${spriteSheet.frameHeight}`}
            </div>
          </>
        ) : (
          <div className={styles.placeholder}>{error ?? 'baking'}</div>
        )}
      </section>
    </DraggablePanel>
  );
}

function RawExpressionBubbleAnimation({ animation }: { animation: ExpressionBubbleAnimation }) {
  const canvasElementRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvasElement = canvasElementRef.current;

    if (!canvasElement) {
      return undefined;
    }

    const canvas = new ExpressionBubbleCanvas(canvasElement, {
      animation,
      isAnimationEnabled: true,
    });

    return () => {
      void canvas.destroy();
    };
  }, [animation]);

  return (
    <div className={styles.rawCanvasHost}>
      <canvas ref={canvasElementRef} />
    </div>
  );
}

function createSpriteSheetImageStyle(spriteSheet: ExpressionBubbleSpriteSheet): CSSProperties {
  return {
    width: spriteSheet.sheetWidth * RAW_CANVAS_SCALE,
    height: spriteSheet.sheetHeight * RAW_CANVAS_SCALE,
  };
}
