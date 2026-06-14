import {
  EXPRESSION_BUBBLE_ANIMATION_DEFINITIONS,
} from '~/widgets/expressionBubble/expressionBubbleAnimationDefinitions';
import { bakeCachedExpressionBubbleSpriteSheet } from '~/widgets/expressionBubble/expressionBubbleSpriteBakeCache';
import type { ExpressionBubbleAnimation } from '~/widgets/expressionBubble/expressionBubbleTypes';

export interface ExpressionBubbleSpritePreloadProgress {
  completed: number;
  total: number;
  currentLabel: string;
}

export interface ExpressionBubbleSpritePreloadResult {
  completed: number;
  total: number;
  failed: number;
}

export interface ExpressionBubbleSpritePreloadOptions {
  animations?: readonly ExpressionBubbleAnimation[];
  concurrency?: number;
  onProgress?: (progress: ExpressionBubbleSpritePreloadProgress) => void;
}

const DEFAULT_EXPRESSION_BUBBLE_PRELOAD_CONCURRENCY = 1;

export function getExpressionBubbleSpritePreloadTotal(
  animations: readonly ExpressionBubbleAnimation[] = EXPRESSION_BUBBLE_ANIMATION_DEFINITIONS,
): number {
  return animations.length;
}

export async function preloadExpressionBubbleSpriteSheets(
  options: ExpressionBubbleSpritePreloadOptions = {},
): Promise<ExpressionBubbleSpritePreloadResult> {
  const animations = options.animations ?? EXPRESSION_BUBBLE_ANIMATION_DEFINITIONS;
  const total = getExpressionBubbleSpritePreloadTotal(animations);
  const concurrency = Math.max(
    1,
    Math.floor(options.concurrency ?? DEFAULT_EXPRESSION_BUBBLE_PRELOAD_CONCURRENCY),
  );
  let completed = 0;
  let failed = 0;
  let nextAnimationIndex = 0;

  options.onProgress?.({
    completed,
    total,
    currentLabel: total > 0 ? 'Preparing expression bubbles' : 'Expression bubbles ready',
  });

  async function runNextJob(): Promise<void> {
    const animation = animations[nextAnimationIndex];
    nextAnimationIndex += 1;

    if (!animation) {
      return;
    }

    options.onProgress?.({
      completed,
      total,
      currentLabel: `Expression bubble / ${animation.label}`,
    });

    try {
      await bakeCachedExpressionBubbleSpriteSheet(animation);
    } catch (error) {
      failed += 1;
      console.error('Failed to preload expression bubble sprite sheet:', error);
    } finally {
      completed += 1;
      options.onProgress?.({
        completed,
        total,
        currentLabel: `Expression bubble / ${animation.label}`,
      });
    }

    await runNextJob();
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, total) }, () => runNextJob()),
  );

  return {
    completed,
    total,
    failed,
  };
}
