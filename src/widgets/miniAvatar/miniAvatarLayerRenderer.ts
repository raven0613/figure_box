import {
  getAccessoryCategoryDefinition,
  getAccessoryLayerSlotDefinition,
  resolveAccessoryColorFileName,
} from '../avatar/avatarAccessoryDefinitions';
import { getAccessoryPoseState } from '../avatar/avatarAccessoryState';
import { isAvatarPartOptionColorEditable } from '../avatar/avatarDefinitions';
import type {
  AccessoryCategory,
  AccessoryLayerSlot,
  AccessoryRenderMode,
  AvatarAccessoryInstance,
  AvatarGradientCoordinateSpace,
  AvatarPartKey,
  AvatarState,
  AvatarTintSource,
} from '../avatar/avatarTypes';
import {
  formatMiniOptionId,
  getCombinedMiniContentBounds,
  getFirstAvailableMiniOptionId,
  getMiniBoundsBottomOffset,
  hasMiniAvatarAsset,
  resolveMiniDirectoryOptionId,
} from './miniAvatarAssets';
import {
  MINI_ACCESSORY_ORDER_STEP,
  MINI_ACCESSORY_SLOT_Z_INDEX,
  MINI_BACK_ACCESSORY_SLOT_Z_INDEX,
  MINI_BACK_IDLE_RIG_LAYOUT,
  MINI_CENTER_X,
  MINI_CLOTHING_BODY_Z_INDEX,
  MINI_CLOTHING_LAYER_Z_STEP,
  MINI_CLOTHING_LINE_Z_OFFSET,
  MINI_DEFAULT_EYE_LIGHT_DISTANCE,
  MINI_FRONT_IDLE_RIG_LAYOUT,
  MINI_PIXEL_SCALE,
  MINI_SIDE_IDLE_RIG_LAYOUT,
} from './miniAvatarRig';
import type {
  MiniAccessoryRigLayout,
  MiniBodyRigLayout,
  MiniIdleRigLayout,
  MiniLayer,
  MiniLocalLayer,
  MiniOptionOffsetMap,
  MiniPoint,
  MiniPose,
  MiniRigNode,
  MiniTransform,
} from './miniAvatarTypes';
import { flattenMiniRigNode } from './miniAvatarTransform';
import { getMiniAvatarAnchorOffset } from './miniAvatarAnchors';

interface MiniMirroredSocketPoints {
  left: MiniPoint;
  right: MiniPoint;
}

interface MiniAssetPair {
  folder: string;
  colorFile: string;
  lineFile: string;
}

const MINI_HEAD_BACK_Z_INDEX = MINI_ACCESSORY_SLOT_Z_INDEX.behindBody;
const MINI_HEAD_ON_SKIN_Z_INDEX = MINI_ACCESSORY_SLOT_Z_INDEX.onSkin;
const MINI_HEAD_BODY_FRONT_Z_INDEX = MINI_ACCESSORY_SLOT_Z_INDEX.frontBody;
const MINI_HEAD_MAIN_Z_INDEX = 10;
const MINI_HEAD_FRONT_FACE_Z_INDEX = MINI_ACCESSORY_SLOT_Z_INDEX.frontFace;
const MINI_HEAD_BANGS_Z_INDEX = 30;
const MINI_HEAD_FRONT_BANGS_Z_INDEX = MINI_ACCESSORY_SLOT_Z_INDEX.frontBangs;
const MINI_BACK_HEAD_MAIN_Z_INDEX = -2;

export async function createMiniFrontIdleLayers(state: AvatarState, pose: MiniPose = {}): Promise<MiniLayer[]> {
  return new MiniFrontBackIdleLayerRenderer(state, pose, 'front').createLayers();
}

export async function createMiniBackIdleLayers(state: AvatarState, pose: MiniPose = {}): Promise<MiniLayer[]> {
  return new MiniFrontBackIdleLayerRenderer(state, pose, 'back').createLayers();
}

export async function createMiniSideIdleLayers(state: AvatarState, pose: MiniPose = {}): Promise<MiniLayer[]> {
  return new MiniSideIdleLayerRenderer(state, pose).createLayers();
}

class MiniFrontBackIdleLayerRenderer {
  private readonly state: AvatarState;
  private readonly pose: MiniPose;
  private readonly direction: 'front' | 'back';

  constructor(state: AvatarState, pose: MiniPose, direction: 'front' | 'back') {
    this.state = state;
    this.pose = pose;
    this.direction = direction;
  }

  async createLayers(): Promise<MiniLayer[]> {
    const isBack = this.direction === 'back';
    const rig = isBack ? MINI_BACK_IDLE_RIG_LAYOUT : MINI_FRONT_IDLE_RIG_LAYOUT;
    const accessorySlotZIndex = isBack
      ? MINI_BACK_ACCESSORY_SLOT_Z_INDEX
      : MINI_ACCESSORY_SLOT_Z_INDEX;
    const bodyOptionId = this.resolveOptionId('body', this.getPartOptionId('mini.bodyType') || rig.bodyTypeId);
    const bodyTypeId = Number(bodyOptionId);
    const skinColor = this.getPartColor('face', rig.colors.skin);
    const skinLineColor = this.getPartLineTintSource('face');
    const topId = resolveMiniDirectoryOptionId('clothing/tops', this.getPartOptionId('mini.clothingTop'));
    const bottomId = resolveMiniDirectoryOptionId('clothing/bottoms', this.getPartOptionId('mini.clothingBottom'));
    const backHairBottomId = this.resolveOptionId('back_hair_bottom', this.getPartOptionId('hair.backHair'));
    const backHairTopId = this.resolveOptionId('back_hair_top', this.getPartOptionId('hair.topHair'));
    const bangsId = this.resolveOptionId('bangs', this.getPartOptionId('hair.bangs'));
    const earId = this.resolveOptionId('ear', this.getPartOptionId('ear'));
    const hairLightId = formatMiniOptionId(this.getPartOptionId('hair.light'));
    const hairLightFolder = getMiniHairLightFolder(this.direction, hairLightId);
    const hairLightPositionState = this.state[isBack ? 'mini.hairLightBack' : 'mini.hairLightFront'];
    const backHairBottomFolder = isBack
      ? getMiniBackFolderWithFallback('back_hair_bottom', backHairBottomId)
      : 'back_hair_bottom';
    const backHairTopFolder = isBack
      ? getMiniBackFolderWithFallback('back_hair_top', backHairTopId)
      : 'back_hair_top';
    const bodyRig = rig.bodyByType[bodyTypeId] ?? rig.bodyByType[1];
    const defaultHeadCenter = getMiniCanvasPoint(rig.headCenter);
    const bodyCenter = await getMiniBodyCenter(rig, bodyRig);
    const defaultBodyCenter = getMiniCanvasPoint(rig.bodyCenter);
    const bodyBaselineShiftY = bodyCenter.y - defaultBodyCenter.y;
    const headCenter = {
      ...defaultHeadCenter,
      y: defaultHeadCenter.y + bodyBaselineShiftY,
    };
    const bodyOffset = getMiniScaledOffset(bodyRig.body);
    const legOffset = getMiniScaledOffset(bodyRig.legOffset);
    const legAnchorOffset = getMiniAvatarAnchorOffset('leg', '01', bodyTypeId);
    const armIdleOffset = getMiniScaledOffset(bodyRig.armIdleOffset);
    const armIdleAnchorOffset = getMiniAvatarAnchorOffset('arm_idle', '01', bodyTypeId);
    const armIdleSocketPoints = getMiniArmIdleSocketPoints(bodyRig, armIdleOffset, armIdleAnchorOffset);
    const faceOffset = getMiniScaledOffset(rig.face);
    const earOffset = getMiniScaledOffset(rig.ear);
    const mouthOffset = getMiniScaledOffset(rig.mouth);
    const backHairBottomOffset = getMiniScaledOffset(addMiniPoints(
      rig.hair.backHairBottom,
      getMiniOptionOffset(rig.hair.backHairBottomByOption, backHairBottomId),
    ));
    const backHairTopOffset = getMiniScaledOffset(addMiniPoints(
      rig.hair.backHairTop,
      getMiniOptionOffset(rig.hair.backHairTopByOption, backHairTopId),
    ));
    const bangsOffset = getMiniScaledOffset(addMiniPoints(
      rig.hair.bangs,
      getMiniOptionOffset(rig.hair.bangsByOption, bangsId),
    ));
    const hairLightOffset = getMiniScaledOffset(addMiniPoints(rig.hair.hairLight, {
      x: hairLightPositionState.offsetX ?? 0,
      y: hairLightPositionState.offsetY ?? 0,
    }));
    const topBodyOffset = getMiniScaledOffset(rig.clothing.topBody);
    const topArmOffset = getMiniScaledOffset(rig.clothing.topArm);
    const bottomAnchorOffset = getMiniScaledOffset(bodyRig.bottomAnchor);
    const bottomOffset = getMiniScaledOffset(rig.clothing.bottom);
    const scleraOffset = getMiniScaledOffset(rig.eyes.sclera);
    const lowerEyelidOffset = getMiniScaledOffset(rig.eyes.lowerEyelid);
    const eyeBallOffset = getMiniScaledOffset(rig.eyes.eyeBall);
    const requestedEyeLightOffset = getMiniScaledOffset(rig.eyes.eyeLight);
    const eyeLightState = this.state['mini.eyeLight'];
    const upperLidOffset = getMiniScaledOffset(rig.eyes.upperEyeLid);
    const upperLidPoseOffsetY = (this.state['mini.upperEyelid'].offsetY ?? 0) * MINI_PIXEL_SCALE;
    const upperLidAngle = this.state['mini.upperEyelid'].rotate ?? 0;
    const eyebrowOffset = getMiniScaledOffset(rig.eyes.eyebrow);
    const accessoryBases: Record<AccessoryRenderMode, MiniPoint> = {
      center: getMiniScaledOffset(rig.accessories.center),
      mirrored: getMiniScaledOffset(rig.accessories.mirrored),
    };
    const upperLidY = headCenter.y + upperLidOffset.y + upperLidPoseOffsetY;
    const eyeBallY = headCenter.y + eyeBallOffset.y;
    const eyeLightDistance = eyeLightState.lightDistance ?? MINI_DEFAULT_EYE_LIGHT_DISTANCE;
    const eyeLightOffsetX = (eyeLightState.offsetX ?? 0) * MINI_PIXEL_SCALE;
    const scleraColor = this.getPartColor('eyes.sclera', rig.colors.sclera);
    const leftEyeColor = this.getPartColor('eyes.color', rig.colors.eyeBall);
    const rightEyeColor = this.getPartSecondaryTintSource('eyes.color', leftEyeColor);
    const topColor = this.getEditablePartColor('mini.clothingTop', rig.colors.clothingTop);
    const topLineColor = this.getPartLineTintSource('mini.clothingTop');
    const bottomColor = this.getEditablePartColor('mini.clothingBottom', rig.colors.clothingBottom);
    const bottomLineColor = this.getPartLineTintSource('mini.clothingBottom');
    const isTopVisible = this.isPartVisible('mini.clothingTop') && topId !== null;
    const isBottomVisible = this.isPartVisible('mini.clothingBottom') && bottomId !== null;
    const topBodyZIndex = getMiniClothingBodyZIndex(this.getPartLayerOrder('mini.clothingTop'));
    const bottomZIndex = getMiniClothingBodyZIndex(this.getPartLayerOrder('mini.clothingBottom'));
    const eyeLightY = eyeBallY + requestedEyeLightOffset.y + (eyeLightState.offsetY ?? 0) * MINI_PIXEL_SCALE;
    const isSmileBlinkFrame = this.pose.eyeExpression === 'smileBlink';
    const topArmLayers = isTopVisible
      ? this.createNamedColorAndLineLocalLayers(
        `clothing/tops/${topId}`,
        'front_arm_color.png',
        'front_arm_line.png',
        topColor,
        topLineColor,
        1.2,
        topArmOffset.x,
        topArmOffset.y,
      )
      : [];
    const topBodyAssets = topId === null
      ? null
      : resolveMiniBackAssetPair(
        `clothing/tops/${topId}`,
        `back_body_${bodyOptionId}_color.png`,
        `back_body_${bodyOptionId}_line.png`,
        `front_body_${bodyOptionId}_color.png`,
        `front_body_${bodyOptionId}_line.png`,
        isBack,
      );
    const bottomAssets = bottomId === null
      ? null
      : resolveMiniBackAssetPair(
        `clothing/bottoms/${bottomId}`,
        'back_color.png',
        'back_line.png',
        'front_color.png',
        'front_line.png',
        isBack,
      );
    const clothingLayers = [
      ...(isTopVisible && topBodyAssets
        ? [
          ...this.createNamedColorAndLineLayers(
            topBodyAssets.folder,
            topBodyAssets.colorFile,
            topBodyAssets.lineFile,
            topColor,
            topLineColor,
            bodyOffset.x + topBodyOffset.x,
            bodyOffset.y + topBodyOffset.y,
            topBodyZIndex,
          ),
        ]
        : []),
      ...(isBottomVisible && bottomAssets
        ? this.createNamedColorAndLineLayers(
          bottomAssets.folder,
          bottomAssets.colorFile,
          bottomAssets.lineFile,
          bottomColor,
          bottomLineColor,
          bottomAnchorOffset.x + bottomOffset.x,
          bottomAnchorOffset.y + bottomOffset.y,
          bottomZIndex,
        )
        : []),
    ];
    const bodyNode: MiniRigNode = {
      transform: createMiniNodeTransform(bodyCenter, this.getPoseNodeTransform('body')),
      children: [
        {
          transform: this.getPoseNodeTransform('legsGroup'),
          children: this.createMirroredColorAndLineNodes(
            'leg',
            '01',
            skinColor,
            skinLineColor,
            createMirroredMiniSocketPoints(bodyRig.legDistance, legOffset.y),
            0,
            this.getPoseNodeTransform('leftLeg'),
            this.getPoseNodeTransform('rightLeg'),
            [],
            legAnchorOffset,
            true,
          ),
        },
        {
          transform: this.getPoseNodeTransform('bodyGroup'),
          layers: [
            ...this.createColorAndLineLayers('body', bodyOptionId, skinColor, skinLineColor, bodyOffset.x, bodyOffset.y, 2),
          ],
          children: [
            ...this.createMirroredColorAndLineNodes(
              'arm_idle',
              '01',
              skinColor,
              skinLineColor,
              armIdleSocketPoints,
              1,
              this.getPoseNodeTransform('leftArm'),
              this.getPoseNodeTransform('rightArm'),
              topArmLayers,
              armIdleAnchorOffset,
            ),
            { layers: clothingLayers },
          ],
        },
      ],
    };
    const headTransform = createMiniNodeTransform(headCenter, this.getPoseNodeTransform('head'));
    const eyesNode: MiniRigNode = {
      transform: this.getPoseNodeTransform('eyes'),
      layers: isSmileBlinkFrame
        ? []
        : [
          ...this.createMirroredColorOnlyLayers('sclera', '01', scleraColor, scleraColor, rig.eyes.eyeDistance + scleraOffset.x, scleraOffset.y, 13.9),
          ...this.createMirroredColorAndLineLayers('lower_eyelid', '01', rig.colors.lowerEyelidColor, this.getPartLineTintSource('eyes.lowerEyelid'), rig.eyes.eyeDistance + lowerEyelidOffset.x, lowerEyelidOffset.y, 14),
          ...this.createMirroredColorOnlyLayers('eye_ball', '01', leftEyeColor, rightEyeColor, rig.eyes.eyeDistance + eyeBallOffset.x, eyeBallOffset.y, 15),
        ],
      children: [
        ...(isSmileBlinkFrame
          ? []
          : [{
            transform: createMiniNodeTransform(
              { x: 0, y: eyeLightY - headCenter.y },
              this.getPoseNodeTransform('eyeLight'),
            ),
            layers: this.createMirroredLineOnlyLayers('eye_light', '01', rig.colors.eyeLight, eyeLightDistance, 0, 16, 0, eyeLightOffsetX),
          }]),
        {
          transform: createMiniNodeTransform(
            { x: 0, y: upperLidY - headCenter.y },
            {
              ...this.getPoseNodeTransform('upperEyelid'),
              angle: upperLidAngle + (this.getPoseNodeTransform('upperEyelid').angle ?? 0),
            },
          ),
          layers: this.createUpperEyelidLayers(skinColor, leftEyeColor, rightEyeColor, rig.eyes.eyeDistance + upperLidOffset.x),
        },
        {
          transform: createMiniNodeTransform(
            { x: 0, y: upperLidY - headCenter.y },
            this.getPoseNodeTransform('eyelid'),
          ),
          layers: this.createEyelidLayers(rig.eyes.eyeDistance + upperLidOffset.x),
        },
        {
          transform: this.getPoseNodeTransform('eyebrow'),
          layers: this.createMirroredLineOnlyLayers('eyebrow', '01', this.getPartLineTintSource('eyes.eyebrow'), rig.eyes.eyeDistance + eyebrowOffset.x, eyebrowOffset.y, 19),
        },
      ],
    };
    const headBackNode: MiniRigNode = {
      transform: headTransform,
      precompose: true,
      precomposeZIndex: accessorySlotZIndex.behindBody,
      layers: isBack
        ? []
        : this.createColorAndLineLayers(backHairBottomFolder, backHairBottomId, this.getPartColor('hair.backHair', rig.colors.hair), this.getPartLineTintSource('hair.backHair'), backHairBottomOffset.x, backHairBottomOffset.y, 10, this.getPartColorGradientSpace('hair.backHair')),
      children: this.createAccessoryNodes(accessoryBases, rig.accessories, ['behindBody']),
    };
    const headOnSkinNode: MiniRigNode = {
      transform: headTransform,
      precompose: true,
      precomposeZIndex: accessorySlotZIndex.onSkin,
      children: this.createAccessoryNodes(accessoryBases, rig.accessories, ['onSkin']),
    };
    const headBodyFrontNode: MiniRigNode = {
      transform: headTransform,
      precompose: true,
      precomposeZIndex: accessorySlotZIndex.frontBody,
      children: this.createAccessoryNodes(accessoryBases, rig.accessories, ['frontBody']),
    };
    const headMainNode: MiniRigNode = {
      transform: headTransform,
      precompose: true,
      precomposeZIndex: isBack ? MINI_BACK_HEAD_MAIN_Z_INDEX : MINI_HEAD_MAIN_Z_INDEX,
      layers: [
        ...this.createColorAndLineLayers('face', '01', skinColor, skinLineColor, faceOffset.x, faceOffset.y, 13),
        ...(!isBack
          ? this.createColorAndLineLayers(backHairTopFolder, backHairTopId, this.getPartColor('hair.topHair', rig.colors.hair), this.getPartLineTintSource('hair.topHair'), backHairTopOffset.x, backHairTopOffset.y, 13.5, this.getPartColorGradientSpace('hair.topHair'))
          : []),
        ...this.createMirroredColorAndLineLayers('ear', earId, skinColor, skinLineColor, rig.earDistance + earOffset.x, earOffset.y, 13.8),
        ...(!isBack
          ? this.createLineOnlyLayers('mouth', '01', this.getPartLineTintSource('mouth'), mouthOffset.x, mouthOffset.y, 20)
          : []),
      ],
      children: isBack ? [] : [eyesNode],
    };
    const headFrontFaceNode: MiniRigNode = {
      transform: headTransform,
      precompose: true,
      precomposeZIndex: accessorySlotZIndex.frontFace,
      children: this.createAccessoryNodes(accessoryBases, rig.accessories, ['frontFace']),
    };
    const headBangsNode: MiniRigNode = {
      transform: headTransform,
      precompose: true,
      precomposeZIndex: MINI_HEAD_BANGS_Z_INDEX,
      layers: isBack
        ? [
          ...this.createColorAndLineLayers(backHairBottomFolder, backHairBottomId, this.getPartColor('hair.backHair', rig.colors.hair), this.getPartLineTintSource('hair.backHair'), backHairBottomOffset.x, backHairBottomOffset.y, 30, this.getPartColorGradientSpace('hair.backHair')),
          ...this.createColorAndLineLayers(backHairTopFolder, backHairTopId, this.getPartColor('hair.topHair', rig.colors.hair), this.getPartLineTintSource('hair.topHair'), backHairTopOffset.x, backHairTopOffset.y, 30.5, this.getPartColorGradientSpace('hair.topHair')),
          ...this.createLineOnlyLayers(hairLightFolder, hairLightId, this.getPartColor('hair.light', rig.colors.hairLight), hairLightOffset.x, hairLightOffset.y, 31),
        ]
        : [
          ...this.createColorAndLineLayers('bangs', bangsId, this.getPartColor('hair.bangs', rig.colors.hair), this.getPartLineTintSource('hair.bangs'), bangsOffset.x, bangsOffset.y, 30, this.getPartColorGradientSpace('hair.bangs')),
          ...this.createLineOnlyLayers(hairLightFolder, hairLightId, this.getPartColor('hair.light', rig.colors.hairLight), hairLightOffset.x, hairLightOffset.y, 31),
        ],
    };
    const headFrontBangsNode: MiniRigNode = {
      transform: headTransform,
      precompose: true,
      precomposeZIndex: accessorySlotZIndex.frontBangs,
      children: this.createAccessoryNodes(accessoryBases, rig.accessories, ['frontBangs']),
    };
    const rootNode: MiniRigNode = {
      children: [
        headBackNode,
        bodyNode,
        headOnSkinNode,
        headBodyFrontNode,
        headMainNode,
        headFrontFaceNode,
        headBangsNode,
        headFrontBangsNode,
      ],
    };

    return flattenMiniRigNode(rootNode);
  }

  private createColorAndLineLayers(
    folder: string,
    optionId: string,
    color: AvatarTintSource,
    lineColor: AvatarTintSource,
    x: number,
    y: number,
    zIndex: number,
    colorGradientSpace?: AvatarGradientCoordinateSpace,
  ): MiniLayer[] {
    return [
      { folder, file: `${optionId}_color.png`, color, colorGradientSpace, x, y, zIndex },
      { folder, file: `${optionId}_line.png`, color: lineColor, x, y, zIndex: zIndex + 0.1 },
    ].filter(layer => hasMiniAvatarAsset(layer.folder, layer.file));
  }

  private createNamedColorAndLineLayers(
    folder: string,
    colorFile: string,
    lineFile: string,
    color: AvatarTintSource | undefined,
    lineColor: AvatarTintSource | undefined,
    x: number,
    y: number,
    zIndex: number,
  ): MiniLayer[] {
    return [
      { folder, file: colorFile, color, x, y, zIndex },
      { folder, file: lineFile, color: lineColor, x, y, zIndex: zIndex + MINI_CLOTHING_LINE_Z_OFFSET },
    ].filter(layer => hasMiniAvatarAsset(layer.folder, layer.file));
  }

  private createNamedColorAndLineLocalLayers(
    folder: string,
    colorFile: string,
    lineFile: string,
    color: AvatarTintSource | undefined,
    lineColor: AvatarTintSource | undefined,
    zIndex: number,
    x = 0,
    y = 0,
    flipX = false,
  ): MiniLocalLayer[] {
    return [
      { folder, file: colorFile, color, x, y, zIndex, flipX },
      { folder, file: lineFile, color: lineColor, x, y, zIndex: zIndex + MINI_CLOTHING_LINE_Z_OFFSET, flipX },
    ].filter(layer => hasMiniAvatarAsset(layer.folder, layer.file));
  }

  private createLineOnlyLayers(
    folder: string,
    optionId: string,
    color: AvatarTintSource,
    x: number,
    y: number,
    zIndex: number,
  ): MiniLayer[] {
    const file = `${optionId}_line.png`;
    return hasMiniAvatarAsset(folder, file)
      ? [{ folder, file, color, x, y, zIndex }]
      : [];
  }

  private createMirroredColorAndLineLayers(
    folder: string,
    optionId: string,
    color: AvatarTintSource,
    lineColor: AvatarTintSource,
    distance: number,
    y: number,
    zIndex: number,
    angle = 0,
  ): MiniLayer[] {
    return [
      ...this.createMirroredColorOnlyLayers(folder, optionId, color, color, distance, y, zIndex, angle),
      ...this.createMirroredLineOnlyLayers(folder, optionId, lineColor, distance, y, zIndex + 0.1, angle),
    ];
  }

  private createMirroredColorAndLineNodes(
    folder: string,
    optionId: string,
    color: AvatarTintSource,
    lineColor: AvatarTintSource,
    socketPoints: MiniMirroredSocketPoints,
    zIndex: number,
    leftTransform: MiniTransform = {},
    rightTransform: MiniTransform = {},
    extraLayers: MiniLocalLayer[] = [],
    anchorOffset?: MiniPoint,
    shouldPreserveVisualPoint = false,
  ): MiniRigNode[] {
    const rightAnchorOffset = anchorOffset ?? getMiniAvatarAnchorOffset(folder, optionId);
    const leftAnchorOffset = mirrorMiniPointX(rightAnchorOffset);
    const leftSocketPoint = shouldPreserveVisualPoint
      ? subtractMiniPoints(socketPoints.left, leftAnchorOffset)
      : socketPoints.left;
    const rightSocketPoint = shouldPreserveVisualPoint
      ? subtractMiniPoints(socketPoints.right, rightAnchorOffset)
      : socketPoints.right;

    return [
      {
        transform: createMiniNodeTransform(leftSocketPoint, leftTransform),
        layers: [
          ...this.createColorAndLineLocalLayers(folder, optionId, color, lineColor, zIndex, true, leftAnchorOffset),
          ...cloneMiniLocalLayers(extraLayers, true, leftAnchorOffset),
        ],
      },
      {
        transform: createMiniNodeTransform(rightSocketPoint, rightTransform),
        layers: [
          ...this.createColorAndLineLocalLayers(folder, optionId, color, lineColor, zIndex, false, rightAnchorOffset),
          ...cloneMiniLocalLayers(extraLayers, false, rightAnchorOffset),
        ],
      },
    ];
  }

  private createColorAndLineLocalLayers(
    folder: string,
    optionId: string,
    color: AvatarTintSource,
    lineColor: AvatarTintSource,
    zIndex: number,
    flipX = false,
    anchorOffset: MiniPoint = { x: 0, y: 0 },
    colorGradientSpace?: AvatarGradientCoordinateSpace,
  ): MiniLocalLayer[] {
    return [
      { folder, file: `${optionId}_color.png`, color, colorGradientSpace, x: anchorOffset.x, y: anchorOffset.y, zIndex, flipX },
      { folder, file: `${optionId}_line.png`, color: lineColor, x: anchorOffset.x, y: anchorOffset.y, zIndex: zIndex + 0.1, flipX },
    ].filter(layer => hasMiniAvatarAsset(layer.folder, layer.file));
  }

  private createMirroredColorOnlyLayers(
    folder: string,
    optionId: string,
    leftColor: AvatarTintSource,
    rightColor: AvatarTintSource | undefined,
    distance: number,
    y: number,
    zIndex: number,
    angle = 0,
  ): MiniLayer[] {
    const file = `${optionId}_color.png`;

    if (!hasMiniAvatarAsset(folder, file)) {
      return [];
    }

    return createMirroredMiniLayers(folder, file, leftColor, rightColor ?? leftColor, distance, y, zIndex, angle);
  }

  private createMirroredLineOnlyLayers(
    folder: string,
    optionId: string,
    color: AvatarTintSource,
    distance: number,
    y: number,
    zIndex: number,
    angle = 0,
    centerOffsetX = 0,
  ): MiniLayer[] {
    const file = `${optionId}_line.png`;

    if (!hasMiniAvatarAsset(folder, file)) {
      return [];
    }

    return createMirroredMiniLayers(folder, file, color, color, distance, y, zIndex, angle, centerOffsetX);
  }

  private createMirroredSingleFileLayers(
    folder: string,
    file: string,
    leftColor: AvatarTintSource,
    rightColor: AvatarTintSource | undefined,
    distance: number,
    y: number,
    zIndex: number,
    angle = 0,
  ): MiniLayer[] {
    if (!hasMiniAvatarAsset(folder, file)) {
      return [];
    }

    return createMirroredMiniLayers(folder, file, leftColor, rightColor ?? leftColor, distance, y, zIndex, angle);
  }

  private createUpperEyelidLayers(
    skinColor: AvatarTintSource,
    leftEyeColor: AvatarTintSource,
    rightEyeColor: AvatarTintSource,
    distance: number,
  ): MiniLayer[] {
    const lineColor = this.getPartLineTintSource('eyes.upperEyelid');

    if (this.pose.eyeExpression === 'smileBlink') {
      return this.createMirroredLineOnlyLayers('express/smile/upper_eyelid', '01', lineColor, distance, 0, 17);
    }

    return [
      ...this.createMirroredColorAndLineLayers('upper_eyelid', '01', skinColor, lineColor, distance, 0, 17),
      ...this.createMirroredSingleFileLayers('upper_eyelid', '01_deco.png', leftEyeColor, rightEyeColor, distance, 0, 17.2),
    ];
  }

  private createEyelidLayers(distance: number): MiniLayer[] {
    const folder = this.pose.eyeExpression === 'smileBlink'
      ? 'express/smile/eyelid'
      : 'eyelid';

    return this.createMirroredLineOnlyLayers(folder, '01', this.getPartLineTintSource('mini.eyelid'), distance, 0, 18);
  }

  private createAccessoryNodes(
    bases: Record<AccessoryRenderMode, MiniPoint>,
    accessoryRig: MiniAccessoryRigLayout,
    layerSlots?: readonly AccessoryLayerSlot[],
  ): MiniRigNode[] {
    return this.state.accessories.flatMap(accessory => {
      const definition = getAccessoryCategoryDefinition(accessory.category);
      const pose = getAccessoryPoseState(accessory, this.direction === 'back' ? 'chibiBack' : 'chibi');

      if (!isAccessoryInLayerSlots(pose.layerSlot, layerSlots)) {
        return [];
      }

      const base = bases[definition.renderMode];
      const optionId = formatMiniOptionId(accessory.optionId);
      const optionOffset = getMiniScaledOffset(getMiniAccessoryOptionOffset(accessoryRig, accessory.category, optionId));
      const zIndex = getMiniAccessoryZIndex(pose.layerSlot, pose.order);
      const folder = definition.assetFolder;

      if (definition.renderMode === 'mirrored') {
        return [
          this.createAccessorySideNode(accessory, folder, optionId, -1, base, optionOffset, zIndex, accessoryRig.mirroredDistance),
          this.createAccessorySideNode(accessory, folder, optionId, 1, base, optionOffset, zIndex, accessoryRig.mirroredDistance),
        ].filter((node): node is MiniRigNode => node !== null);
      }

      return [
        {
          transform: {
            x: base.x + optionOffset.x + pose.offsetX * MINI_PIXEL_SCALE,
            y: base.y + optionOffset.y + pose.offsetY * MINI_PIXEL_SCALE,
            angle: pose.rotate,
            scale: pose.scale,
            flipX: pose.flipX,
          },
          layers: this.createAccessoryImageLayers(
            folder,
            optionId,
            resolveAccessoryColorFileName(accessory.category, accessory.optionId, accessory.colorVariantId),
            accessory.colorGradient ?? accessory.color ?? definition.defaultColor,
            accessory.lineColorGradient ?? accessory.lineColor ?? definition.defaultLineColor,
            zIndex,
            accessory.colorGradientSpace,
          ),
        },
      ];
    });
  }

  private createAccessorySideNode(
    accessory: AvatarAccessoryInstance,
    folder: string,
    optionId: string,
    side: -1 | 1,
    base: MiniPoint,
    optionOffset: MiniPoint,
    zIndex: number,
    mirroredDistance: number,
  ): MiniRigNode | null {
    const definition = getAccessoryCategoryDefinition(accessory.category);
    const pose = getAccessoryPoseState(accessory, this.direction === 'back' ? 'chibiBack' : 'chibi');

    if ((side === -1 && pose.leftVisible === false) || (side === 1 && pose.rightVisible === false)) {
      return null;
    }

    return {
      transform: {
        x: base.x + side * (mirroredDistance + optionOffset.x + pose.offsetX * MINI_PIXEL_SCALE),
        y: base.y + optionOffset.y + pose.offsetY * MINI_PIXEL_SCALE,
        angle: side * pose.rotate,
        scale: pose.scale,
        flipX: getMiniMirroredAccessoryFlipX(side, pose.flipX),
      },
      layers: this.createAccessoryImageLayers(
        folder,
        optionId,
        resolveAccessoryColorFileName(accessory.category, accessory.optionId, accessory.colorVariantId),
        accessory.colorGradient ?? accessory.color ?? definition.defaultColor,
        accessory.lineColorGradient ?? accessory.lineColor ?? definition.defaultLineColor,
        zIndex,
        accessory.colorGradientSpace,
      ),
    };
  }

  private createAccessoryImageLayers(
    folder: string,
    optionId: string,
    colorFile: string,
    color: AvatarTintSource,
    lineColor: AvatarTintSource,
    zIndex: number,
    colorGradientSpace?: AvatarGradientCoordinateSpace,
  ): MiniLocalLayer[] {
    return [
      { folder, file: colorFile, color, colorGradientSpace, zIndex },
      { folder, file: `${optionId}_line.png`, color: lineColor, zIndex: zIndex + 0.1 },
    ].filter(layer => hasMiniAvatarAsset(layer.folder, layer.file));
  }

  private getPartOptionId(key: AvatarPartKey): number {
    return this.state[key].optionId;
  }

  private getPartColor(key: AvatarPartKey, fallbackColor: string): AvatarTintSource {
    return this.state[key].colorGradient ?? this.state[key].color ?? fallbackColor;
  }

  private getPartSecondaryTintSource(key: AvatarPartKey, fallbackColor: AvatarTintSource): AvatarTintSource {
    return this.state[key].secondaryColorGradient ?? this.state[key].secondaryColor ?? fallbackColor;
  }

  private getPartLineTintSource(key: AvatarPartKey): AvatarTintSource {
    return this.state[key].lineColorGradient ?? this.state[key].lineColor ?? MINI_FRONT_IDLE_RIG_LAYOUT.colors.line;
  }

  private getPartColorGradientSpace(key: AvatarPartKey): AvatarGradientCoordinateSpace | undefined {
    return this.state[key].colorGradientSpace;
  }

  private getEditablePartColor(key: AvatarPartKey, fallbackColor: string): AvatarTintSource | undefined {
    return this.isPartColorEditable(key) ? this.getPartColor(key, fallbackColor) : undefined;
  }

  private isPartColorEditable(key: AvatarPartKey): boolean {
    return isAvatarPartOptionColorEditable(key, this.getPartOptionId(key));
  }

  private isPartVisible(key: AvatarPartKey): boolean {
    return this.state[key].isVisible !== false;
  }

  private getPartLayerOrder(key: AvatarPartKey): number {
    return this.state[key].layerOrder ?? (key === 'mini.clothingTop' ? 1 : 0);
  }

  private resolveOptionId(folder: string, requestedOptionId: number): string {
    const requestedId = formatMiniOptionId(requestedOptionId);

    if (hasMiniAvatarAsset(folder, `${requestedId}_color.png`) || hasMiniAvatarAsset(folder, `${requestedId}_line.png`)) {
      return requestedId;
    }

    return getFirstAvailableMiniOptionId(folder) ?? '01';
  }

  private getPoseNodeTransform(nodeKey: keyof NonNullable<MiniPose['nodes']>): MiniTransform {
    return this.pose.nodes?.[nodeKey] ?? {};
  }
}

class MiniSideIdleLayerRenderer {
  private readonly state: AvatarState;
  private readonly pose: MiniPose;

  constructor(state: AvatarState, pose: MiniPose) {
    this.state = state;
    this.pose = pose;
  }

  async createLayers(): Promise<MiniLayer[]> {
    const rig = MINI_SIDE_IDLE_RIG_LAYOUT;
    const bodyOptionId = this.resolveOptionId('body/side', this.getPartOptionId('mini.bodyType') || rig.bodyTypeId);
    const bodyTypeId = Number(bodyOptionId);
    const skinColor = this.getPartColor('face', rig.colors.skin);
    const skinLineColor = this.getPartLineTintSource('face');
    const topId = resolveMiniDirectoryOptionId('clothing/tops', this.getPartOptionId('mini.clothingTop'));
    const bottomId = resolveMiniDirectoryOptionId('clothing/bottoms', this.getPartOptionId('mini.clothingBottom'));
    const backHairBottomId = this.resolveOptionId('back_hair_bottom/side', this.getPartOptionId('hair.backHair'));
    const backHairTopId = this.resolveOptionId('back_hair_top/side', this.getPartOptionId('hair.topHair'));
    const bangsId = this.resolveOptionId('bangs/side', this.getPartOptionId('hair.bangs'));
    const earId = this.resolveOptionId('ear/side', this.getPartOptionId('ear'));
    const hairLightId = formatMiniOptionId(this.getPartOptionId('hair.light'));
    const hairLightFolder = getMiniHairLightFolder('side', hairLightId);
    const hairLightPositionState = this.state['mini.hairLightSide'];
    const bodyRig = rig.bodyByType[bodyTypeId] ?? rig.bodyByType[1];
    const defaultHeadCenter = getMiniCanvasPoint(rig.headCenter);
    const bodyCenter = await getMiniBodyCenter(rig, bodyRig);
    const defaultBodyCenter = getMiniCanvasPoint(rig.bodyCenter);
    const bodyBaselineShiftY = bodyCenter.y - defaultBodyCenter.y;
    const headCenter = {
      ...defaultHeadCenter,
      y: defaultHeadCenter.y + bodyBaselineShiftY,
    };
    const bodyOffset = getMiniScaledOffset(bodyRig.body);
    const legOffset = getMiniScaledOffset(bodyRig.legOffset);
    const legAnchorOffset = getMiniAvatarAnchorOffset('leg/side', '01', bodyTypeId);
    const rearLegOffset = addMiniPoints(
      addMiniPoints(legOffset, getMiniScaledOffset({ x: bodyRig.legDistance, y: 0 })),
      getMiniScaledOffset(bodyRig.rearLegOffset ?? { x: 0, y: 1 }),
    );
    const armIdleSocketOffset = getMiniScaledOffset(bodyRig.armIdleSocketOffset ?? bodyRig.armIdleOffset);
    const armIdleAnchorOffset = getMiniAvatarAnchorOffset('arm_idle/side', '01', bodyTypeId);
    const faceOffset = getMiniScaledOffset(rig.face);
    const earOffset = getMiniScaledOffset(rig.ear);
    const backHairBottomOffset = getMiniScaledOffset(addMiniPoints(
      rig.hair.backHairBottom,
      getMiniOptionOffset(rig.hair.backHairBottomByOption, backHairBottomId),
    ));
    const backHairTopOffset = getMiniScaledOffset(addMiniPoints(
      rig.hair.backHairTop,
      getMiniOptionOffset(rig.hair.backHairTopByOption, backHairTopId),
    ));
    const bangsOffset = getMiniScaledOffset(addMiniPoints(
      rig.hair.bangs,
      getMiniOptionOffset(rig.hair.bangsByOption, bangsId),
    ));
    const hairLightOffset = getMiniScaledOffset(addMiniPoints(rig.hair.hairLight, {
      x: hairLightPositionState.offsetX ?? 0,
      y: hairLightPositionState.offsetY ?? 0,
    }));
    const topBodyOffset = getMiniScaledOffset(rig.clothing.topBody);
    const topArmOffset = getMiniScaledOffset(rig.clothing.topArm);
    const bottomAnchorOffset = getMiniScaledOffset(bodyRig.bottomAnchor);
    const bottomOffset = getMiniScaledOffset(rig.clothing.bottom);
    const scleraOffset = getMiniScaledOffset(rig.eyes.sclera);
    const lowerEyelidOffset = getMiniScaledOffset(rig.eyes.lowerEyelid);
    const eyeBallOffset = getMiniScaledOffset(rig.eyes.eyeBall);
    const eyeLightOffset = getMiniScaledOffset(rig.eyes.eyeLight);
    const upperLidOffset = getMiniScaledOffset(rig.eyes.upperEyeLid);
    const eyelidOffset = getMiniScaledOffset(rig.eyes.eyelid ?? rig.eyes.upperEyeLid);
    const upperLidPoseOffsetY = (this.state['mini.upperEyelid'].offsetY ?? 0) * MINI_PIXEL_SCALE;
    const upperLidAngle = this.state['mini.upperEyelid'].rotate ?? 0;
    const eyebrowOffset = getMiniScaledOffset(rig.eyes.eyebrow);
    const upperLidY = upperLidOffset.y + upperLidPoseOffsetY;
    const eyelidY = eyelidOffset.y + upperLidPoseOffsetY;
    const eyeLightState = this.state['mini.eyeLight'];
    const eyeLightX = eyeLightOffset.x + (eyeLightState.offsetX ?? 0) * MINI_PIXEL_SCALE;
    const eyeLightY = eyeLightOffset.y + (eyeLightState.offsetY ?? 0) * MINI_PIXEL_SCALE;
    const eyeColor = this.getPartColor('eyes.color', rig.colors.eyeBall);
    const scleraColor = this.getPartColor('eyes.sclera', rig.colors.sclera);
    const topColor = this.getEditablePartColor('mini.clothingTop', rig.colors.clothingTop);
    const topLineColor = this.getPartLineTintSource('mini.clothingTop');
    const bottomColor = this.getEditablePartColor('mini.clothingBottom', rig.colors.clothingBottom);
    const bottomLineColor = this.getPartLineTintSource('mini.clothingBottom');
    const bottomDecoColor = this.getPartSecondaryColor('mini.clothingBottom', rig.colors.clothingBottomSideDeco);
    const isTopVisible = this.isPartVisible('mini.clothingTop') && topId !== null;
    const isBottomVisible = this.isPartVisible('mini.clothingBottom') && bottomId !== null;
    const topBodyZIndex = getMiniClothingBodyZIndex(this.getPartLayerOrder('mini.clothingTop'));
    const bottomZIndex = getMiniClothingBodyZIndex(this.getPartLayerOrder('mini.clothingBottom'));
    const isSmileBlinkFrame = this.pose.eyeExpression === 'smileBlink';
    const topArmLayers = isTopVisible
      ? this.createNamedColorAndLineLocalLayers(
        `clothing/tops/${topId}/side`,
        'side_arm_color.png',
        'side_arm_line.png',
        topColor,
        topLineColor,
        3.2,
        topArmOffset.x,
        topArmOffset.y,
      )
      : [];
    const clothingLayers = [
      ...(isTopVisible
        ? this.createNamedColorAndLineLayers(
          `clothing/tops/${topId}/side`,
          `side_body_${bodyOptionId}_color.png`,
          `side_body_${bodyOptionId}_line.png`,
          topColor,
          topLineColor,
          bodyOffset.x + topBodyOffset.x,
          bodyOffset.y + topBodyOffset.y,
          topBodyZIndex,
        )
        : []),
      ...(isBottomVisible
        ? [
          ...this.createNamedColorAndLineLayers(
            `clothing/bottoms/${bottomId}/side`,
            'side_color.png',
            'side_line.png',
            bottomColor,
            bottomLineColor,
            bottomAnchorOffset.x + bottomOffset.x,
            bottomAnchorOffset.y + bottomOffset.y,
            bottomZIndex,
          ),
          ...this.createNamedSingleFileLayers(
            `clothing/bottoms/${bottomId}/side`,
            'side_deco.png',
            bottomDecoColor,
            bottomAnchorOffset.x + bottomOffset.x,
            bottomAnchorOffset.y + bottomOffset.y,
            bottomZIndex + 0.02,
          ),
        ]
        : []),
    ];
    const bodyNode: MiniRigNode = {
      transform: createMiniNodeTransform(bodyCenter, this.getPoseNodeTransform('body')),
      children: [
        {
          transform: this.getPoseNodeTransform('legsGroup'),
          children: [
            {
              transform: createMiniAnchoredNodeTransform(rearLegOffset, legAnchorOffset, this.getPoseNodeTransform('rightLeg')),
              layers: this.createColorAndLineLocalLayers('leg', '01', skinColor, skinLineColor, 0, false, legAnchorOffset),
            },
            {
              transform: createMiniAnchoredNodeTransform(legOffset, legAnchorOffset, this.getPoseNodeTransform('leftLeg')),
              layers: this.createColorAndLineLocalLayers('leg', '01', skinColor, skinLineColor, 0.2, false, legAnchorOffset),
            },
          ],
        },
        {
          transform: this.getPoseNodeTransform('bodyGroup'),
          layers: [
            ...this.createColorAndLineLayers('body/side', bodyOptionId, skinColor, skinLineColor, bodyOffset.x, bodyOffset.y, 2),
          ],
          children: [
            { layers: clothingLayers },
            {
              transform: createMiniNodeTransform(armIdleSocketOffset, this.getPoseNodeTransform('leftArm')),
              layers: [
                ...this.createColorAndLineLocalLayers('arm_idle/side', '01', skinColor, skinLineColor, 3, false, armIdleAnchorOffset),
                ...cloneMiniLocalLayers(topArmLayers, false, armIdleAnchorOffset),
              ],
            },
          ],
        },
      ],
    };
    const headTransform = createMiniNodeTransform(headCenter, this.getPoseNodeTransform('head'));
    const eyesNode: MiniRigNode = {
      transform: this.getPoseNodeTransform('eyes'),
      layers: isSmileBlinkFrame
        ? []
        : [
          ...this.createColorOnlyLayers('sclera/side', '01', scleraColor, scleraOffset.x, scleraOffset.y, 13.9),
          ...this.createLineOnlyLayers('lower_eyelid/side', '01', this.getPartLineTintSource('eyes.lowerEyelid'), lowerEyelidOffset.x, lowerEyelidOffset.y, 14),
          ...this.createColorOnlyLayers('eye_ball/side', '01', eyeColor, eyeBallOffset.x, eyeBallOffset.y, 15),
          ...this.createLineOnlyLayers('eye_light', '01', rig.colors.eyeLight, eyeLightX, eyeLightY, 16),
        ],
      children: [
        {
          transform: createMiniNodeTransform(
            { x: upperLidOffset.x, y: upperLidY },
            {
              ...this.getPoseNodeTransform('upperEyelid'),
              angle: upperLidAngle + (this.getPoseNodeTransform('upperEyelid').angle ?? 0),
            },
          ),
          layers: this.createSideUpperEyelidLayers(skinColor, eyeColor),
        },
        {
          transform: createMiniNodeTransform(
            { x: eyelidOffset.x, y: eyelidY },
            this.getPoseNodeTransform('eyelid'),
          ),
          layers: this.createSideEyelidLayers(),
        },
        {
          transform: this.getPoseNodeTransform('eyebrow'),
          layers: this.createLineOnlyLayers('eyebrow/side', '01', this.getPartLineTintSource('eyes.eyebrow'), eyebrowOffset.x, eyebrowOffset.y, 19),
        },
      ],
    };
    const headBackNode: MiniRigNode = {
      transform: headTransform,
      precompose: true,
      precomposeZIndex: MINI_HEAD_BACK_Z_INDEX,
      children: this.createAccessoryNodes(rig, ['behindBody']),
    };
    const headOnSkinNode: MiniRigNode = {
      transform: headTransform,
      precompose: true,
      precomposeZIndex: MINI_HEAD_ON_SKIN_Z_INDEX,
      children: this.createAccessoryNodes(rig, ['onSkin']),
    };
    const headBodyFrontNode: MiniRigNode = {
      transform: headTransform,
      precompose: true,
      precomposeZIndex: MINI_HEAD_BODY_FRONT_Z_INDEX,
      children: this.createAccessoryNodes(rig, ['frontBody']),
    };
    const headMainNode: MiniRigNode = {
      transform: headTransform,
      precompose: true,
      precomposeZIndex: MINI_HEAD_MAIN_Z_INDEX,
      layers: [
        ...this.createColorAndLineLayers('face/side', '01', skinColor, skinLineColor, faceOffset.x, faceOffset.y, 13),
        ...this.createColorAndLineLayers('back_hair_bottom/side', backHairBottomId, this.getPartColor('hair.backHair', rig.colors.hair), this.getPartLineTintSource('hair.backHair'), backHairBottomOffset.x, backHairBottomOffset.y, 13.2, this.getPartColorGradientSpace('hair.backHair')),
        ...this.createColorAndLineLayers('back_hair_top/side', backHairTopId, this.getPartColor('hair.topHair', rig.colors.hair), this.getPartLineTintSource('hair.topHair'), backHairTopOffset.x, backHairTopOffset.y, 13.5, this.getPartColorGradientSpace('hair.topHair')),
        ...this.createColorAndLineLayers('ear/side', earId, skinColor, skinLineColor, earOffset.x, earOffset.y, 13.8),
      ],
      children: [eyesNode],
    };
    const headFrontFaceNode: MiniRigNode = {
      transform: headTransform,
      precompose: true,
      precomposeZIndex: MINI_HEAD_FRONT_FACE_Z_INDEX,
      children: this.createAccessoryNodes(rig, ['frontFace']),
    };
    const headBangsNode: MiniRigNode = {
      transform: headTransform,
      precompose: true,
      precomposeZIndex: MINI_HEAD_BANGS_Z_INDEX,
      layers: [
        ...this.createColorAndLineLayers('bangs/side', bangsId, this.getPartColor('hair.bangs', rig.colors.hair), this.getPartLineTintSource('hair.bangs'), bangsOffset.x, bangsOffset.y, 30, this.getPartColorGradientSpace('hair.bangs')),
        ...this.createLineOnlyLayers(hairLightFolder, hairLightId, this.getPartColor('hair.light', rig.colors.hairLight), hairLightOffset.x, hairLightOffset.y, 31),
      ],
    };
    const headFrontBangsNode: MiniRigNode = {
      transform: headTransform,
      precompose: true,
      precomposeZIndex: MINI_HEAD_FRONT_BANGS_Z_INDEX,
      children: this.createAccessoryNodes(rig, ['frontBangs']),
    };
    const rootNode: MiniRigNode = {
      children: [
        headBackNode,
        bodyNode,
        headOnSkinNode,
        headBodyFrontNode,
        headMainNode,
        headFrontFaceNode,
        headBangsNode,
        headFrontBangsNode,
      ],
    };

    return flattenMiniRigNode(rootNode);
  }

  private createColorAndLineLayers(
    folder: string,
    optionId: string,
    color: AvatarTintSource,
    lineColor: AvatarTintSource,
    x: number,
    y: number,
    zIndex: number,
    colorGradientSpace?: AvatarGradientCoordinateSpace,
  ): MiniLayer[] {
    return [
      { folder, file: `${optionId}_color.png`, color, colorGradientSpace, x, y, zIndex },
      { folder, file: `${optionId}_line.png`, color: lineColor, x, y, zIndex: zIndex + 0.1 },
    ].filter(layer => hasMiniAvatarAsset(layer.folder, layer.file));
  }

  private createColorOnlyLayers(
    folder: string,
    optionId: string,
    color: AvatarTintSource,
    x: number,
    y: number,
    zIndex: number,
  ): MiniLayer[] {
    const file = `${optionId}_color.png`;
    return hasMiniAvatarAsset(folder, file)
      ? [{ folder, file, color, x, y, zIndex }]
      : [];
  }

  private createLineOnlyLayers(
    folder: string,
    optionId: string,
    color: AvatarTintSource,
    x: number,
    y: number,
    zIndex: number,
  ): MiniLayer[] {
    const file = `${optionId}_line.png`;
    return hasMiniAvatarAsset(folder, file)
      ? [{ folder, file, color, x, y, zIndex }]
      : [];
  }

  private createNamedColorAndLineLayers(
    folder: string,
    colorFile: string,
    lineFile: string,
    color: AvatarTintSource | undefined,
    lineColor: AvatarTintSource | undefined,
    x: number,
    y: number,
    zIndex: number,
  ): MiniLayer[] {
    return [
      { folder, file: colorFile, color, x, y, zIndex },
      { folder, file: lineFile, color: lineColor, x, y, zIndex: zIndex + MINI_CLOTHING_LINE_Z_OFFSET },
    ].filter(layer => hasMiniAvatarAsset(layer.folder, layer.file));
  }

  private createNamedSingleFileLayers(
    folder: string,
    file: string,
    color: AvatarTintSource | undefined,
    x: number,
    y: number,
    zIndex: number,
  ): MiniLayer[] {
    return hasMiniAvatarAsset(folder, file)
      ? [{ folder, file, color, x, y, zIndex }]
      : [];
  }

  private createNamedColorAndLineLocalLayers(
    folder: string,
    colorFile: string,
    lineFile: string,
    color: AvatarTintSource | undefined,
    lineColor: AvatarTintSource | undefined,
    zIndex: number,
    x = 0,
    y = 0,
  ): MiniLocalLayer[] {
    return [
      { folder, file: colorFile, color, x, y, zIndex },
      { folder, file: lineFile, color: lineColor, x, y, zIndex: zIndex + MINI_CLOTHING_LINE_Z_OFFSET },
    ].filter(layer => hasMiniAvatarAsset(layer.folder, layer.file));
  }

  private createColorAndLineLocalLayers(
    folder: string,
    optionId: string,
    color: AvatarTintSource,
    lineColor: AvatarTintSource,
    zIndex: number,
    flipX = false,
    anchorOffset: MiniPoint = { x: 0, y: 0 },
    colorGradientSpace?: AvatarGradientCoordinateSpace,
  ): MiniLocalLayer[] {
    return [
      { folder, file: `${optionId}_color.png`, color, colorGradientSpace, x: anchorOffset.x, y: anchorOffset.y, zIndex, flipX },
      { folder, file: `${optionId}_line.png`, color: lineColor, x: anchorOffset.x, y: anchorOffset.y, zIndex: zIndex + 0.1, flipX },
    ].filter(layer => hasMiniAvatarAsset(layer.folder, layer.file));
  }

  private createSideUpperEyelidLayers(skinColor: AvatarTintSource, eyeColor: AvatarTintSource): MiniLayer[] {
    const lineColor = this.getPartLineTintSource('eyes.upperEyelid');

    if (this.pose.eyeExpression === 'smileBlink') {
      return this.createLineOnlyLayers('express/smile/upper_eyelid/side', '01', lineColor, 0, 0, 17);
    }

    return [
      ...this.createColorAndLineLayers('upper_eyelid/side', '01', skinColor, lineColor, 0, 0, 17),
      ...this.createNamedSingleFileLayers('upper_eyelid/side', '01_deco.png', eyeColor, 0, 0, 17.2),
    ];
  }

  private createSideEyelidLayers(): MiniLayer[] {
    const folder = this.pose.eyeExpression === 'smileBlink'
      ? 'express/smile/eyelid/side'
      : 'eyelid/side';

    return this.createLineOnlyLayers(folder, '01', this.getPartLineTintSource('mini.eyelid'), 0, 0, 18);
  }

  private createAccessoryNodes(rig: MiniIdleRigLayout, layerSlots?: readonly AccessoryLayerSlot[]): MiniRigNode[] {
    return this.state.accessories.flatMap(accessory => {
      const definition = getAccessoryCategoryDefinition(accessory.category);
      const pose = getAccessoryPoseState(accessory, 'chibiSide');

      if (!isAccessoryInLayerSlots(pose.layerSlot, layerSlots)) {
        return [];
      }

      const optionId = formatMiniOptionId(accessory.optionId);
      const zIndex = getMiniAccessoryZIndex(pose.layerSlot, pose.order);
      const folder = getMiniSideFolderWithFallback(definition.assetFolder, optionId);
      const optionOffset = getMiniScaledOffset(getMiniAccessoryOptionOffset(rig.accessories, accessory.category, optionId));
      const baseOffset = definition.renderMode === 'mirrored'
        ? rig.accessories.mirrored
        : rig.accessories.center;
      const base = getMiniScaledOffset(baseOffset);

      if (definition.renderMode === 'mirrored' && pose.leftVisible === false && pose.rightVisible === false) {
        return [];
      }

      return [{
        transform: {
          x: base.x + optionOffset.x + pose.offsetX * MINI_PIXEL_SCALE,
          y: base.y + optionOffset.y + pose.offsetY * MINI_PIXEL_SCALE,
          angle: pose.rotate,
          scale: pose.scale,
          flipX: pose.flipX,
        },
        layers: this.createAccessoryImageLayers(
          folder,
          optionId,
          resolveAccessoryColorFileName(accessory.category, accessory.optionId, accessory.colorVariantId),
          accessory.colorGradient ?? accessory.color ?? definition.defaultColor,
          accessory.lineColorGradient ?? accessory.lineColor ?? definition.defaultLineColor,
          zIndex,
          accessory.colorGradientSpace,
        ),
      }];
    });
  }

  private createAccessoryImageLayers(
    folder: string,
    optionId: string,
    colorFile: string,
    color: AvatarTintSource,
    lineColor: AvatarTintSource,
    zIndex: number,
    colorGradientSpace?: AvatarGradientCoordinateSpace,
  ): MiniLocalLayer[] {
    return [
      { folder, file: colorFile, color, colorGradientSpace, zIndex },
      { folder, file: `${optionId}_line.png`, color: lineColor, zIndex: zIndex + 0.1 },
    ].filter(layer => hasMiniAvatarAsset(layer.folder, layer.file));
  }

  private getPartOptionId(key: AvatarPartKey): number {
    return this.state[key].optionId;
  }

  private getPartColor(key: AvatarPartKey, fallbackColor: string): AvatarTintSource {
    return this.state[key].colorGradient ?? this.state[key].color ?? fallbackColor;
  }

  private getPartSecondaryColor(key: AvatarPartKey, fallbackColor: string): string {
    return this.state[key].secondaryColor ?? fallbackColor;
  }

  private getPartLineTintSource(key: AvatarPartKey): AvatarTintSource {
    return this.state[key].lineColorGradient ?? this.state[key].lineColor ?? MINI_SIDE_IDLE_RIG_LAYOUT.colors.line;
  }

  private getPartColorGradientSpace(key: AvatarPartKey): AvatarGradientCoordinateSpace | undefined {
    return this.state[key].colorGradientSpace;
  }

  private getEditablePartColor(key: AvatarPartKey, fallbackColor: string): AvatarTintSource | undefined {
    return this.isPartColorEditable(key) ? this.getPartColor(key, fallbackColor) : undefined;
  }

  private isPartColorEditable(key: AvatarPartKey): boolean {
    return isAvatarPartOptionColorEditable(key, this.getPartOptionId(key));
  }

  private isPartVisible(key: AvatarPartKey): boolean {
    return this.state[key].isVisible !== false;
  }

  private getPartLayerOrder(key: AvatarPartKey): number {
    return this.state[key].layerOrder ?? (key === 'mini.clothingTop' ? 1 : 0);
  }

  private resolveOptionId(folder: string, requestedOptionId: number): string {
    const requestedId = formatMiniOptionId(requestedOptionId);

    if (hasMiniAvatarAsset(folder, `${requestedId}_color.png`) || hasMiniAvatarAsset(folder, `${requestedId}_line.png`)) {
      return requestedId;
    }

    return getFirstAvailableMiniOptionId(folder) ?? '01';
  }

  private getPoseNodeTransform(nodeKey: keyof NonNullable<MiniPose['nodes']>): MiniTransform {
    return this.pose.nodes?.[nodeKey] ?? {};
  }
}

function createMirroredMiniLayers(
  folder: string,
  file: string,
  leftColor: AvatarTintSource | undefined,
  rightColor: AvatarTintSource | undefined,
  distance: number,
  y: number,
  zIndex: number,
  angle = 0,
  centerOffsetX = 0,
): MiniLayer[] {
  return [
    {
      folder,
      file,
      color: leftColor,
      x: centerOffsetX - distance,
      y,
      zIndex,
      angle: -angle,
      flipX: true,
    },
    {
      folder,
      file,
      color: rightColor,
      x: centerOffsetX + distance,
      y,
      zIndex,
      angle,
    },
  ];
}

function createMiniNodeTransform(basePoint: MiniPoint, transform: MiniTransform = {}): MiniTransform {
  return {
    ...transform,
    x: basePoint.x + (transform.x ?? 0),
    y: basePoint.y + (transform.y ?? 0),
  };
}

function createMiniAnchoredNodeTransform(
  visualPoint: MiniPoint,
  anchorOffset: MiniPoint,
  transform: MiniTransform = {},
): MiniTransform {
  return createMiniNodeTransform(subtractMiniPoints(visualPoint, anchorOffset), transform);
}

function getMiniArmIdleSocketPoints(
  bodyRig: MiniBodyRigLayout,
  armIdleOffset: MiniPoint,
  armIdleAnchorOffset: MiniPoint,
): MiniMirroredSocketPoints {
  const socketOffset = bodyRig.armIdleSocketOffset
    ? getMiniScaledOffset(bodyRig.armIdleSocketOffset)
    : { x: 0, y: armIdleOffset.y - armIdleAnchorOffset.y };
  const socketDistance = (
    bodyRig.armIdleSocketDistance ?? bodyRig.armIdleDistance + armIdleOffset.x - armIdleAnchorOffset.x
  ) + socketOffset.x;
  const fallbackSocketPoints = createMirroredMiniSocketPoints(socketDistance, socketOffset.y);

  return {
    left: bodyRig.armIdleLeftSocket ?? fallbackSocketPoints.left,
    right: bodyRig.armIdleRightSocket ?? fallbackSocketPoints.right,
  };
}

function createMirroredMiniSocketPoints(distance: number, y: number): MiniMirroredSocketPoints {
  return {
    left: { x: -distance, y },
    right: { x: distance, y },
  };
}

function cloneMiniLocalLayers(
  layers: MiniLocalLayer[],
  flipX = false,
  anchorOffset: MiniPoint = { x: 0, y: 0 },
): MiniLocalLayer[] {
  return layers.map(layer => ({
    ...layer,
    x: anchorOffset.x + (flipX ? -(layer.x ?? 0) : (layer.x ?? 0)),
    y: anchorOffset.y + (layer.y ?? 0),
    flipX: flipX ? layer.flipX !== true : layer.flipX,
  }));
}

function mirrorMiniPointX(point: MiniPoint): MiniPoint {
  return {
    x: -point.x,
    y: point.y,
  };
}

function addMiniPoints(firstPoint: MiniPoint, secondPoint: MiniPoint): MiniPoint {
  return {
    x: firstPoint.x + secondPoint.x,
    y: firstPoint.y + secondPoint.y,
  };
}

function subtractMiniPoints(firstPoint: MiniPoint, secondPoint: MiniPoint): MiniPoint {
  return {
    x: firstPoint.x - secondPoint.x,
    y: firstPoint.y - secondPoint.y,
  };
}

async function getMiniBodyCenter(
  rig: MiniIdleRigLayout,
  selectedBodyRig: MiniBodyRigLayout,
): Promise<MiniPoint> {
  const defaultBodyCenter = getMiniCanvasPoint(rig.bodyCenter);
  const baselineBodyRig = rig.bodyByType[rig.baselineBodyTypeId] ?? rig.bodyByType[rig.bodyTypeId] ?? rig.bodyByType[1];
  const legFootOffset = await getMiniLegFootOffset();
  const feetBaselineY = defaultBodyCenter.y + getMiniScaledOffset(baselineBodyRig.legOffset).y + legFootOffset;
  const selectedLegOffset = getMiniScaledOffset(selectedBodyRig.legOffset);

  return {
    ...defaultBodyCenter,
    y: feetBaselineY - selectedLegOffset.y - legFootOffset,
  };
}

async function getMiniLegFootOffset(): Promise<number> {
  const legBounds = await getCombinedMiniContentBounds('leg', ['01_color.png', '01_line.png']);
  return getMiniBoundsBottomOffset(legBounds);
}

function getMiniOptionOffset(offsets: MiniOptionOffsetMap, optionId: string): MiniPoint {
  return offsets[Number(optionId)] ?? { x: 0, y: 0 };
}

function getMiniAccessoryOptionOffset(
  accessoryRig: MiniAccessoryRigLayout,
  category: AccessoryCategory,
  optionId: string,
): MiniPoint {
  return getMiniOptionOffset(accessoryRig.byCategoryOption[category], optionId);
}

function getMiniClothingBodyZIndex(layerOrder: number): number {
  return MINI_CLOTHING_BODY_Z_INDEX + layerOrder * MINI_CLOTHING_LAYER_Z_STEP;
}

function isAccessoryInLayerSlots(
  layerSlot: AccessoryLayerSlot,
  allowedLayerSlots?: readonly AccessoryLayerSlot[],
): boolean {
  return allowedLayerSlots === undefined || allowedLayerSlots.includes(layerSlot);
}

function getMiniAccessoryZIndex(layerSlot: AccessoryLayerSlot, order: number): number {
  const slotDefinition = getAccessoryLayerSlotDefinition(layerSlot);
  return (MINI_ACCESSORY_SLOT_Z_INDEX[slotDefinition.id] ?? slotDefinition.zIndex) + order * MINI_ACCESSORY_ORDER_STEP;
}

function getMiniMirroredAccessoryFlipX(
  side: -1 | 1,
  isUserFlipped: boolean,
): boolean {
  const sourceSide = 1;

  return side !== sourceSide ? !isUserFlipped : isUserFlipped;
}

function getMiniBackFolderWithFallback(folder: string, optionId: string): string {
  const backFolder = `${folder}/back`;
  const hasBackPair = hasMiniAvatarAsset(backFolder, `${optionId}_color.png`)
    && hasMiniAvatarAsset(backFolder, `${optionId}_line.png`);

  return hasBackPair ? backFolder : folder;
}

function resolveMiniBackAssetPair(
  folder: string,
  backColorFile: string,
  backLineFile: string,
  frontColorFile: string,
  frontLineFile: string,
  useBackAssets: boolean,
): MiniAssetPair {
  const backFolder = `${folder}/back`;
  const hasBackPair = useBackAssets
    && hasMiniAvatarAsset(backFolder, backColorFile)
    && hasMiniAvatarAsset(backFolder, backLineFile);

  return hasBackPair
    ? { folder: backFolder, colorFile: backColorFile, lineFile: backLineFile }
    : { folder, colorFile: frontColorFile, lineFile: frontLineFile };
}

function getMiniSideFolderWithFallback(folder: string, optionId: string): string {
  const sideFolder = `${folder}/side`;

  if (hasMiniAvatarAsset(sideFolder, `${optionId}_color.png`) || hasMiniAvatarAsset(sideFolder, `${optionId}_line.png`)) {
    return sideFolder;
  }

  return folder;
}

function getMiniHairLightFolder(direction: 'front' | 'back' | 'side', optionId: string): string {
  if (direction === 'front') {
    return 'hair_light';
  }

  const directionalFolder = `hair_light/${direction}`;
  return hasMiniAvatarAsset(directionalFolder, `${optionId}_line.png`)
    ? directionalFolder
    : 'hair_light';
}

function getMiniCanvasPoint(point: MiniPoint): MiniPoint {
  return {
    x: MINI_CENTER_X + point.x * MINI_PIXEL_SCALE,
    y: point.y,
  };
}

function getMiniScaledOffset(offset: MiniPoint): MiniPoint {
  return {
    x: offset.x * MINI_PIXEL_SCALE,
    y: offset.y * MINI_PIXEL_SCALE,
  };
}
