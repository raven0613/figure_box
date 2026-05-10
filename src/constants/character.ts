
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
    Happy = "happy",
    Angry = "angry",
    Sad = "sad"
}
// 關係要兩人用一個，還是兩人對對方可能是不同關係？
// 單戀多加上暗戀or明戀
// 擁有同樣或類似物品可以互動
enum RelationshipStage {
    Hate = "hate",
    Stranger = "stranger",
    Acquaintance = "acquaintance",
    Friend = "friend",
    Crush = "crush",
    Like = "like",
    Lovers = "lovers",
    Married = "married"
}

export interface Relationship {
    stage: RelationshipStage;

}

export interface RelationshipRecord {
    charId: [string, string];
    timestamp: number;
    stage: RelationshipStage;
}
