import {
  getAccessoryCategoryDefinition,
  getAccessoryLayerSlotDefinition,
  getAccessoryPoseState,
  isAvatarPartOptionColorEditable,
} from '../avatarCanvas';
import type {
  AccessoryLayerSlot,
  AccessoryRenderMode,
  AvatarAccessoryInstance,
  AvatarPartKey,
  AvatarState,
} from '../avatarCanvas';
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
  MINI_CENTER_X,
  MINI_CLOTHING_BODY_Z_INDEX,
  MINI_CLOTHING_LAYER_Z_STEP,
  MINI_CLOTHING_LINE_Z_OFFSET,
  MINI_DEFAULT_EYE_LIGHT_DISTANCE,
  MINI_FRONT_IDLE_RIG_LAYOUT,
  MINI_PIXEL_SCALE,
} from './miniAvatarRig';
import type {
  MiniBodyRigLayout,
  MiniFrontIdleRigLayout,
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

export async function createMiniFrontIdleLayers(state: AvatarState, pose: MiniPose = {}): Promise<MiniLayer[]> {
  return new MiniFrontIdleLayerRenderer(state, pose).createLayers();
}

class MiniFrontIdleLayerRenderer {
  private readonly state: AvatarState;
  private readonly pose: MiniPose;

  constructor(state: AvatarState, pose: MiniPose) {
    this.state = state;
    this.pose = pose;
  }

  async createLayers(): Promise<MiniLayer[]> {
    const rig = MINI_FRONT_IDLE_RIG_LAYOUT;
    const bodyOptionId = this.resolveOptionId('body', this.getPartOptionId('mini.bodyType') || rig.bodyTypeId);
    const bodyTypeId = Number(bodyOptionId);
    const skinColor = this.getPartColor('face', rig.colors.skin);
    const skinLineColor = this.getPartLineColor('face');
    const topId = resolveMiniDirectoryOptionId('clothing/tops', this.getPartOptionId('mini.clothingTop'));
    const bottomId = resolveMiniDirectoryOptionId('clothing/bottoms', this.getPartOptionId('mini.clothingBottom'));
    const backHairBottomId = this.resolveOptionId('back_hair_bottom', this.getPartOptionId('hair.backHair'));
    const backHairTopId = this.resolveOptionId('back_hair_top', this.getPartOptionId('hair.topHair'));
    const bangsId = this.resolveOptionId('bangs', this.getPartOptionId('hair.bangs'));
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
    const armIdleOffset = getMiniScaledOffset(bodyRig.armIdleOffset);
    const armIdleAnchorOffset = getMiniAvatarAnchorOffset('arm_idle', '01', bodyTypeId);
    const armIdleSocketPoints = getMiniArmIdleSocketPoints(bodyRig, armIdleOffset, armIdleAnchorOffset);
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
    const hairLightOffset = getMiniScaledOffset(rig.hair.hairLight);
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
      center: addMiniPoints(headCenter, getMiniScaledOffset(rig.accessories.center)),
      mirrored: addMiniPoints(headCenter, getMiniScaledOffset(rig.accessories.mirrored)),
    };
    const upperLidY = headCenter.y + upperLidOffset.y + upperLidPoseOffsetY;
    const eyeBallY = headCenter.y + eyeBallOffset.y;
    const eyeLightDistance = eyeLightState.lightDistance ?? MINI_DEFAULT_EYE_LIGHT_DISTANCE;
    const eyeLightOffsetX = (eyeLightState.offsetX ?? 0) * MINI_PIXEL_SCALE;
    const scleraColor = this.getPartColor('eyes.sclera', rig.colors.sclera);
    const leftEyeColor = this.getPartColor('eyes.color', rig.colors.eyeBall);
    const rightEyeColor = this.getPartSecondaryColor('eyes.color', leftEyeColor);
    const topColor = this.getEditablePartColor('mini.clothingTop', rig.colors.clothingTop);
    const topLineColor = this.getPartLineColor('mini.clothingTop');
    const bottomColor = this.getEditablePartColor('mini.clothingBottom', rig.colors.clothingBottom);
    const bottomLineColor = this.getPartLineColor('mini.clothingBottom');
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
    const clothingLayers = [
      ...(isTopVisible
        ? [
          ...this.createNamedColorAndLineLayers(
            `clothing/tops/${topId}`,
            `front_body_${bodyOptionId}_color.png`,
            `front_body_${bodyOptionId}_line.png`,
            topColor,
            topLineColor,
            bodyOffset.x + topBodyOffset.x,
            bodyOffset.y + topBodyOffset.y,
            topBodyZIndex,
          ),
        ]
        : []),
      ...(isBottomVisible
        ? this.createNamedColorAndLineLayers(
          `clothing/bottoms/${bottomId}`,
          'front_color.png',
          'front_line.png',
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
      layers: [
        ...this.createColorAndLineLayers('body', bodyOptionId, skinColor, skinLineColor, bodyOffset.x, bodyOffset.y, 2),
      ],
      children: [
        ...this.createMirroredColorAndLineNodes(
          'leg',
          '01',
          skinColor,
          skinLineColor,
          createMirroredMiniSocketPoints(bodyRig.legDistance, legOffset.y),
          0,
          this.getPoseNodeTransform('leftLeg'),
          this.getPoseNodeTransform('rightLeg'),
        ),
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
    };
    const headNode: MiniRigNode = {
      transform: createMiniNodeTransform(headCenter, this.getPoseNodeTransform('head')),
      layers: [
        ...this.createColorAndLineLayers('back_hair_bottom', backHairBottomId, this.getPartColor('hair.backHair', rig.colors.hair), this.getPartLineColor('hair.backHair'), backHairBottomOffset.x, backHairBottomOffset.y, 10),
        ...this.createColorAndLineLayers('face', '01', skinColor, skinLineColor, 0, 0, 13),
        ...this.createColorAndLineLayers('back_hair_top', backHairTopId, this.getPartColor('hair.topHair', rig.colors.hair), this.getPartLineColor('hair.topHair'), backHairTopOffset.x, backHairTopOffset.y, 13.5),
        ...this.createMirroredColorAndLineLayers('ear', '01', skinColor, skinLineColor, rig.earDistance + earOffset.x, earOffset.y, 13.8),
        ...this.createLineOnlyLayers('mouth', '01', this.getPartLineColor('mouth'), mouthOffset.x, mouthOffset.y, 20),
        ...this.createColorAndLineLayers('bangs', bangsId, this.getPartColor('hair.bangs', rig.colors.hair), this.getPartLineColor('hair.bangs'), bangsOffset.x, bangsOffset.y, 30),
        ...this.createLineOnlyLayers('hair_light', '01', rig.colors.hairLight, hairLightOffset.x, hairLightOffset.y, 31),
      ],
      children: [
        {
          transform: this.getPoseNodeTransform('eyes'),
          layers: isSmileBlinkFrame
            ? []
            : [
              ...this.createMirroredColorOnlyLayers('sclera', '01', scleraColor, scleraColor, rig.eyes.eyeDistance + scleraOffset.x, scleraOffset.y, 13.9),
              ...this.createMirroredColorAndLineLayers('lower_eyelid', '01', rig.colors.lowerEyelidColor, this.getPartLineColor('eyes.lowerEyelid'), rig.eyes.eyeDistance + lowerEyelidOffset.x, lowerEyelidOffset.y, 14),
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
              layers: this.createMirroredLineOnlyLayers('eyebrow', '01', this.getPartLineColor('eyes.eyebrow'), rig.eyes.eyeDistance + eyebrowOffset.x, eyebrowOffset.y, 19),
            },
          ],
        },
      ],
    };
    const rootNode: MiniRigNode = {
      children: [
        ...this.createAccessoryNodes(accessoryBases),
        bodyNode,
        headNode,
      ],
    };

    return flattenMiniRigNode(rootNode);
  }

  private createColorAndLineLayers(
    folder: string,
    optionId: string,
    color: string,
    lineColor: string,
    x: number,
    y: number,
    zIndex: number,
  ): MiniLayer[] {
    return [
      { folder, file: `${optionId}_color.png`, color, x, y, zIndex },
      { folder, file: `${optionId}_line.png`, color: lineColor, x, y, zIndex: zIndex + 0.1 },
    ].filter(layer => hasMiniAvatarAsset(layer.folder, layer.file));
  }

  private createNamedColorAndLineLayers(
    folder: string,
    colorFile: string,
    lineFile: string,
    color: string | undefined,
    lineColor: string | undefined,
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
    color: string | undefined,
    lineColor: string | undefined,
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
    color: string,
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
    color: string,
    lineColor: string,
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
    color: string,
    lineColor: string,
    socketPoints: MiniMirroredSocketPoints,
    zIndex: number,
    leftTransform: MiniTransform = {},
    rightTransform: MiniTransform = {},
    extraLayers: MiniLocalLayer[] = [],
    anchorOffset?: MiniPoint,
  ): MiniRigNode[] {
    const rightAnchorOffset = anchorOffset ?? getMiniAvatarAnchorOffset(folder, optionId);
    const leftAnchorOffset = mirrorMiniPointX(rightAnchorOffset);

    return [
      {
        transform: createMiniNodeTransform(socketPoints.left, leftTransform),
        layers: [
          ...this.createColorAndLineLocalLayers(folder, optionId, color, lineColor, zIndex, true, leftAnchorOffset),
          ...cloneMiniLocalLayers(extraLayers, true, leftAnchorOffset),
        ],
      },
      {
        transform: createMiniNodeTransform(socketPoints.right, rightTransform),
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
    color: string,
    lineColor: string,
    zIndex: number,
    flipX = false,
    anchorOffset: MiniPoint = { x: 0, y: 0 },
  ): MiniLocalLayer[] {
    return [
      { folder, file: `${optionId}_color.png`, color, x: anchorOffset.x, y: anchorOffset.y, zIndex, flipX },
      { folder, file: `${optionId}_line.png`, color: lineColor, x: anchorOffset.x, y: anchorOffset.y, zIndex: zIndex + 0.1, flipX },
    ].filter(layer => hasMiniAvatarAsset(layer.folder, layer.file));
  }

  private createMirroredColorOnlyLayers(
    folder: string,
    optionId: string,
    leftColor: string,
    rightColor: string | undefined,
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
    color: string,
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
    leftColor: string,
    rightColor: string | undefined,
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
    skinColor: string,
    leftEyeColor: string,
    rightEyeColor: string,
    distance: number,
  ): MiniLayer[] {
    const lineColor = this.getPartLineColor('eyes.upperEyelid');

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

    return this.createMirroredLineOnlyLayers(folder, '01', this.getPartLineColor('mini.eyelid'), distance, 0, 18);
  }

  private createAccessoryNodes(bases: Record<AccessoryRenderMode, MiniPoint>): MiniRigNode[] {
    return this.state.accessories.flatMap(accessory => {
      const definition = getAccessoryCategoryDefinition(accessory.category);
      const pose = getAccessoryPoseState(accessory, 'chibi');
      const base = bases[definition.renderMode];
      const optionId = formatMiniOptionId(accessory.optionId);
      const zIndex = getMiniAccessoryZIndex(pose.layerSlot, pose.order);
      const folder = definition.assetFolder;

      if (definition.renderMode === 'mirrored') {
        return [
          this.createAccessorySideNode(accessory, folder, optionId, -1, base, zIndex),
          this.createAccessorySideNode(accessory, folder, optionId, 1, base, zIndex),
        ].filter((node): node is MiniRigNode => node !== null);
      }

      return [
        {
          transform: {
            x: base.x + pose.offsetX * MINI_PIXEL_SCALE,
            y: base.y + pose.offsetY * MINI_PIXEL_SCALE,
            angle: pose.rotate,
            scale: pose.scale,
            flipX: pose.flipX,
          },
          layers: this.createAccessoryImageLayers(folder, optionId, accessory.color ?? definition.defaultColor, accessory.lineColor ?? definition.defaultLineColor, zIndex),
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
    zIndex: number,
  ): MiniRigNode | null {
    const definition = getAccessoryCategoryDefinition(accessory.category);
    const pose = getAccessoryPoseState(accessory, 'chibi');

    if ((side === -1 && pose.leftVisible === false) || (side === 1 && pose.rightVisible === false)) {
      return null;
    }

    return {
      transform: {
        x: base.x + side * (MINI_FRONT_IDLE_RIG_LAYOUT.accessories.mirroredDistance + pose.offsetX * MINI_PIXEL_SCALE),
        y: base.y + pose.offsetY * MINI_PIXEL_SCALE,
        angle: side * pose.rotate,
        scale: pose.scale,
        flipX: getMiniMirroredAccessoryFlipX(side, pose.flipX),
      },
      layers: this.createAccessoryImageLayers(folder, optionId, accessory.color ?? definition.defaultColor, accessory.lineColor ?? definition.defaultLineColor, zIndex),
    };
  }

  private createAccessoryImageLayers(
    folder: string,
    optionId: string,
    color: string,
    lineColor: string,
    zIndex: number,
  ): MiniLocalLayer[] {
    return [
      { folder, file: `${optionId}_color.png`, color, zIndex },
      { folder, file: `${optionId}_line.png`, color: lineColor, zIndex: zIndex + 0.1 },
    ].filter(layer => hasMiniAvatarAsset(layer.folder, layer.file));
  }

  private getPartOptionId(key: AvatarPartKey): number {
    return this.state[key].optionId;
  }

  private getPartColor(key: AvatarPartKey, fallbackColor: string): string {
    return this.state[key].color ?? fallbackColor;
  }

  private getPartSecondaryColor(key: AvatarPartKey, fallbackColor: string): string {
    return this.state[key].secondaryColor ?? fallbackColor;
  }

  private getPartLineColor(key: AvatarPartKey): string {
    return this.state[key].lineColor ?? MINI_FRONT_IDLE_RIG_LAYOUT.colors.line;
  }

  private getEditablePartColor(key: AvatarPartKey, fallbackColor: string): string | undefined {
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
  leftColor: string | undefined,
  rightColor: string | undefined,
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

async function getMiniBodyCenter(
  rig: MiniFrontIdleRigLayout,
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

function getMiniClothingBodyZIndex(layerOrder: number): number {
  return MINI_CLOTHING_BODY_Z_INDEX + layerOrder * MINI_CLOTHING_LAYER_Z_STEP;
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
