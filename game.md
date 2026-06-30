# 遊戲系統說明

## Mood 系統

角色的心情由兩個欄位共同表示：

- `moodValue`：0 到 100 的心情數值，所有加減都會限制在此範圍內。
- `mood`：依照 `moodValue` 自動換算的心情階段，用於規則與事件分支判斷。

角色建立時的初始 `moodValue` 為 65，對應 `peaceful`。

### 心情階段

| moodValue | mood          | 中文含義 |
| --------- | ------------- | -------- |
| 95-100    | `ecstatic`    | 狂喜     |
| 80-94     | `happy`       | 開心     |
| 70-79     | `relaxed`     | 放鬆     |
| 60-69     | `peaceful`    | 平靜     |
| 50-59     | `nervous`     | 緊張     |
| 40-49     | `sad`         | 難過     |
| 30-39     | `upset`       | 不悅     |
| 20-29     | `angry`       | 生氣     |
| 10-19     | `afraid`      | 害怕     |
| 0-9       | `heartbroken` | 心碎     |

階段定義位於 `src/constants/character.ts`。更新 `moodValue` 時，程式會同時重新計算 `mood`，避免數值與階段不一致。

### Mood 對遊戲的影響

#### 1. 角色自主決策

Mood 會參與角色的 Utility Score 計算，進而改變角色選擇活動的權重：

- **玩耍**：`playScore = playNeed + (100 - moodValue) * 0.2`。心情越低，越傾向透過玩耍改善心情。
- **聊天**：`chatScore = 16 + moodValue * 0.25`。心情越高，越傾向主動聊天。
- **待機**：只有在飽足度大於 70 且 `moodValue` 大於 70 時，待機權重才會從 8 提高至 45。
- **找食物**：目前不受 Mood 直接影響，只由飽足度決定。

相關邏輯位於 `src/services/characterEvents/utility.ts`。

#### 2. 社交事件權重

`src/constants/events/characterEvents.json` 目前有以下直接使用 `moodValue` 的事件：

| 事件                               | Mood 條件         | 權重變化 |
| ---------------------------------- | ----------------- | -------- |
| `environment.nearbyCharacter.chat` | `moodValue >= 45` | +8       |
| `environment.nearbyCharacter.play` | `moodValue >= 40` | +4       |
| `social.wallSlam`                  | `moodValue >= 45` | +2       |

這些是事件本身的額外權重，會和 Utility Score、人物個性、關係、冷卻時間等其他規則共同計算。

#### 3. 邀請接受判定

當角色邀請另一位角色參加活動時，被邀請者的 Mood 可能決定使用一般接受率或備用接受率 `fallbackChance`。

| 事件                               | 被邀請者的 Mood 要求                                              | 一般／備用接受率 |
| ---------------------------------- | ----------------------------------------------------------------- | ---------------- |
| `need.playAtLocation.group`        | `moodValue >= 14`，且為 `peaceful/relaxed/happy/ecstatic`         | 0.72 / 0.65      |
| `environment.nearbyCharacter.chat` | `moodValue >= 10`，且為 `nervous/peaceful/relaxed/happy/ecstatic` | 0.78 / 0.82      |
| `environment.nearbyCharacter.play` | `moodValue >= 14`，且為 `peaceful/relaxed/happy/ecstatic`         | 0.72 / 0.75      |
| `social.wallSlam`                  | `moodValue >= 25`                                                 | 0.68 / 0.25      |

Mood 只是接受條件的一部分；關係親密度、好感與社會關係也會一起判斷。不符合完整條件時不會必然拒絕，而是改用 `fallbackChance` 抽選。部分事件目前的備用接受率高於一般接受率，這是 JSON 中的真實設定。

接受判定邏輯位於 `src/services/characterEvents/acceptance.ts`。

#### 4. 活動結果分支

Mood 會影響部分活動中的隨機結果。目前實際使用 Mood 的是 `chat.argument.preference` 爭論活動：

- 被邀請者為 `nervous/upset/angry` 時，較容易選擇防衛自己的喜好，也較容易不歡而散。
- 被邀請者為 `relaxed/happy` 時，較容易考慮對方的立場並達成共識。

Mood 在這裡調整的是分支權重，而不是直接指定結果。

#### 5. 對話條件

對話系統支援使用 `initiatorMoods` 和 `targetMoods` 限制可選台詞，但目前對話 JSON 尚未實際設定這兩個欄位。因此這項能力已存在，現階段尚未影響遊戲中的台詞選擇。

相關邏輯位於 `src/constants/dialogueEvents.ts`。

### Mood 如何改變

活動可以透過以下欄位改變 Mood：

- `moodValueDelta`：在目前數值上增加或減少指定值。
- `moodStageTarget`：直接將數值設為指定 Mood 階段的最低值。
- `characterMoodValueDelta`：角色請求完成後套用的 Mood 增減效果。

單人玩耍完成時會增加 18 Mood。許多聊天、玩耍及社交活動也在 `characterEvents.json` 中設定了 Mood 增減效果。離線模擬同樣會計算並保存活動造成的 Mood 變化。

### 自然衰減現況

角色 Tick 每 1000 毫秒執行一次，但目前 `src/stateMachines/gameFlow/children/character.ts` 中的每 Tick `moodValue - 1` 已被註解，實際執行時會保留原值。因此 Mood **目前不會隨時間自然下降**，只會被活動或角色請求效果改變。

### 目前不受 Mood 影響的項目

- Mood 不會自動切換角色的 `expressionPresetId`，所以不會直接改變角色表情。
- 一般遊戲畫面目前沒有獨立使用 Mood 顯示；地圖除錯面板會顯示 `moodValue` 與邀請條件。
- Mood 不會直接修改角色關係、親密度或記憶；它只能影響事件與活動結果，而那些結果可能再改變關係資料。
