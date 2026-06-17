import type { CSSProperties, RefObject } from 'react';

import type { MiniSpriteSheet } from '~/widgets/miniAvatarCanvas';
import { MINI_AVATAR_ANIMATION_DEFINITIONS } from '~/widgets/miniAvatar/miniAvatarAnimationDefinitions';
import styles from './avatarEditor.module.scss';

interface AvatarEditorStageProps {
  canvasHostRef: RefObject<HTMLDivElement | null>;
  miniAnimationCanvasHostRef: RefObject<HTMLDivElement | null>;
  miniBackCanvasHostRef: RefObject<HTMLDivElement | null>;
  miniCanvasHostRef: RefObject<HTMLDivElement | null>;
  miniSideCanvasHostRef: RefObject<HTMLDivElement | null>;
  selectedMiniAnimationId: string;
  spriteSheet: MiniSpriteSheet | null;
  spriteSheetAnimationStyle?: CSSProperties;
  spriteSheetFrameIndex: number;
  onSelectMiniAnimation: (animationId: string) => void;
}

export function AvatarEditorStage({
  canvasHostRef,
  miniAnimationCanvasHostRef,
  miniBackCanvasHostRef,
  miniCanvasHostRef,
  miniSideCanvasHostRef,
  selectedMiniAnimationId,
  spriteSheet,
  spriteSheetAnimationStyle,
  spriteSheetFrameIndex,
  onSelectMiniAnimation,
}: AvatarEditorStageProps) {
  return (
    <div className={styles.stageShell}>
      <div className={styles.canvasShell}>
        <div className={styles.canvasHost} ref={canvasHostRef} />
      </div>
      <div className={styles.previewColumn}>
        <div className={styles.animationSelector} role="tablist" aria-label="Mini animation">
          {MINI_AVATAR_ANIMATION_DEFINITIONS.map(animation => (
            <button
              type="button"
              key={animation.id}
              className={animation.id === selectedMiniAnimationId ? styles.activeAnimationButton : styles.animationButton}
              onClick={() => onSelectMiniAnimation(animation.id)}
              role="tab"
              aria-selected={animation.id === selectedMiniAnimationId}
            >
              {animation.label}
            </button>
          ))}
        </div>
        <div className={styles.miniPreviewPair}>
          <div className={styles.miniPreviewShell} aria-label="Mini avatar preview">
            <div className={styles.miniCanvasHost} ref={miniCanvasHostRef} />
          </div>
          <div className={styles.miniPreviewShell} aria-label="Mini side avatar preview">
            <div className={styles.miniCanvasHost} ref={miniSideCanvasHostRef} />
          </div>
          <div className={styles.miniPreviewShell} aria-label="Mini back avatar preview">
            <div className={styles.miniCanvasHost} ref={miniBackCanvasHostRef} />
          </div>
        </div>
        <div className={styles.miniPreviewShell} aria-label="Mini live animation preview">
          <div className={styles.miniCanvasHost} ref={miniAnimationCanvasHostRef} />
        </div>
        <div className={styles.spriteSheetAnimationShell} aria-label="Mini sprite sheet animation preview">
          <div className={styles.spriteSheetAnimationViewport}>
            {spriteSheetAnimationStyle && (
              <div
                className={styles.spriteSheetAnimationFrame}
                style={spriteSheetAnimationStyle}
              />
            )}
          </div>
          <div className={styles.spriteSheetMeta}>
            {spriteSheet
              ? `${spriteSheetFrameIndex % spriteSheet.frameCount + 1} / ${spriteSheet.frameCount}`
              : 'baking'}
          </div>
        </div>
      </div>
    </div>
  );
}
