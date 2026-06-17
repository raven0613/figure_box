import type {
  AccessoryLayerSlot,
  AccessoryRenderMode,
  AvatarState,
  AvatarTintSource,
} from '../../avatar/avatarTypes';
import {
  formatMiniOptionId,
  resolveMiniDirectoryOptionId,
} from '../miniAvatarAssets';
import {
  MINI_ACCESSORY_SLOT_Z_INDEX,
  MINI_BACK_ACCESSORY_SLOT_Z_INDEX,
  MINI_BACK_IDLE_RIG_LAYOUT,
  MINI_DEFAULT_EYE_LIGHT_DISTANCE,
  MINI_FRONT_IDLE_RIG_LAYOUT,
  MINI_PIXEL_SCALE,
} from '../miniAvatarRig';
import type {
  MiniAccessoryRigLayout,
  MiniLayer,
  MiniPoint,
  MiniPose,
  MiniRigNode,
} from '../miniAvatarTypes';
import { flattenMiniRigNode } from '../miniAvatarTransform';
import { getMiniAvatarAnchorOffset } from '../miniAvatarAnchors';
import { MiniAccessoryNodeRenderer } from './miniAccessoryNodeRenderer';
import { MiniBaseIdleLayerRenderer } from './miniBaseIdleLayerRenderer';
import {
  MINI_BACK_HEAD_MAIN_Z_INDEX,
  MINI_HEAD_BANGS_Z_INDEX,
  MINI_HEAD_MAIN_Z_INDEX,
} from './miniRendererConstants';
import {
  addMiniPoints,
  createMiniNodeTransform,
  createMirroredMiniSocketPoints,
  getMiniArmIdleSocketPoints,
  getMiniBackFolderWithFallback,
  getMiniBodyCenter,
  getMiniCanvasPoint,
  getMiniClothingBodyZIndex,
  getMiniHairLightFolder,
  getMiniOptionOffset,
  getMiniScaledOffset,
  resolveMiniBackAssetPair,
} from './miniRendererUtils';

export class MiniFrontBackIdleLayerRenderer extends MiniBaseIdleLayerRenderer {
  private readonly direction: 'front' | 'back';
  private readonly accessoryNodeRenderer: MiniAccessoryNodeRenderer;

  constructor(state: AvatarState, pose: MiniPose, direction: 'front' | 'back') {
    super(state, pose, MINI_FRONT_IDLE_RIG_LAYOUT.colors.line);
    this.direction = direction;
    this.accessoryNodeRenderer = new MiniAccessoryNodeRenderer(state, (...args) => this.createAccessoryImageLayers(...args));
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
    return this.accessoryNodeRenderer.createFrontBackNodes(this.direction, bases, accessoryRig, layerSlots);
  }
}
