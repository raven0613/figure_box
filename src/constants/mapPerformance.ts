export interface MapPerformanceCrowdDisplacementConfig {
  detectionRadiusCells: number;
  pushDistanceCells: number;
  pushDurationMs: number;
  restoreDurationMs: number;
}

export const DEFAULT_MAP_PERFORMANCE_CROWD_DISPLACEMENT: MapPerformanceCrowdDisplacementConfig = {
  detectionRadiusCells: 5,
  pushDistanceCells: 5,
  pushDurationMs: 240,
  restoreDurationMs: 240,
};

export interface DialogueMapFocusConfig {
  backgroundDimOpacity: number;
  transitionDurationMs: number;
}

export const DEFAULT_DIALOGUE_MAP_FOCUS: DialogueMapFocusConfig = {
  backgroundDimOpacity: 0.28,
  transitionDurationMs: 180,
};

export interface WallSlamMapPerformanceConfig {
  participantDistanceCells: number;
  wallDistanceCells: number;
  wallDropDistanceCells: number;
  wallEnterDurationMs: number;
  wallExitDurationMs: number;
  backgroundDimOpacity: number;
  backgroundDimDurationMs: number;
}

export const WALL_SLAM_MAP_PERFORMANCE: WallSlamMapPerformanceConfig = {
  participantDistanceCells: 1.8,
  wallDistanceCells: 1.35,
  wallDropDistanceCells: 8,
  wallEnterDurationMs: 320,
  wallExitDurationMs: 260,
  backgroundDimOpacity: 0.28,
  backgroundDimDurationMs: 180,
};
