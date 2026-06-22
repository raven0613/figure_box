import type { CharacterSeedItem } from '~/typing/item';
export type { ExpressionPresetId } from '~/typing/expression';

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

export interface CharacterSeedOwnItems {
    ownItems?: readonly CharacterSeedItem[];
}
export interface Position {
    x: number;
    y: number;
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

export interface MoodValueThreshold {
    minMoodValue: number;
    mood: Mood;
}

export const MOOD_VALUE_THRESHOLDS: readonly MoodValueThreshold[] = [
    { minMoodValue: 0, mood: Mood.Heartbroken },
    { minMoodValue: 10, mood: Mood.Afraid },
    { minMoodValue: 20, mood: Mood.Angry },
    { minMoodValue: 30, mood: Mood.Upset },
    { minMoodValue: 40, mood: Mood.Sad },
    { minMoodValue: 50, mood: Mood.Nervous },
    { minMoodValue: 60, mood: Mood.Peaceful },
    { minMoodValue: 70, mood: Mood.Relaxed },
    { minMoodValue: 80, mood: Mood.Happy },
    { minMoodValue: 95, mood: Mood.Ecstatic },
];

export function getMoodForMoodValue(moodValue: number): Mood {
    const clampedMoodValue = clampMoodValue(moodValue);

    for (let index = MOOD_VALUE_THRESHOLDS.length - 1; index >= 0; index -= 1) {
        const threshold = MOOD_VALUE_THRESHOLDS[index];

        if (clampedMoodValue >= threshold.minMoodValue) {
            return threshold.mood;
        }
    }

    return Mood.Peaceful;
}

export function getMoodMinValue(mood: Mood): number {
    return MOOD_VALUE_THRESHOLDS.find(threshold => threshold.mood === mood)
        ?.minMoodValue ?? 0;
}

export function clampMoodValue(moodValue: number): number {
    return Math.max(0, Math.min(100, moodValue));
}

// 擁有同樣或類似物品可以互動
// 範例：如果不喜歡對方，可能觸發雖然人很差，但品味倒不錯
// 雙方互相喜歡，觸發定情信物
// 一方喜歡一方朋友，觸發超級心跳
// 雙方朋友，觸發融洽互動

// 1. 單向的個人情感 (主觀的心情)
export enum Feeling {
    Hate = "hate",
    Dislike = "dislike",
    Wary = "wary", // 提防的
    Neutral = "neutral", // 無感
    Warm = "warm",
    Like = "like",
    Fond = "fond", // 溺愛
    SecretCrush = "secret_crush", // 暗戀
    OpenCrush = "open_crush",     // 明戀
    Love = "love",
}

// 2. 雙向的社會關係 (客觀的事實)
export enum SocialStatus {
    Hostile = "hostile",
    Distant = "distant",
    Stranger = "stranger",
    Acquaintance = "acquaintance",
    Friendly = "friendly",
    Friend = "friend",
    CloseFriend = "close_friend",
    BestFriend = "best_friend",
    Lovers = "lovers",
    Married = "married"
}

// 紀錄 A 怎麼看待 B (有向圖 Directed Graph)
export interface DirectedRelationship {
    charId: string; // owner
    targetCharId: string; // 對方
    feeling: Feeling;
    intimacy: number; // 親密度 (-100 到 100，預設0),
    memories: MemoryValueMap;
    spokenLines: SpokenLineMemory[];
}

export interface SpokenLineMemory {
    memoryKey: string;
    text: string;
    timestamp: number;
}

export enum MemoryType {
    Impression = "impression",
    Argument = "argument",
    Fight = "fight",
    Kiss = "kiss",
    WallSlam = "wallSlam",
}

export type MemoryValueMap = {
    [MemoryType.Impression]: Memory;
    [MemoryType.Argument]: MemoryData;
    [MemoryType.Fight]: MemoryData;
    [MemoryType.Kiss]: MemoryData;
    [MemoryType.WallSlam]: MemoryData;
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

export const CHARACTER_SEEDS = [
    { id: 'friend-01', name: 'Tezuka', label: 'T', color: '#413636', position: { x: 18, y: 18 }, saturation: 58, ownItems: [{ definitionId: 'toy-ball', quantity: 1, state: 'held' }] },
    { id: 'friend-02', name: 'Fuji', label: 'F', color: '#e57070', position: { x: 21, y: 18 }, saturation: 32, ownItems: [{ definitionId: 'toy-ball', quantity: 1 }] },
    { id: 'friend-03', name: 'Eiji', label: 'E', color: '#ff9900', position: { x: 24, y: 18 }, saturation: 80, ownItems: [{ definitionId: 'toy-ball', quantity: 1 }] },
    { id: 'friend-04', name: 'Ooishi', label: 'O', color: '#33cc33', position: { x: 27, y: 18 }, saturation: 60, ownItems: [{ definitionId: 'cards', quantity: 1 }] },
    { id: 'friend-05', name: 'Kikumaru', label: 'K', color: '#ff3333', position: { x: 30, y: 18 }, saturation: 90, ownItems: [{ definitionId: 'cards', quantity: 1 }] },
    { id: 'friend-06', name: 'Inui', label: 'I', color: '#333399', position: { x: 18, y: 23 }, saturation: 50, ownItems: [{ definitionId: 'cards', quantity: 1 }, { definitionId: 'book', quantity: 1 }] },
    { id: 'friend-07', name: 'Kawamura', label: 'Ka', color: '#996633', position: { x: 14, y: 16 }, saturation: 75 },
    { id: 'friend-08', name: 'Momoshiro', label: 'M', color: '#ff66cc', position: { x: 14, y: 18 }, saturation: 85 },
    { id: 'friend-09', name: 'Kaidoh', label: 'Kd', color: '#339933', position: { x: 27, y: 23 }, saturation: 65 },
    { id: 'friend-10', name: 'Atobe', label: 'A', color: '#cc99ff', position: { x: 30, y: 23 }, saturation: 95 },
    { id: 'friend-11', name: 'Oshitari', label: 'Os', color: '#0066cc', position: { x: 18, y: 28 }, saturation: 55, ownItems: [{ definitionId: 'book', quantity: 1 }] },
    { id: 'friend-12', name: 'Mukahi', label: 'Mu', color: '#ff0066', position: { x: 21, y: 28 }, saturation: 70 },
    { id: 'friend-13', name: 'Shishido', label: 'S', color: '#ffcc00', position: { x: 24, y: 28 }, saturation: 65 },
    { id: 'friend-14', name: 'Akutagawa', label: 'Ak', color: '#ff99cc', position: { x: 27, y: 28 }, saturation: 80 },
    { id: 'friend-15', name: 'Jiro', label: 'J', color: '#ffcc99', position: { x: 30, y: 28 }, saturation: 85 },
    { id: 'friend-16', name: 'Niou', label: 'N', color: '#99ccff', position: { x: 2, y: 14 }, saturation: 45 },
    { id: 'friend-17', name: 'Yagyu', label: 'Y', color: '#cc6699', position: { x: 6, y: 14 }, saturation: 40 },
    { id: 'friend-18', name: 'Marui', label: 'Ma', color: '#ff3399', position: { x: 10, y: 14 }, saturation: 90 },
    { id: 'friend-19', name: 'Sanada', label: 'Sa', color: '#333333', position: { x: 14, y: 14 }, saturation: 60 },
    { id: 'friend-20', name: 'Yukimura', label: 'Yu', color: '#6699ff', position: { x: 22, y: 14 }, saturation: 80, ownItems: [{ definitionId: 'book', quantity: 1 }] },
    // { id: 'friend-21', name: 'Kirihara', label: 'Ki', color: '#660000', position: { x: 26, y: 14 }, saturation: 75 },
    // { id: 'friend-22', name: 'Ryoma', label: 'R', color: '#cc0000', position: { x: 30, y: 14 }, saturation: 100 },
    // { id: 'friend-23', name: 'Chitose', label: 'Ch', color: '#8b4513', position: { x: 34, y: 14 }, saturation: 55 },
    // { id: 'friend-24', name: 'Tachibana', label: 'Tc', color: '#2e8b57', position: { x: 38, y: 14 }, saturation: 70 },
    // { id: 'friend-25', name: 'Kamio', label: 'Km', color: '#dc143c', position: { x: 42, y: 14 }, saturation: 60 },
    // { id: 'friend-26', name: 'Shinji', label: 'Sh', color: '#4682b4', position: { x: 46, y: 14 }, saturation: 45 },
    // { id: 'friend-27', name: 'Sengoku', label: 'Se', color: '#ffa500', position: { x: 50, y: 14 }, saturation: 88 },
    // { id: 'friend-28', name: 'Dan', label: 'D', color: '#98fb98', position: { x: 54, y: 14 }, saturation: 92 },
    // { id: 'friend-29', name: 'Akutsu', label: 'Aj', color: '#696969', position: { x: 58, y: 14 }, saturation: 30 },
    // { id: 'friend-30', name: 'Mizuki', label: 'Mz', color: '#9370db', position: { x: 62, y: 14 }, saturation: 65 },
    // { id: 'friend-31', name: 'Yuuta', label: 'Yt', color: '#cd853f', position: { x: 2, y: 35 }, saturation: 72 },
    // { id: 'friend-32', name: 'Akazawa', label: 'Az', color: '#556b2f', position: { x: 6, y: 35 }, saturation: 50 },
    // { id: 'friend-33', name: 'Kaneda', label: 'Kn', color: '#b8860b', position: { x: 10, y: 35 }, saturation: 68 },
    // { id: 'friend-34', name: 'Itsuki', label: 'It', color: '#ff69b4', position: { x: 14, y: 35 }, saturation: 82 },
    // { id: 'friend-35', name: 'Hiyoshi', label: 'Hi', color: '#8fbc8f', position: { x: 18, y: 35 }, saturation: 55 },
    // { id: 'friend-36', name: 'Kabaji', label: 'Kb', color: '#a0522d', position: { x: 22, y: 35 }, saturation: 78 },
    // { id: 'friend-37', name: 'Taki', label: 'Tk', color: '#5f9ea0', position: { x: 26, y: 35 }, saturation: 42 },
    // { id: 'friend-38', name: 'Sakurai', label: 'Sk', color: '#d2691e', position: { x: 30, y: 35 }, saturation: 66 },
    // { id: 'friend-39', name: 'David', label: 'Dv', color: '#6495ed', position: { x: 34, y: 35 }, saturation: 73 },
    // { id: 'friend-40', name: 'Bane', label: 'Bn', color: '#f4a460', position: { x: 38, y: 35 }, saturation: 58 },
    // { id: 'friend-41', name: 'Saeki', label: 'Sk', color: '#7b68ee', position: { x: 42, y: 35 }, saturation: 85 },
    // { id: 'friend-42', name: 'Ojii', label: 'Oj', color: '#bc8f8f', position: { x: 46, y: 35 }, saturation: 48 },
    // { id: 'friend-43', name: 'Kentaro', label: 'Kt', color: '#db7093', position: { x: 50, y: 35 }, saturation: 77 },
    // { id: 'friend-44', name: 'Liliadent', label: 'Li', color: '#ffd700', position: { x: 54, y: 35 }, saturation: 62 },
    // { id: 'friend-45', name: 'Zaizen', label: 'Za', color: '#00ced1', position: { x: 58, y: 35 }, saturation: 53 },
    // { id: 'friend-46', name: 'Kintaro', label: 'Kn', color: '#ff4500', position: { x: 62, y: 35 }, saturation: 98 },
    // { id: 'friend-47', name: 'Shiraishi', label: 'Sr', color: '#32cd32', position: { x: 2, y: 55 }, saturation: 70 },
    // { id: 'friend-48', name: 'Watanabe', label: 'Wt', color: '#4169e1', position: { x: 6, y: 55 }, saturation: 64 },
    // { id: 'friend-49', name: 'Irie', label: 'Ir', color: '#da70d6', position: { x: 10, y: 55 }, saturation: 57 },
    // { id: 'friend-50', name: 'Tokugawa', label: 'To', color: '#2f4f4f', position: { x: 14, y: 55 }, saturation: 83 },
    // { id: 'friend-51', name: 'Oni', label: 'On', color: '#b22222', position: { x: 18, y: 55 }, saturation: 44 },
    // { id: 'friend-52', name: 'Tanegashima', label: 'Tn', color: '#daa520', position: { x: 22, y: 55 }, saturation: 71 },
    // { id: 'friend-53', name: 'Omagari', label: 'Om', color: '#8b008b', position: { x: 26, y: 55 }, saturation: 59 },
    // { id: 'friend-54', name: 'Kimijima', label: 'Kj', color: '#006400', position: { x: 30, y: 55 }, saturation: 36 },
    // { id: 'friend-55', name: 'Mouri', label: 'Mr', color: '#ff6347', position: { x: 34, y: 55 }, saturation: 87 },
    // { id: 'friend-56', name: 'Ochi', label: 'Oc', color: '#4b0082', position: { x: 38, y: 55 }, saturation: 52 },
    // { id: 'friend-57', name: 'Koharu', label: 'Ko', color: '#ff1493', position: { x: 42, y: 55 }, saturation: 93 },
    // { id: 'friend-58', name: 'Hitouji', label: 'Ht', color: '#00fa9a', position: { x: 46, y: 55 }, saturation: 67 },
    // { id: 'friend-59', name: 'Konjiki', label: 'Kk', color: '#ffd700', position: { x: 50, y: 55 }, saturation: 74 },
    // { id: 'friend-60', name: 'Ishida', label: 'Is', color: '#708090', position: { x: 54, y: 55 }, saturation: 41 },
    // { id: 'friend-61', name: 'Sakuno', label: 'Sn', color: '#ffb6c1', position: { x: 58, y: 55 }, saturation: 78 },
    // { id: 'friend-62', name: 'Tomoka', label: 'Tm', color: '#ff7f50', position: { x: 62, y: 55 }, saturation: 86 },
    // { id: 'friend-63', name: 'Horio', label: 'Ho', color: '#bdb76b', position: { x: 38, y: 18 }, saturation: 63 },
    // { id: 'friend-64', name: 'Katsuo', label: 'Ks', color: '#66cdaa', position: { x: 41, y: 18 }, saturation: 56 },
    // { id: 'friend-65', name: 'Kachiro', label: 'Kc', color: '#ba55d3', position: { x: 44, y: 18 }, saturation: 69 },
    // { id: 'friend-66', name: 'Arai', label: 'Ar', color: '#cd5c5c', position: { x: 47, y: 18 }, saturation: 47 },
    // { id: 'friend-67', name: 'Ikeda', label: 'Ik', color: '#20b2aa', position: { x: 50, y: 18 }, saturation: 81 },
    // { id: 'friend-68', name: 'Hayashi', label: 'Hy', color: '#778899', position: { x: 38, y: 23 }, saturation: 54 },
    // { id: 'friend-69', name: 'Izumi', label: 'Iz', color: '#b0c4de', position: { x: 41, y: 23 }, saturation: 62 },
    // { id: 'friend-70', name: 'Fukawa', label: 'Fk', color: '#deb887', position: { x: 44, y: 23 }, saturation: 73 },
    // { id: 'friend-71', name: 'Uchimura', label: 'Uc', color: '#5f9ea0', position: { x: 47, y: 23 }, saturation: 39 },
    // { id: 'friend-72', name: 'Mori', label: 'Mo', color: '#d2b48c', position: { x: 50, y: 23 }, saturation: 88 },
    // { id: 'friend-73', name: 'Higashikata', label: 'Hg', color: '#008080', position: { x: 38, y: 28 }, saturation: 51 },
    // { id: 'friend-74', name: 'Minami', label: 'Mn', color: '#d8bfd8', position: { x: 41, y: 28 }, saturation: 76 },
    // { id: 'friend-75', name: 'Higuchi', label: 'Hc', color: '#dda0dd', position: { x: 44, y: 28 }, saturation: 64 },
    // { id: 'friend-76', name: 'Kite', label: 'Ke', color: '#bc8f8f', position: { x: 47, y: 28 }, saturation: 43 },
    // { id: 'friend-77', name: 'Kai', label: 'Ki', color: '#f08080', position: { x: 50, y: 28 }, saturation: 91 },
    // { id: 'friend-78', name: 'Chinen', label: 'Cn', color: '#e0ffff', position: { x: 58, y: 18 }, saturation: 58 },
    // { id: 'friend-79', name: 'Hirakoba', label: 'Hk', color: '#fafad2', position: { x: 61, y: 18 }, saturation: 66 },
    // { id: 'friend-80', name: 'Tanishi', label: 'Ts', color: '#90ee90', position: { x: 64, y: 18 }, saturation: 49 },
    // { id: 'friend-81', name: 'Shiranui', label: 'Si', color: '#add8e6', position: { x: 67, y: 18 }, saturation: 82 },
    // { id: 'friend-82', name: 'Aragaki', label: 'Ag', color: '#e6e6fa', position: { x: 58, y: 23 }, saturation: 37 },
    // { id: 'friend-83', name: 'Yuuji', label: 'Yj', color: '#fff0f5', position: { x: 61, y: 23 }, saturation: 94 },
    // { id: 'friend-84', name: 'Tetsu', label: 'Te', color: '#faf0e6', position: { x: 64, y: 23 }, saturation: 55 },
    // { id: 'friend-85', name: 'Nomura', label: 'Nm', color: '#ffe4e1', position: { x: 67, y: 23 }, saturation: 68 },
    // { id: 'friend-86', name: 'Shudou', label: 'Sd', color: '#ffe4c4', position: { x: 58, y: 28 }, saturation: 79 },
    // { id: 'friend-87', name: 'Ota', label: 'Ot', color: '#ffdead', position: { x: 61, y: 28 }, saturation: 46 },
    // { id: 'friend-88', name: 'Wakato', label: 'Wk', color: '#f5deb3', position: { x: 64, y: 28 }, saturation: 84 },
    // { id: 'friend-89', name: 'Kajimoto', label: 'Kj', color: '#d2691e', position: { x: 67, y: 28 }, saturation: 61 },
    // { id: 'friend-90', name: 'Hanamura', label: 'Hm', color: '#a0522d', position: { x: 18, y: 40 }, saturation: 53 },
    // { id: 'friend-91', name: 'Banda', label: 'Bd', color: '#8b4513', position: { x: 21, y: 40 }, saturation: 77 },
    // { id: 'friend-92', name: 'Echizen', label: 'Ec', color: '#800000', position: { x: 24, y: 40 }, saturation: 42 },
    // { id: 'friend-93', name: 'Nanjiro', label: 'Nj', color: '#b8860b', position: { x: 27, y: 40 }, saturation: 96 },
    // { id: 'friend-94', name: 'Ryuzaki', label: 'Rz', color: '#daa520', position: { x: 30, y: 40 }, saturation: 38 },
    // { id: 'friend-95', name: 'Banji', label: 'Bj', color: '#cd853f', position: { x: 18, y: 45 }, saturation: 72 },
    // { id: 'friend-96', name: 'Sakaki', label: 'Sk', color: '#d2b48c', position: { x: 21, y: 45 }, saturation: 57 },
    // { id: 'friend-97', name: 'Ojii-san', label: 'Os', color: '#c4aead', position: { x: 24, y: 45 }, saturation: 48 },
    // { id: 'friend-98', name: 'Mikiya', label: 'Mk', color: '#c08040', position: { x: 27, y: 45 }, saturation: 89 },
    // { id: 'friend-99', name: 'Kurobe', label: 'Ku', color: '#404040', position: { x: 30, y: 45 }, saturation: 35 },
    // { id: 'friend-100', name: 'Tsuge', label: 'Tg', color: '#607060', position: { x: 18, y: 50 }, saturation: 63 },
] as const;
