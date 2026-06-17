import { useCallback, useEffect, useRef } from 'react';

import {
  HOLD_MOVE_DELAY_MS,
  HOLD_MOVE_INTERVAL_MS,
} from '~/components/avatarEditor/avatarEditorConstants';
import { getHoldMoveMultiplier } from '~/utils/avatarEditorUtils';

interface HoldMoveState {
  timeoutId: ReturnType<typeof setTimeout> | null;
  intervalId: ReturnType<typeof setInterval> | null;
  tickCount: number;
}

export function useHoldMove(onMove: (deltaX: number, deltaY: number) => void) {
  const moveRef = useRef(onMove);
  const holdMoveRef = useRef<HoldMoveState>({
    timeoutId: null,
    intervalId: null,
    tickCount: 0,
  });

  useEffect(() => {
    moveRef.current = onMove;
  }, [onMove]);

  const stopHoldMove = useCallback(() => {
    if (holdMoveRef.current.timeoutId) {
      clearTimeout(holdMoveRef.current.timeoutId);
    }

    if (holdMoveRef.current.intervalId) {
      clearInterval(holdMoveRef.current.intervalId);
    }

    holdMoveRef.current = {
      timeoutId: null,
      intervalId: null,
      tickCount: 0,
    };
  }, []);

  const startHoldMove = useCallback((deltaX: number, deltaY: number) => {
    stopHoldMove();
    moveRef.current(deltaX, deltaY);

    holdMoveRef.current.timeoutId = setTimeout(() => {
      holdMoveRef.current.intervalId = setInterval(() => {
        holdMoveRef.current.tickCount += 1;
        const multiplier = getHoldMoveMultiplier(holdMoveRef.current.tickCount);
        moveRef.current(deltaX * multiplier, deltaY * multiplier);
      }, HOLD_MOVE_INTERVAL_MS);
    }, HOLD_MOVE_DELAY_MS);
  }, [stopHoldMove]);

  useEffect(() => {
    return () => {
      stopHoldMove();
    };
  }, [stopHoldMove]);

  return {
    startHoldMove,
    stopHoldMove,
  };
}
