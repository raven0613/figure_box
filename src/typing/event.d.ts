declare namespace GameApi {
  export interface Chips {
    suit: number;
    count: number;
    optionType: CatEnum;
  }

  export interface Bet {
    state: 'bet';
    id: string;
    gameId: string;
    userToken: string;
    chips: Chips[];
  }
}
