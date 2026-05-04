declare namespace GameApi {
  export interface Transaction {
    gameId: string;
    coins: number;
    type: 'game_flow' | 'dark_water' | 'exceed_threshold';
  }
}
