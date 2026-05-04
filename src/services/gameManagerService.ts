import { Canvas } from 'fabric';
import { canvasSize } from '~/constants/canvas';
import { gameState } from '~/stateMachines/gameFlow/states';
import { DrawHelper } from '~/widgets/drawHelper';
import { CanvasContainer, CanvasTag, canvasService } from './canvasCtxService';
import { documentService } from './documentService';
import { imageService } from './imageService';
import { gameFlowStateService } from './states/gameFlowStateService';
import { GameflowAnimation } from '~/widgets/gameflowAnimation';

const STATIC_CANVAS_ID = 'meow-racing-static';
const INTERACTIVE_CANVAS_ID = 'meow-racing-interactive';
const PLAYGROUND_CANVAS_ID = 'meow-racing-playground';

export class GameManagerService {
  static instance: GameManagerService;
  private showAmount = false;

  static getInstance() {
    if (!this.instance) {
      this.instance = new GameManagerService();
    }
    return this.instance;
  }

  public async load() {
    canvasService
      .setCanvasContext(
        CanvasTag.STATIC,
        new CanvasContainer(
          new Canvas(STATIC_CANVAS_ID, {
            width: canvasSize.WIDTH,
            height: canvasSize.HEIGHT,
            interactive: false,
            selection: false,
          })
        )
      )
      .setCanvasContext(
        CanvasTag.PLAYGROUND,
        new CanvasContainer(
          new Canvas(PLAYGROUND_CANVAS_ID, {
            width: canvasSize.WIDTH,
            height: canvasSize.HEIGHT,
            interactive: false,
            selection: false,
          })
        )
      )
      .setCanvasContext(
        CanvasTag.INTERACTIVE,
        new CanvasContainer(
          new Canvas(INTERACTIVE_CANVAS_ID, {
            width: canvasSize.WIDTH,
            height: canvasSize.HEIGHT,
            interactive: false,
            selection: false,
          })
        )
      );

    canvasService.resizeCanvas();

    window.addEventListener('resize', () => {
      canvasService.resizeCanvas();
    });
    gameFlowStateService.initial();


    await imageService.loadImages(async percent => {
      if (percent > 40) {
        return;
      }
    });

    canvasService.setFabricImages({ ...imageService.getImages(), ...imageService.getPreloadImages() });

    documentService.listenDocumentVisibility();

    this.subscribeStateMachine(
    );

    return async () => {
      window.addEventListener('beforeunload', e => {
        e.returnValue = '';
      });
    };
  }

  private initialStaticWidget() {
    if (import.meta.env.DEV) {
      new DrawHelper().draw();
    }

  }

  private initialInteractiveWidget() {

  }

  private initialAmountWidgets() {

  }

  private subscribeStateMachine(
  ) {

    const gameflowAnimation = new GameflowAnimation();

    gameFlowStateService.onStateTransition(stateNode => {
      if (stateNode.matches(gameState.PREPARE_WIDGET) || stateNode.event.type === 'Game start') {
        // gameFlowStateService.send({

        // });
      }
    });

    gameFlowStateService.onContextChange(state => {
      // console.log('onContextChange', state.context);
      const { status, currentStageTimeStamp, nextStageTimeStamp } = state.context;

      gameflowAnimation.catchTimestamp(status, { startTime: currentStageTimeStamp, endTime: nextStageTimeStamp });
    });

  }
}

export const gameManagerService = GameManagerService.getInstance();
