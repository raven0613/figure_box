import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';

import {
  AvatarCanvas,
  type AvatarState,
  createDefaultAvatarState,
} from '~/widgets/avatarCanvas';
import { MiniAvatarCanvas } from '~/widgets/miniAvatarCanvas';
import type { MiniSpriteSheet } from '~/widgets/miniAvatarCanvas';
import { getMiniAnimationFrameDurationMs } from '~/widgets/miniAvatar/miniAvatarAnimation';
import {
  MINI_AVATAR_ANIMATION_DEFINITIONS,
  MINI_WAVE_BLINK_ANIMATION,
} from '~/widgets/miniAvatar/miniAvatarAnimationDefinitions';
import { loadAvatarAppearanceDraft } from '~/services/save/avatarAppearanceSaveService';

interface UseAvatarCanvasInstancesOptions {
  initialState?: Partial<AvatarState>;
  onAvatarChange?: (state: AvatarState) => void;
  onAvatarStateChange: (state: AvatarState) => void;
}

export function useAvatarCanvasInstances({
  initialState,
  onAvatarChange,
  onAvatarStateChange,
}: UseAvatarCanvasInstancesOptions) {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const miniCanvasHostRef = useRef<HTMLDivElement | null>(null);
  const miniSideCanvasHostRef = useRef<HTMLDivElement | null>(null);
  const miniBackCanvasHostRef = useRef<HTMLDivElement | null>(null);
  const miniAnimationCanvasHostRef = useRef<HTMLDivElement | null>(null);
  const avatarCanvasRef = useRef<AvatarCanvas | null>(null);
  const miniAvatarCanvasRef = useRef<MiniAvatarCanvas | null>(null);
  const miniSideAvatarCanvasRef = useRef<MiniAvatarCanvas | null>(null);
  const miniBackAvatarCanvasRef = useRef<MiniAvatarCanvas | null>(null);
  const miniAnimationCanvasRef = useRef<MiniAvatarCanvas | null>(null);
  const spriteSheetBakeVersionRef = useRef(0);
  const onAvatarChangeRef = useRef(onAvatarChange);
  const onAvatarStateChangeRef = useRef(onAvatarStateChange);
  const [initialEditorState] = useState<Partial<AvatarState> | undefined>(() => (
    initialState ?? loadAvatarAppearanceDraft()?.avatarState ?? undefined
  ));
  const initialStateRef = useRef(initialEditorState);
  const [avatarState, setAvatarState] = useState<AvatarState>(() => createDefaultAvatarState());
  const [spriteSheet, setSpriteSheet] = useState<MiniSpriteSheet | null>(null);
  const [spriteSheetFrameIndex, setSpriteSheetFrameIndex] = useState(0);
  const [selectedMiniAnimationId, setSelectedMiniAnimationId] = useState(MINI_WAVE_BLINK_ANIMATION.id);

  const selectedMiniAnimation = useMemo(
    () => MINI_AVATAR_ANIMATION_DEFINITIONS.find(animation => animation.id === selectedMiniAnimationId)
      ?? MINI_WAVE_BLINK_ANIMATION,
    [selectedMiniAnimationId]
  );

  const spriteSheetAnimationStyle = useMemo<CSSProperties | undefined>(() => {
    if (!spriteSheet) {
      return undefined;
    }

    const frameIndex = spriteSheetFrameIndex % spriteSheet.frameCount;
    const column = frameIndex % spriteSheet.columns;
    const row = Math.floor(frameIndex / spriteSheet.columns);

    return {
      width: spriteSheet.frameWidth,
      height: spriteSheet.frameHeight,
      backgroundImage: `url(${spriteSheet.dataUrl})`,
      backgroundPosition: `-${column * spriteSheet.frameWidth}px -${row * spriteSheet.frameHeight}px`,
      backgroundSize: `${spriteSheet.sheetWidth}px ${spriteSheet.sheetHeight}px`,
    };
  }, [spriteSheet, spriteSheetFrameIndex]);

  useEffect(() => {
    onAvatarChangeRef.current = onAvatarChange;
  }, [onAvatarChange]);

  useEffect(() => {
    onAvatarStateChangeRef.current = onAvatarStateChange;
  }, [onAvatarStateChange]);

  const refreshSpriteSheetPreview = useCallback(() => {
    const miniAvatarCanvas = miniAvatarCanvasRef.current;

    if (!miniAvatarCanvas) {
      return;
    }

    const bakeVersion = spriteSheetBakeVersionRef.current + 1;
    spriteSheetBakeVersionRef.current = bakeVersion;

    void miniAvatarCanvas.exportAnimationSpriteSheet()
      .then(nextSpriteSheet => {
        if (bakeVersion !== spriteSheetBakeVersionRef.current) {
          return;
        }

        setSpriteSheet(nextSpriteSheet);
      })
      .catch(error => {
        console.error('Failed to bake mini sprite sheet:', error);

        if (bakeVersion === spriteSheetBakeVersionRef.current) {
          setSpriteSheet(null);
        }
      });
  }, []);

  const handleAvatarCanvasChange = useCallback((state: AvatarState) => {
    setAvatarState(state);
    miniAvatarCanvasRef.current?.setState(state);
    miniSideAvatarCanvasRef.current?.setState(state);
    miniBackAvatarCanvasRef.current?.setState(state);
    miniAnimationCanvasRef.current?.setState(state);
    onAvatarChangeRef.current?.(state);
    onAvatarStateChangeRef.current(state);
  }, []);

  useEffect(() => {
    if (
      !canvasHostRef.current
      || !miniCanvasHostRef.current
      || !miniSideCanvasHostRef.current
      || !miniBackCanvasHostRef.current
      || !miniAnimationCanvasHostRef.current
    ) {
      return;
    }

    const canvasHost = canvasHostRef.current;
    const miniCanvasHost = miniCanvasHostRef.current;
    const miniSideCanvasHost = miniSideCanvasHostRef.current;
    const miniBackCanvasHost = miniBackCanvasHostRef.current;
    const miniAnimationCanvasHost = miniAnimationCanvasHostRef.current;
    const avatarCanvas = AvatarCanvas.mount(canvasHost, {
      initialState: initialStateRef.current,
      onChange: handleAvatarCanvasChange,
    });
    const miniAvatarCanvas = MiniAvatarCanvas.mount(miniCanvasHost, {
      initialState: avatarCanvas.getState(),
    });
    const miniSideAvatarCanvas = MiniAvatarCanvas.mount(miniSideCanvasHost, {
      initialState: avatarCanvas.getState(),
      direction: 'side',
    });
    const miniBackAvatarCanvas = MiniAvatarCanvas.mount(miniBackCanvasHost, {
      initialState: avatarCanvas.getState(),
      direction: 'back',
    });
    const miniAnimationCanvas = MiniAvatarCanvas.mount(miniAnimationCanvasHost, {
      initialState: avatarCanvas.getState(),
      isAnimationEnabled: true,
    });
    avatarCanvasRef.current = avatarCanvas;
    miniAvatarCanvasRef.current = miniAvatarCanvas;
    miniSideAvatarCanvasRef.current = miniSideAvatarCanvas;
    miniBackAvatarCanvasRef.current = miniBackAvatarCanvas;
    miniAnimationCanvasRef.current = miniAnimationCanvas;
    const mountedAvatarState = avatarCanvas.getState();

    setAvatarState(mountedAvatarState);
    onAvatarChangeRef.current?.(mountedAvatarState);
    refreshSpriteSheetPreview();

    return () => {
      spriteSheetBakeVersionRef.current += 1;
      avatarCanvasRef.current = null;
      miniAvatarCanvasRef.current = null;
      miniSideAvatarCanvasRef.current = null;
      miniBackAvatarCanvasRef.current = null;
      miniAnimationCanvasRef.current = null;
      void avatarCanvas.destroy();
      void miniAvatarCanvas.destroy();
      void miniSideAvatarCanvas.destroy();
      void miniBackAvatarCanvas.destroy();
      void miniAnimationCanvas.destroy();
      canvasHost.replaceChildren();
      miniCanvasHost.replaceChildren();
      miniSideCanvasHost.replaceChildren();
      miniBackCanvasHost.replaceChildren();
      miniAnimationCanvasHost.replaceChildren();
    };
  }, [handleAvatarCanvasChange, refreshSpriteSheetPreview]);

  useEffect(() => {
    refreshSpriteSheetPreview();
  }, [avatarState, refreshSpriteSheetPreview]);

  useEffect(() => {
    miniAvatarCanvasRef.current?.setAnimation(selectedMiniAnimation);
    miniAnimationCanvasRef.current?.setAnimation(selectedMiniAnimation);
    refreshSpriteSheetPreview();
  }, [refreshSpriteSheetPreview, selectedMiniAnimation]);

  useEffect(() => {
    setSpriteSheetFrameIndex(0);

    if (!spriteSheet || spriteSheet.frameCount <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setSpriteSheetFrameIndex(currentFrameIndex => (
        (currentFrameIndex + 1) % spriteSheet.frameCount
      ));
    }, getMiniAnimationFrameDurationMs(selectedMiniAnimation));

    return () => {
      window.clearInterval(intervalId);
    };
  }, [selectedMiniAnimation, spriteSheet]);

  return {
    avatarCanvasRef,
    avatarState,
    canvasHostRef,
    miniAnimationCanvasHostRef,
    miniBackCanvasHostRef,
    miniCanvasHostRef,
    miniSideCanvasHostRef,
    selectedMiniAnimationId,
    setSelectedMiniAnimationId,
    spriteSheet,
    spriteSheetAnimationStyle,
    spriteSheetFrameIndex,
  };
}
