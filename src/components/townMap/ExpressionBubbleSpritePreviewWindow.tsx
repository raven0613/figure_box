import {
  useEffect,
  useRef,
  useState,
} from 'react';
import { DraggablePanel } from '~/components/common/DraggablePanel';
import {
  EXPRESSION_BUBBLE_ANIMATION_DEFINITIONS,
} from '~/widgets/expressionBubble/expressionBubbleAnimationDefinitions';
import { bakeCachedExpressionBubbleSpriteSheet } from '~/widgets/expressionBubble/expressionBubbleSpriteBakeCache';
import type {
  ExpressionBubbleAnimation,
  ExpressionBubbleSpriteSheet,
} from '~/widgets/expressionBubble/expressionBubbleTypes';
import { ExpressionBubbleSpriteDiagnosticWindow } from './ExpressionBubbleSpriteDiagnosticWindow';
import {
  createExpressionBubbleSpriteFrameStyle,
  EXPRESSION_BUBBLE_PREVIEW_TICK_MS,
  getExpressionBubblePreviewFrameIndex,
} from './expressionBubbleSpritePreviewUtils';
import styles from './expressionBubbleSpritePreviewWindow.module.scss';

interface ExpressionBubbleSpritePreviewWindowProps {
  onClose: () => void;
}

interface PreviewEntry {
  animation: ExpressionBubbleAnimation;
  spriteSheet: ExpressionBubbleSpriteSheet | null;
  error: string | null;
}

export function ExpressionBubbleSpritePreviewWindow({
  onClose,
}: ExpressionBubbleSpritePreviewWindowProps) {
  const animationStartedAtRef = useRef(performance.now());
  const [nowMs, setNowMs] = useState(() => performance.now());
  const [entries, setEntries] = useState<PreviewEntry[]>(() => createInitialPreviewEntries());
  const [selectedAnimation, setSelectedAnimation] = useState<ExpressionBubbleAnimation | null>(null);

  useEffect(() => {
    let isCancelled = false;

    setEntries(createInitialPreviewEntries());
    EXPRESSION_BUBBLE_ANIMATION_DEFINITIONS.forEach(animation => {
      void bakeCachedExpressionBubbleSpriteSheet(animation)
        .then(spriteSheet => {
          if (isCancelled) {
            return;
          }

          setEntries(currentEntries => updatePreviewEntry(
            currentEntries,
            animation.id,
            { spriteSheet, error: null },
          ));
        })
        .catch(error => {
          if (isCancelled) {
            return;
          }

          setEntries(currentEntries => updatePreviewEntry(
            currentEntries,
            animation.id,
            {
              spriteSheet: null,
              error: error instanceof Error ? error.message : 'Bake failed',
            },
          ));
        });
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(performance.now());
    }, EXPRESSION_BUBBLE_PREVIEW_TICK_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <>
      <DraggablePanel
        title="表情泡泡精靈圖"
        initialPosition={{ left: 426, top: 92 }}
        closeAriaLabel="關閉表情泡泡精靈圖預覽"
        className={styles.panel}
        contentClassName={styles.content}
        onClose={onClose}
      >
        <div className={styles.grid}>
          {entries.map(entry => (
            <PreviewCard
              key={entry.animation.id}
              entry={entry}
              nowMs={nowMs}
              animationStartedAt={animationStartedAtRef.current}
              onSelect={() => setSelectedAnimation(entry.animation)}
            />
          ))}
        </div>
      </DraggablePanel>
      {selectedAnimation ? (
        <ExpressionBubbleSpriteDiagnosticWindow
          animation={selectedAnimation}
          onClose={() => setSelectedAnimation(null)}
        />
      ) : null}
    </>
  );
}

function PreviewCard({
  entry,
  nowMs,
  animationStartedAt,
  onSelect,
}: {
  entry: PreviewEntry;
  nowMs: number;
  animationStartedAt: number;
  onSelect: () => void;
}) {
  const frameIndex = entry.spriteSheet
    ? getExpressionBubblePreviewFrameIndex(entry.animation, entry.spriteSheet, nowMs, animationStartedAt)
    : 0;
  const frameStyle = entry.spriteSheet
    ? createExpressionBubbleSpriteFrameStyle(entry.spriteSheet, frameIndex)
    : undefined;

  return (
    <button
      className={styles.card}
      type="button"
      onClick={onSelect}
    >
      <div className={styles.viewport}>
        {frameStyle ? (
          <div className={styles.spriteFrame} style={frameStyle} />
        ) : (
          <div className={styles.placeholder}>
            {entry.error ?? 'baking'}
          </div>
        )}
      </div>
      <div className={styles.cardFooter}>
        <strong>{entry.animation.label}</strong>
        <span>{entry.animation.id}</span>
      </div>
      <div className={styles.meta}>
        {entry.spriteSheet
          ? `${frameIndex + 1} / ${entry.spriteSheet.frameCount}`
          : '-'}
      </div>
    </button>
  );
}

function createInitialPreviewEntries(): PreviewEntry[] {
  return EXPRESSION_BUBBLE_ANIMATION_DEFINITIONS.map(animation => ({
    animation,
    spriteSheet: null,
    error: null,
  }));
}

function updatePreviewEntry(
  entries: PreviewEntry[],
  animationId: string,
  patch: Pick<PreviewEntry, 'spriteSheet' | 'error'>,
): PreviewEntry[] {
  return entries.map(entry => (
    entry.animation.id === animationId
      ? { ...entry, ...patch }
      : entry
  ));
}
