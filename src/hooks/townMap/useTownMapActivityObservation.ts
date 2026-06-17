import { useEffect, useRef } from 'react';

import type {
  FabricTownMapWidget,
  TownMapCameraView,
} from '~/widgets/fabricTownMapWidget';
import type { JoinableActivity } from '~/services/characterEvents/joinableActivities';

const ACTIVITY_OBSERVATION_CAMERA_ZOOM = 3;
const ACTIVITY_OBSERVATION_CAMERA_TRANSITION_MS = 600;

interface UseTownMapActivityObservationOptions {
  joinableActivities: readonly JoinableActivity[];
  observedActivityId: string | null;
  widgetRef: { current: FabricTownMapWidget | null };
}

export function useTownMapActivityObservation({
  joinableActivities,
  observedActivityId,
  widgetRef,
}: UseTownMapActivityObservationOptions) {
  const activityObservationCameraViewRef = useRef<TownMapCameraView | null>(null);
  const focusedActivityObservationIdRef = useRef<string | null>(null);
  const isCameraRestoreTransitionActiveRef = useRef(false);

  useEffect(() => {
    const widget = widgetRef.current;

    if (!widget) {
      return;
    }

    if (observedActivityId) {
      isCameraRestoreTransitionActiveRef.current = false;
      activityObservationCameraViewRef.current ??= widget.captureCameraView();
      widget.setCameraInteractionLocked(true);
      const observedActivity = joinableActivities.find(
        activity => activity.id === observedActivityId,
      );

      if (
        observedActivity
        && focusedActivityObservationIdRef.current !== observedActivityId
      ) {
        widget.focusCameraOnCharacters(
          observedActivity.participantIds,
          ACTIVITY_OBSERVATION_CAMERA_ZOOM,
          {
            durationMs: ACTIVITY_OBSERVATION_CAMERA_TRANSITION_MS,
          },
        );
        focusedActivityObservationIdRef.current = observedActivityId;
      }

      return;
    }

    const previousCameraView = activityObservationCameraViewRef.current;

    if (previousCameraView) {
      activityObservationCameraViewRef.current = null;
      focusedActivityObservationIdRef.current = null;
      isCameraRestoreTransitionActiveRef.current = true;
      widget.restoreCameraView(previousCameraView, {
        durationMs: ACTIVITY_OBSERVATION_CAMERA_TRANSITION_MS,
        onComplete: () => {
          isCameraRestoreTransitionActiveRef.current = false;
          widget.setCameraInteractionLocked(false);
        },
      });
      return;
    }

    if (isCameraRestoreTransitionActiveRef.current) {
      return;
    }

    widget.setCameraInteractionLocked(false);
  }, [joinableActivities, observedActivityId, widgetRef]);
}
