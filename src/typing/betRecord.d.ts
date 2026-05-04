declare namespace GameApi {
  export interface BetRecord {
    gameId: string;
    userId: string;
    coins: number;
    optionType: 'one' | 'two' | 'three' | 'four' | 'five' | 'six' | 'red' | 'blue';
  }

  export interface BetRecordWithToken extends BetRecord {
    userToken: string;
  }

  export interface GameSumBet {
    sum: number;
    optionType: 'one' | 'two' | 'three' | 'four' | 'five' | 'six' | 'red' | 'blue';
  }
}
