// 綁 character
export interface Item {
    id: string;
    amount: number;
    isHanding: boolean;
}
// item 基本資料
interface ItemInfo {
    id: string;
    image: string;
    type: ItemType;
    limitPerChar: number; // 一人限制擁有幾個
}
// 物品可以拿在手上，會顯示在地圖小人身上
// 遇到人看到手上的物品可能會觸發相關對話
// 角色可能會說想要什麼，如果讓人送他會觸發好感，平時也可以讓角色之間送禮
enum ItemType {
    Food = "food",
    Tool = "tool"
}

// 事件分成 地圖上自動發生的、會顯示但是需要點擊觸發的
// 事件要分成不同的嗎，例如點擊地圖的自己一個 interface
// 每次事件發生時，挑出所有 condition 符合的事件，塞進一個事件池，再依照權重決定機率
interface EventInfo {
    id: string;
    name: Event;
    type:
    condition: Record<string, string>[]; // 飽足度大於五 saturation: ">= 5"
    limitChar: number; // 最多幾人同時
}

// 人物的互動是動詞名詞接起來的，解鎖不同地方可以解鎖新的動詞或名詞
enum Event {
    Massage = "massage", // 按摩
    Gossip = "gossip" // 聊八卦
}

enum EventType {
    Tick = "tick", // 自動：時間流逝
    SenseObject = "senseObject", // 自動：感應到物品
    SocialProximity = "socialProximity", // 自動：感知到附近有人
    RequestAction = "requestAction", // 主動：提出需求，需要玩家點擊
    UserClick = "userClick", // 主動：玩家點擊
}

export type CharacterEvent =
    | { type: EventType.Tick } // 自動：時間流逝
    | { type: EventType.SenseObject; objectId: string; gridType: string } // 自動：感應到物品
    | { type: EventType.SocialProximity; targetActorId: string } // 自動：感知到附近有人
    | { type: EventType.RequestAction; actionType: 'WANT_FRIEND' | 'HUNGRY'; payload: any } // 主動：需要玩家點擊
    | { type: EventType.UserClick; actionId: string } // 主動：玩家點擊核准

// 以後再說的：
// 大逃殺...會有出局、不同事件
// 玩具戰鬥系統，例如怪獸對打機那種

// 大逃殺模式的設定
interface BattleCharacter {
    hp: number;
    sp: number;
}
