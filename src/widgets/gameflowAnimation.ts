import { BigBattleGameStates, type Stage } from '~/stateMachines/gameFlow/states';
import { KeyType, timerService } from '../services/timerService';

interface CatchTimestamp {
  startTime: number;
  endTime: number;
}

type RankKeyframes = Record<string, number>;
type Script = { [K in Rank]: RankKeyframes };
export type RacingScript = Record<string, Script>;

enum Rank {
  first = 'first',
  second = 'second',
  third = 'third',
  fourth = 'fourth',
  fifth = 'fifth',
}

export class GameflowAnimation {
  private stage: Stage;
  private currentTimerId: string | null = null;

  constructor(stage: Stage = BigBattleGameStates.PREPARING) {
    this.stage = stage;
  }

  public catchTimestamp(stage: Stage, { startTime, endTime }: CatchTimestamp): void {
    if (this.stage === stage) {
      /*
        To prevent pass the same stage twice
        and cause timerService to be subscribed again
        which will reset the countdown
      */
      return;
    }

    if (this.currentTimerId !== null) {
      timerService.unsubscribe(KeyType.TIMER, this.currentTimerId);
      this.currentTimerId = null;
    }

    const id = timerService.subscribe(KeyType.TIMER, {
      time: { startTime, endTime },
      loop: false,
      onTimeChange: second => {
        // console.log('onTimeChange', second, stage);

        if (second === 0) {
          timerService.unsubscribe(KeyType.TIMER, id);
          this.currentTimerId = null;
        }
      },
    });

    this.currentTimerId = id;
    this.stage = stage;
  }
}
