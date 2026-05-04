import { gameFlowMachine } from '~/stateMachines/gameFlow';
import { StateServiceBase } from './stateServiceBase';

class GameFlowStateService extends StateServiceBase<typeof gameFlowMachine> {
  static instance?: GameFlowStateService;

  constructor() {
    super(gameFlowMachine);
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new GameFlowStateService();
    }
    return this.instance;
  }
}

export const gameFlowStateService = GameFlowStateService.getInstance();
