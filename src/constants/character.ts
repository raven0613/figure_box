// 想要有性格&容易遇到的事的權重，但這樣會不會變無聊？
export interface CharacterBaseSetting {
    name: string;
    avatar: {
        eyes: {
            offsetX: number; // 以臉部中間線為中心，偏移多少
            offsetY: number; // 以預設高度為中心，偏移多少
            rotate: number; // 旋轉
            scale: number; // 眼睛大小，預設1
            sclera: string; // 眼白的顏色 zIndex: 0;
            color: string; // 眼珠的顏色 zIndex: 1;
            pupil: string; // 瞳孔的顏色 zIndex: 2;

            upperEyelid: { // 上眼瞼 zIndex: 4;
                id: 0; // 0 是無 1.2.3...為系統提供的選擇
                color: string;
                offsetX: number; // 以眼睛中間線為中心，偏移多少
                offsetY: number; // 以眼睛中間線為中心，偏移多少
                rotate: number; // 旋轉
                scale: number; // 眼睛大小，預設1
                path: string; // 有自己畫的話，蓋在上面的作畫資料
            }
            lowerEyelid: { // 下眼瞼 zIndex: 4;
                id: 0; // 0 是無 1.2.3...為系統提供的選擇
                color: string;
                offsetX: number; // 以眼睛中間線為中心，偏移多少
                offsetY: number; // 以眼睛中間線為中心，偏移多少
                rotate: number; // 旋轉
                scale: number; // 眼睛大小，預設1
                path: string; // 有自己畫的話，蓋在上面的作畫資料
            }
            light: { // 光點 zIndex: 3;
                id: 0; // 0 是無 1.2.3...為系統提供的選擇
                color: string;
                offsetX: number; // 以眼睛中間線為中心，偏移多少
                offsetY: number; // 以眼睛中間線為中心，偏移多少
                rotate: number; // 旋轉
                scale: number; // 眼睛大小，預設1
                path: string; // 有自己畫的話，蓋在上面的作畫資料
                zIndex: 0;
            }
        }
        hair: {
            bangs: { // 瀏海
                id: number; // 系統提供的選擇
                color: string;
                offsetX: number;
                offsetY: number;
                rotate: number; // 旋轉
                scale: number; // 大小，預設1
                path: string; // 有自己畫的話，蓋在上面的作畫資料
            }
            sideburns: { // 側髮
                id: number; // 系統提供的選擇
                color: string;
                offsetX: number;
                offsetY: number;
                rotate: number; // 旋轉
                scale: number; // 大小，預設1
                path: string; // 有自己畫的話，蓋在上面的作畫資料
            }
            topHair: {
                id: number; // 系統提供的選擇
                color: string;
                offsetX: number;
                offsetY: number;
                rotate: number; // 旋轉
                scale: number; // 大小，預設1
                path: string; // 有自己畫的話，蓋在上面的作畫資料
            }
            backHair: {
                id: number; // 系統提供的選擇
                color: string;
                offsetX: number;
                offsetY: number;
                rotate: number; // 旋轉
                scale: number; // 大小，預設1
                path: string; // 有自己畫的話，蓋在上面的作畫資料
            }
            light: { // 光點
                id: 0; // 0 是無 1.2.3...為系統提供的選擇
                color: string;
                offsetX: number;
                offsetY: number;
                rotate: number; // 旋轉
                scale: number; // 眼睛大小，預設1
                path: string; // 有自己畫的話，蓋在上面的作畫資料
            }
        }
        mouth: {
            id: number; // 系統提供的選擇
            color: string;
            offsetX: number;
            offsetY: number;
            rotate: number; // 旋轉
            scale: number; // 大小，預設1
            path: string; // 有自己畫的話，蓋在上面的作畫資料
        }
        nose: {
            id: number; // 系統提供的選擇
            color: string;
            offsetX: number;
            offsetY: number;
            rotate: number; // 旋轉
            scale: number; // 大小，預設1
            path: string; // 有自己畫的話，蓋在上面的作畫資料
        }
        face: { // 臉型
            id: number; // 系統提供的選擇
            color: string; // 膚色
            path: string; // 有自己畫的話，蓋在上面的作畫資料，例如：刺青、OK繃、雀斑
        }
    }
    wayOfSaying: { // 口癖
        beginning: string; // 話語開頭，例如：蛤？ 
        chuckle: string; // 輕笑，例如：呵呵、嘻嘻
        laugh: string; // 大笑，例如：哈——哈哈哈哈！、哈哈哈哈哈！
        ending: string; // 話語結尾，例如：喵
        selfReference: string; // 自稱，例如：我、在下
    }
}
export interface Position {
    x: number;
    y: number;
}

// 表情（顯示在臉上的）
export enum Expression {
    Normal = "normal", // 玩家設定好的
    Laugh = "laugh", // 系統大笑臉
    Cry = "cry", // 系統哭臉
    Mad = "mad" // 系統生氣臉
}


export enum Mood {
    Ecstatic = "ecstatic",
    Happy = "happy",
    Relaxed = "relaxed",
    Peaceful = "peaceful",
    Nervous = "nervous",
    Sad = "sad",
    Upset = "upset",
    Heartbroken = "heartbroken",
    Angry = "angry",
    Afraid = "afraid",
}

// 擁有同樣或類似物品可以互動
// 範例：如果不喜歡對方，可能觸發雖然人很差，但品味倒不錯
// 雙方互相喜歡，觸發定情信物
// 一方喜歡一方朋友，觸發超級心跳
// 雙方朋友，觸發融洽互動

// 1. 單向的個人情感 (主觀的心情)
export enum Feeling {
    Hate = "hate",
    Neutral = "neutral", // 無感
    Like = "like",
    SecretCrush = "secret_crush", // 暗戀
    OpenCrush = "open_crush",     // 明戀
}

// 2. 雙向的社會關係 (客觀的事實)
export enum SocialStatus {
    Stranger = "stranger",
    Acquaintance = "acquaintance",
    Friend = "friend",
    Lovers = "lovers",
    Married = "married"
}

// 紀錄 A 怎麼看待 B (有向圖 Directed Graph)
export interface DirectedRelationship {
    charId: string; // owner
    targetCharId: string; // 對方
    feeling: Feeling;
    // 可以再擴充：例如隱藏的數值化好感度，用來決定什麼時候升級 Feeling
    intimacy: number; // 親密度 (-100 到 100，預設0),
    memories: MemoryValueMap;
}

export enum MemoryType {
    Impression = "impression",
    Argument = "argument",
    Fight = "fight",
}

export type MemoryValueMap = {
    [MemoryType.Impression]: Memory;
    [MemoryType.Argument]: MemoryData;
    [MemoryType.Fight]: MemoryData;
};

export interface Memory {
    counts: number;
    lastUpdate: number; // 可以計算超過30天沒更新就刪除
}

export interface MemoryData extends Memory {
    startedById: string; // charId
}

// 紀錄兩人共同的社會關係 (無向圖 Undirected Graph)
export interface MutualRelationship {
    charIds: [string, string]; // 陣列順序不重要，代表這兩人
    status: SocialStatus;
    timestamp: number;
}

// 還要記錄所有關係，得知關係變化
export interface RelationshipRecord {
    charIds: [string, string]; // 陣列順序不重要，代表這兩人
    records: {
        status: SocialStatus;
        timestamp: number;
    }[];
}
