import { FabricObject, FabricText, Gradient, Group, Rect } from 'fabric';
import { SCALE_X, SCALE_Y } from '~/constants/canvas';
import i18n from '~/i18n';
import { CanvasTag } from '~/services/canvasCtxService';
import { imageService } from '~/services/imageService';
import { BaseWidget } from './base';

export enum ErrorType {
  RECONNECT = 'RECONNECT',
  CLOSE = 'CLOSE',
}

interface ErrorMsgItems {
  title: string;
  description: string;
  errorType: ErrorType;
}

const errorDescriptionHeight: { [key in ErrorType]: number } = {
  [ErrorType.RECONNECT]: 160,
  [ErrorType.CLOSE]: 240,
};

export class ErrorPopUp extends BaseWidget {
  private errorButton: FabricObject;

  constructor({ title, description, errorType }: ErrorMsgItems) {
    const dialogBgShape = imageService.getPreloadImages().DIALOG_BG;
    const closeBtnShape = imageService.getPreloadImages().BTN_CLOSE;

    dialogBgShape.set({
      width: 720,
      height: 360,
      top: 360 * SCALE_Y,
      left: 180 * SCALE_X,
    });

    const errorTitle = new FabricText(title, {
      fill: '#FFEFBB',
      fontSize: 48 * SCALE_X,
      fontWeight: 400,
      fontFamily: 'Noto Sans TC',
      width: 500 * SCALE_X,
      height: 70 * SCALE_X,
      left: (290 + 500 / 2) * SCALE_X,
      top: (380 + 70 / 2) * SCALE_Y,
      originX: 'center',
      originY: 'center',
    });

    const errorDescription = new FabricText(description, {
      fill: '#FFEFBB',
      fontSize: 36 * SCALE_X,
      fontWeight: 400,
      fontFamily: 'Noto Sans TC',
      width: 660 * SCALE_X,
      height: errorDescriptionHeight[errorType] * SCALE_X,
      left: (210 + 660 / 2) * SCALE_X,
      top: (450 + errorDescriptionHeight[errorType] / 2) * SCALE_Y,
      originX: 'center',
      originY: 'center',
      textAlign: 'center',
    });

    const reconnectBtnBg = new Rect({
      width: 192 * SCALE_X,
      height: 68 * SCALE_X,
      stroke: '#FFF9E9',
      strokeWidth: 1,
      rx: 34 * SCALE_X,
      ry: 34 * SCALE_X,
      objectCaching: false,
      left: (444 + 194 / 2) * SCALE_X,
      top: (622 + 68 / 2) * SCALE_Y,
      originX: 'center',
      originY: 'center',
    });

    reconnectBtnBg.set(
      'fill',
      new Gradient({
        type: 'linear',
        gradientUnits: 'percentage',
        coords: { x1: 0, y1: 0, x2: 1, y2: 0 },
        colorStops: [
          { offset: 0, color: '#D69E13' },
          { offset: 0.5, color: '#FFE8A7' },
          { offset: 1, color: '#B3880C' },
        ],
      })
    );
    const reconnectBtnText = new FabricText(i18n.t('popUp.reconnectBtn'), {
      fontSize: 28 * SCALE_X,
      textBackgroundColor: '',
      width: 112 * SCALE_X,
      height: 48 * SCALE_X,
      left: (484 + 112 / 2) * SCALE_X,
      top: (632 + 48 / 2) * SCALE_Y,
      originX: 'center',
      originY: 'center',
    });
    const reconnectBtn = new Group([reconnectBtnBg, reconnectBtnText]);

    closeBtnShape.set({
      width: 60,
      height: 60,
      left: 810 * SCALE_X,
      top: 390 * SCALE_Y,
    });

    const errorBtnByType: { [key in ErrorType]: FabricObject } = {
      [ErrorType.RECONNECT]: reconnectBtn,
      [ErrorType.CLOSE]: closeBtnShape,
    };

    const errorButton = errorBtnByType[errorType];

    const dialogShapeGroup = new Group([dialogBgShape, errorTitle, errorDescription, errorButton], {
      selectable: false,
      subTargetCheck: true,
    });

    super({ x: 0, y: 0 }, dialogShapeGroup, CanvasTag.INTERACTIVE);
    this.errorButton = errorButton;
  }

  draw(): this {
    this.intervalCheckZIndex();

    this.container.add(this.shape);
    return this;
  }

  onClick(onClickHandler?: () => void) {
    this.errorButton.on('mousedown', () => {
      if (onClickHandler) {
        onClickHandler();
      }
      this.destroy();
    });
  }

  private intervalCheckZIndex() {
    let count = 0;

    const id = setInterval(() => {
      const allWidgets = this.container.getObjects();
      const index = allWidgets.indexOf(this.shape);

      if (index < allWidgets.length - 1) {
        // this.shape.bringToFront();
      } else {
        count++;
      }

      if (count === 4) {
        clearInterval(id);
      }
    }, 1000);
  }
}
