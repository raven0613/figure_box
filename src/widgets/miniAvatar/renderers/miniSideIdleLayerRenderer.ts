import type {
  AccessoryLayerSlot,
  AvatarState,
  AvatarTintSource,
} from '../../avatar/avatarTypes';
import {
  formatMiniOptionId,
  resolveMiniDirectoryOptionId,
} from '../miniAvatarAssets';
import {
  MINI_PIXEL_SCALE,
  MINI_SIDE_IDLE_RIG_LAYOUT,
} from '../miniAvatarRig';
import type {
  MiniIdleRigLayout,
  MiniLayer,
  MiniPose,
  MiniRigNode,
} from '../miniAvatarTypes';
import { flattenMiniRigNode } from '../miniAvatarTransform';
import { getMiniAvatarAnchorOffset } from '../miniAvatarAnchors';
import { MiniAccessoryNodeRenderer } from './miniAccessoryNodeRenderer';
import { MiniBaseIdleLayerRenderer } from './miniBaseIdleLayerRenderer';
import {
  MINI_HEAD_BACK_Z_INDEX,
  MINI_HEAD_BANGS_Z_INDEX,
  MINI_HEAD_BODY_FRONT_Z_INDEX,
  MINI_HEAD_FRONT_BANGS_Z_INDEX,
  MINI_HEAD_FRONT_FACE_Z_INDEX,
  MINI_HEAD_MAIN_Z_INDEX,
  MINI_HEAD_ON_SKIN_Z_INDEX,
} from './miniRendererConstants';
import {
  addMiniPoints,
  cloneMiniLocalLayers,
  createMiniAnchoredNodeTransform,
  createMiniNodeTransform,
  getMiniBodyCenter,
  getMiniCanvasPoint,
  getMiniClothingBodyZIndex,
  getMiniHairLightFolder,
  getMiniOptionOffset,
  getMiniScaledOffset,
} from './miniRendererUtils';

export class MiniSideIdleLayerRenderer extends MiniBaseIdleLayerRenderer {
  private readonly accessoryNodeRenderer: MiniAccessoryNodeRenderer;

  constructor(state: AvatarState, pose: MiniPose) {
    super(state, pose, MINI_SIDE_IDLE_RIG_LAYOUT.colors.line);
    this.accessoryNodeRenderer = new MiniAccessoryNodeRenderer(state, (...args) => this.createAccessoryImageLayers(...args));
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
    return this.accessoryNodeRenderer.createSideNodes(rig, layerSlots);
  }
}
