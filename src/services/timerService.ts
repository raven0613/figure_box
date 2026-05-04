import { differenceInMilliseconds, millisecondsToSeconds } from 'date-fns';
import { v4 as uuid } from 'uuid';
import Worker from '../services/worker.ts?worker';

export enum KeyType {
  TIMER = 'Timer',
  COIN = 'Coin',
  WINNING_RING_RED = 'winning ring red',
  WINNING_RING_BLUE = 'winning ring blue',
  WINNING_RING_ONE = 'winning ring one',
  WINNING_RING_TWO = 'winning ring two',
  WINNING_RING_THREE = 'winning ring three',
  WINNING_RING_FOUR = 'winning ring four',
  WINNING_RING_FIVE = 'winning ring five',
  WINNING_RING_SIX = 'winning ring six',
  DELAY = 'delay',
}

export interface RegisterTimerProps {
  startTime: number;
  endTime: number;
}

export interface SubscribeOptions {
  time: RegisterTimerProps;
  loop: boolean;
  onTimeChange: (seconds: number) => void;
}

type SubscriberMap = {
  [key in KeyType]: {
    [key: string]: (hundredMilliSeconds: number) => void;
  };
};

class TimerService {
  static instance: TimerService;
  private worker?: Worker;
  private subscriberByKey: SubscriberMap = {} as SubscriberMap;

  constructor() {
    this.worker = new Worker();
  }

  static getInstance() {
    if (!this.instance) {
      return new TimerService().registry();
    }
    return this.instance;
  }

  public subscribe(key: KeyType, subscribeOptions: SubscribeOptions): string {
    const id = uuid();
    const register = this.countDown(key, id, subscribeOptions);

    this.createSubscription(key, id, register);

    return id;
  }

  public unsubscribe(key: KeyType, id: string) {
    if (this.subscriberByKey[key]) {
      delete this.subscriberByKey[key][id];
    }
  }

  public async waitFor(delay: number) {
    const key = KeyType.DELAY;

    return new Promise<void>(resolve => {
      const id = uuid();
      const register = this.countDown(key, id, {
        time: { startTime: 0, endTime: delay },
        loop: false,
        onTimeChange: second => {
          if (second === 0) {
            resolve();
          }
        },
      });

      this.createSubscription(key, id, register);
    });
  }

  private registry(): this {
    this.worker!.postMessage(undefined);
    this.worker!.onmessage = e => {
      const subscribers = Object.values(this.subscriberByKey);

      if (subscribers.length > 0) {
        subscribers.forEach(subscriber => {
          const registers = Object.values(subscriber);

          if (registers.length > 0) {
            registers.forEach(register => {
              typeof register === 'function' && register(e.data);
            });
          }
        });
      }
    };

    return this;
  }

  private getSecondsAndMilliSeconds(milliSeconds: number) {
    if (milliSeconds >= 1000) {
      return [millisecondsToSeconds(milliSeconds), milliSeconds % 1000];
    } else {
      return [0, milliSeconds % 1000];
    }
  }

  private countDown(key: KeyType, id: string, subscribeOptions: SubscribeOptions) {
    const { time, loop, onTimeChange } = subscribeOptions;
    const timeDuration = differenceInMilliseconds(time.endTime, time.startTime);
    let [seconds, milliSeconds] = this.getSecondsAndMilliSeconds(timeDuration);
    let isMilliSecondsExist = milliSeconds > 0;
    let accumulator = 0;
    if (isMilliSecondsExist) {
      seconds++;
    }
    return (hundredMilliSeconds: number) => {
      accumulator += hundredMilliSeconds;
      if (isMilliSecondsExist) {
        milliSeconds -= accumulator;
        if (milliSeconds <= 0) {
          isMilliSecondsExist = false;
          seconds -= 1;
          onTimeChange(seconds);
          accumulator = 0;
        }
      } else {
        if (accumulator === 1000) {
          seconds -= 1;
          if (seconds === -1 && loop) {
            const [originSecond, originMilliSecond] = this.getSecondsAndMilliSeconds(timeDuration);
            isMilliSecondsExist = originMilliSecond > 0;
            seconds = originSecond;
            milliSeconds = originMilliSecond;
          } else if (seconds === 0 && !loop) {
            this.unsubscribe(key, id);
          }
          onTimeChange(seconds);
          accumulator = 0;
        }
      }
    };
  }

  private createSubscription(key: KeyType, id: string, register: (hundredMilliSeconds: number) => void) {
    if (this.subscriberByKey[key]) {
      this.subscriberByKey[key][id] = register;
    } else {
      this.subscriberByKey[key] = {
        [id]: register,
      };
    }
  }
}

export const timerService = TimerService.getInstance();
