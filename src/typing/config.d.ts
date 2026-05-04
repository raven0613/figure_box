declare namespace GameApi {
  export interface Config {
    key: 'payRate' | 'probability' | 'coinPoolConfig' | 'isGameEnabled';
    value: Value;
  }

  export interface CoinPoolConfig {
    darkwaterRate: number;
    thresholdCoin: number;
    thresholdRound: number;
  }
  namespace Config {
    export interface Value {
      color: number;
      position: number;
    }
  }
}
