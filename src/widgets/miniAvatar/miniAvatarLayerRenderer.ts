import type { AvatarState } from '../avatar/avatarTypes';
import type { MiniLayer, MiniPose } from './miniAvatarTypes';
import { MiniFrontBackIdleLayerRenderer } from './renderers/miniFrontBackIdleLayerRenderer';
import { MiniSideIdleLayerRenderer } from './renderers/miniSideIdleLayerRenderer';

export async function createMiniFrontIdleLayers(state: AvatarState, pose: MiniPose = {}): Promise<MiniLayer[]> {
  return new MiniFrontBackIdleLayerRenderer(state, pose, 'front').createLayers();
}

export async function createMiniBackIdleLayers(state: AvatarState, pose: MiniPose = {}): Promise<MiniLayer[]> {
  return new MiniFrontBackIdleLayerRenderer(state, pose, 'back').createLayers();
}

export async function createMiniSideIdleLayers(state: AvatarState, pose: MiniPose = {}): Promise<MiniLayer[]> {
  return new MiniSideIdleLayerRenderer(state, pose).createLayers();
}
