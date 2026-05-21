import type { CharacterSeedItem } from '~/typing/item';

// 綁 character
export type Item = CharacterSeedItem;
// item 基本資料
export interface ItemInfo {
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

// 以後再說的：
// 大逃殺...會有出局、不同事件
// 玩具戰鬥系統，例如怪獸對打機那種

// 大逃殺模式的設定
export interface BattleCharacter {
    hp: number;
    sp: number;
}
