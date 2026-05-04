declare namespace GameApi {
  export interface User {
    userId: string;
    userToken: string;
    gameId: string;
  }

  export interface UserInfo extends User {
    nickname: string;
    avatar?: string;
    coins: number;
    vipLevel?: number;
  }

  namespace Coin {
    export interface Post {
      orderId: string;
      gameId: string;
      userId: string;
      userToken: string;
      coin: number;
      type: number;
    }

    export interface Total {
      gameId: string;
      userId: string;
      orderId: string;
      userToken: string;
      totalReward: number;
    }
  }
}
