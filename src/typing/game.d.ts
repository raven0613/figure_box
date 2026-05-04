declare namespace GameApi {
  export interface Game {
    startTime: Date;
    endTime?: Date;
    status: 'initial' | 'start' | 'stop' | 'reward' | 'finished';
    isArtificial: boolean;
    winner?: CatEnum;
  }

  export interface BetRecord {
    gameId: string;
    userId: string;
    coins: string;
    optionType: CatEnum;
  }

  export interface History {
    catPayRates: Record<CatEnum, Payrate>;
    winner: CatEnum;
  }
}
