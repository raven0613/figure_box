# `characterEvents.json` 與 `characterPerformances.json` 填寫指南

本文件依照目前專案中的型別、JSON parser、事件決策器、活動協調器與表演 runner 整理。若文件與實作不一致，應以 parser 與實際消費程式碼為準。

> 檔名是 `characterPerformances.json`，不是 `characterPerformances.js`。

## 1. 兩份 JSON 各自負責什麼

| 檔案                                              | 主要責任                                                                                                       |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `src/constants/events/characterEvents.json`       | 決定角色「何時想做什麼」、候選權重、活動規則、邀請與加入條件、冷卻、活動結果、角色狀態與關係變化、離線摘要     |
| `src/constants/events/characterPerformances.json` | 決定事件或活動在各階段「如何演出」，例如對話泡泡、表情、表情泡泡、地圖標籤、動畫、對話腳本與活動 roll 觸發時機 |

兩者以 `performanceId` 串接：

```text
characterEvents.json
  presentationVariants[].performanceId
  activity.rolls[].branches[].performanceId
  card.performanceId
            │
            ▼
characterPerformances.json
  [].id
```

一般新增活動的順序：

1. 在 `characterEvents.json` 新增事件 definition。
2. 在 `presentationVariants` 內新增一個或多個外觀／活動版本。
3. 若要播放演出，設定 `performanceId`。
4. 在 `characterPerformances.json` 新增同名 `id`。
5. 依活動生命週期填入 `proposal`、`accepted`、`active`、`end` 等 steps。
6. 若活動有隨機結果，在 event activity 內定義 `rolls`，並在 performance 中用 `type: "roll"` 觸發。

## 2. JSON 與 parser 的共同規則

- 最外層必須是陣列。
- JSON 不支援註解、尾逗號、單引號或未加引號的 key。
- 所有 `id` 應使用穩定且可讀的 dot notation，例如 `social.chat.casual`。
- event definition `id` 不可重複。
- 同一 event 的 `presentationVariants[].id` 不可重複。
- performance definition `id` 不可重複。
- 同一 activity 的 `rolls[].id` 不可重複；同一 roll 的 `branches[].id` 不可重複。
- parser 只挑出已知欄位，不會拒絕所有未知 key。拼錯但未被讀取的欄位可能「成功載入但完全沒效果」，這比直接報錯更危險。
- parser 會在應用程式載入相關 module 時驗證資料；型別檢查與 build 也會載入 JSON，但不會替所有跨檔案引用做完整驗證。
- `performanceId`、`dialogueScriptId`、一般字串型 `motionId` 等引用不一定在 event parser 階段驗證存在性，填完後仍要實際測試。

建議完成後執行：

```bash
npm run build
npm test
```

## 3. `characterEvents.json`

### 3.1 決策流程

角色決策不是把所有 event 放在同一個抽獎池，而是兩層抽選：

1. 先依 utility score 抽出 `motivation`。
2. 再從該 motivation 的候選 event 中，依計算後權重抽出 event。
3. event 若有 `presentationVariants`，再依 variant 權重抽一個版本。

目前 utility score 包含：

- `idle`
- `findFood`
- `play`
- `chat`

雖然 TypeScript context 另有 `goHome`，目前 JSON parser 的 motivation 白名單不接受 `goHome`。

event 權重公式：

```text
sourceWeight =
  有 weightSource ? utilityScores[weightSource] : baseWeight

rawWeight = max(baseWeight, sourceWeight + (addWeight ?? 0))
modifiedWeight = 依序套用 weightModifiers
repeatAdjustedWeight = modifiedWeight × 活動重複懲罰
finalWeight = 有 maxWeight ? min(maxWeight, repeatAdjustedWeight) : repeatAdjustedWeight
```

只有最終權重大於 `0` 的 event 會成為候選。

### 3.2 Event definition 頂層欄位

```json
{
  "id": "environment.nearbyCharacter.chat",
  "bucketId": "environment",
  "motivation": "chat",
  "characterEvent": {
    "type": "startActivity"
  },
  "baseWeight": 0,
  "weightSource": "chat",
  "addWeight": 10,
  "maxWeight": 100,
  "requiresNearbyCharacter": true,
  "conditionMode": "all",
  "conditions": [],
  "weightModifiers": [],
  "presentationVariants": [],
  "acceptance": {},
  "interruptPolicy": "soft",
  "commitment": 20,
  "card": {},
  "offlineRecap": {},
  "onInterrupted": [],
  "onInterruptRejected": []
}
```

| Key                       | 必填 | 型別／可用值                                | 功能與影響                                                                       |
| ------------------------- | ---- | ------------------------------------------- | -------------------------------------------------------------------------------- |
| `id`                      | 是   | 非空字串                                    | event 的唯一識別碼，也會存進 `sourceEventId`，供活動查找、冷卻與離線系統使用     |
| `bucketId`                | 是   | `baseline`、`need`、`environment`、`global` | 候選來源分類；`global` bucket 只有輸入含 `globalEventTags` 時才會收集            |
| `motivation`              | 是   | `idle`、`findFood`、`play`、`chat`          | event 所屬的第一層動機抽選群組                                                   |
| `characterEvent`          | 是   | object                                      | event 選中後送給角色 state machine 的動作                                        |
| `baseWeight`              | 是   | finite number                               | 最低候選權重。頂層 parser 允許負數，但最終權重 `<= 0` 仍會被排除，建議使用非負數 |
| `weightSource`            | 否   | motivation 值                               | 以指定 utility score 作為動態權重來源                                            |
| `addWeight`               | 否   | finite number                               | 加在來源權重上；沒有 `weightSource` 時等於加在 `baseWeight` 上                   |
| `maxWeight`               | 否   | finite number                               | 最終權重上限                                                                     |
| `requiresNearbyCharacter` | 否   | boolean                                     | `true` 時，附近沒有角色便不建立候選                                              |
| `conditionMode`           | 否   | `all`、`some`                               | `conditions` 的 AND／OR 模式；省略時等同 `all`                                   |
| `conditions`              | 否   | rule array                                  | 決定 event 是否有資格進入候選池                                                  |
| `weightModifiers`         | 否   | modifier array                              | 條件成立時調整 event 權重                                                        |
| `presentationVariants`    | 否   | variant array                               | event 選中後，再抽選具體演出與 activity 設定                                     |
| `acceptance`              | 否   | object                                      | 群體邀請時，被邀請者是否接受                                                     |
| `interruptPolicy`         | 否   | `none`、`soft`、`always`、`critical`        | parser 會保留，但目前專案沒有其他程式讀取，現在不影響中斷行為                    |
| `commitment`              | 否   | finite number                               | parser 會保留，但目前沒有其他程式讀取，現在不影響決策                            |
| `card`                    | 否   | object                                      | 提供可由 UI／上帝操作使用的事件卡資訊                                            |
| `offlineRecap`            | 否   | object                                      | offline simulation 的摘要模板                                                    |
| `onInterrupted`           | 否   | transition variant array                    | parser 會保留，但目前沒有其他程式讀取                                            |
| `onInterruptRejected`     | 否   | transition variant array                    | parser 會保留，但目前沒有其他程式讀取                                            |

### 3.3 `bucketId`

| 值            | 用途                                                                     |
| ------------- | ------------------------------------------------------------------------ |
| `baseline`    | 永遠可考慮的保底行為，例如 idle                                          |
| `need`        | 飢餓、休息、玩樂等內在需求                                               |
| `environment` | 依附近角色、物品或活動觸發                                               |
| `global`      | 依世界事件 tag 觸發；沒有 `input.globalEventTags` 時整個 bucket 不會執行 |

`bucketId` 本身不直接改權重；它主要決定何時、從哪一組 definition 收集候選。

### 3.4 `characterEvent`

#### `goIdle`

```json
{ "type": "goIdle" }
```

讓角色進入 idle。

#### `goHome`

```json
{ "type": "goHome" }
```

讓角色回公寓。常用條件限制角色目前必須位於地圖：

```json
{
  "path": "character.presence.kind",
  "operator": "==",
  "value": "positioned"
}
```

#### `goEat`

```json
{
  "type": "goEat",
  "target": "randomDestination.findFood"
}
```

`target` 可填：

- `"randomDestination.findFood"`：找隨機進食目的地。
- `{ "x": 10, "y": 20 }`：固定座標，`x`、`y` 必須是 finite number。

#### `startActivity`

```json
{ "type": "startActivity" }
```

建立 `presentationVariants[].activity` 所定義的活動。若抽中的 variant 沒有 `activity`，便沒有可啟動的活動設定。

#### `joinActivity`

```json
{
  "type": "joinActivity",
  "target": "nearbyJoinableActivity",
  "motivation": "chat"
}
```

| Key          | 必填 | 影響                                                   |
| ------------ | ---- | ------------------------------------------------------ |
| `target`     | 是   | 目前只能是 `nearbyJoinableActivity`                    |
| `motivation` | 否   | 限制要加入的活動動機／類型選擇；可用 motivation 白名單 |

附近沒有可加入活動時，這類 event 會自動排除。

### 3.5 條件規則：`conditions`

```json
{
  "conditionMode": "all",
  "conditions": [
    {
      "path": "input.nearbyCharacterCount",
      "operator": ">",
      "value": 0
    }
  ]
}
```

每條規則包含：

| Key        | 必填 | 功能                                                            |
| ---------- | ---- | --------------------------------------------------------------- |
| `path`     | 是   | 從規則 context 讀取實際值                                       |
| `operator` | 是   | 比較方式                                                        |
| `value`    | 是   | 預期值；可為 string、number、boolean、null 或以上型別組成的陣列 |

`conditionMode`：

- `all` 或省略：所有條件都成立。
- `some`：至少一條成立。
- 沒有條件或空陣列：視為成立。

可用 operator：

| Operator             | 語意                                 | 適合範例                   |
| -------------------- | ------------------------------------ | -------------------------- |
| `==`                 | 嚴格相等                             | mood 等於 `happy`          |
| `!=`                 | 嚴格不相等                           | feeling 不是 `hate`        |
| `>`、`>=`、`<`、`<=` | 轉成 number 後比較                   | moodValue、intimacy、count |
| `in`                 | 實際值是否存在於 `value` 陣列        | mood 是否在多個允許值中    |
| `includes`           | 實際值必須是陣列，檢查是否含 `value` | `ownItemIds` 是否含某物品  |

#### 建議使用的 event rule paths

parser 只檢查 path 是否以 `character.`、`utility.` 或 `input.` 開頭；拼錯後通常只會讀到 `undefined`。以下是目前實作確定提供的主要 path。

`character.*`：

- `character.id`
- `character.name`
- `character.personality.socialTendency`
- `character.personality.initiative`
- `character.personality.activityPace`
- `character.personality.emotionalExpression`
- `character.personality.noveltyPreference`
- `character.personality.interpersonalAttitude`
- `character.status.mood`
- `character.status.moodValue`
- `character.status.saturation`
- `character.status.playNeed`
- `character.status.hungerThreshold`
- `character.presence.kind`
- `character.presence.spaceId`
- `character.position.x`
- `character.position.y`
- `character.currentMotivation`
- `character.controlState`
- `character.heldItem.definitionId`
- `character.ownItems`
- `character.locks.bodyAction` 等 CharacterContext 內存在的路徑

`utility.*`：

- `utility.idle`
- `utility.findFood`
- `utility.play`
- `utility.chat`
- `utility.goHome`

`input.*`：

- `input.nearbyCharacterIds`
- `input.nearbyCharacterCount`
- `input.nearbyRelationshipFeelings`
- `input.nearbyRelationshipIntimacies`
- `input.nearbySocialStatuses`
- `input.nearbyJoinableActivityCount`
- `input.nearbyVisibleItemDefinitionIds`
- `input.nearbyVisibleItemCategories`
- `input.nearbyVisibleItemTags`
- `input.nearbyVisibleItemRarities`
- `input.nearbyVisibleItemCount`
- `input.ownItemIds`
- `input.ownItemCount`
- `input.globalEventTags`

範例：

```json
{
  "path": "input.ownItemIds",
  "operator": "includes",
  "value": "toy-ball"
}
```

### 3.6 `weightModifiers`

格式是在普通 rule 上增加 `add` 和／或 `multiplier`：

```json
{
  "path": "character.status.moodValue",
  "operator": "<",
  "value": 35,
  "multiplier": 1.5,
  "add": 8
}
```

條件成立時：

```text
newWeight = max(0, oldWeight × (multiplier ?? 1) + (add ?? 0))
```

modifier 會依陣列順序套用，因此同時使用多個 modifier 時，順序可能改變結果。

### 3.7 `presentationVariants`

event 選中後，會從符合條件且權重大於 `0` 的 variant 中再做一次加權抽選。

```json
{
  "id": "chat.casual",
  "baseWeight": 10,
  "conditionMode": "all",
  "conditions": [],
  "weightModifiers": [],
  "presentationTags": ["expressionBubble.laugh", "motion.turn"],
  "performanceId": "social.chat.casual",
  "offlineRecap": {
    "summary": "{participantNameList} 聊了起來。"
  },
  "activity": {}
}
```

| Key                | 必填 | 功能                                                                      |
| ------------------ | ---- | ------------------------------------------------------------------------- |
| `id`               | 是   | variant 在該 event 內的唯一 ID；會存入 `selectedPresentationVariantId`    |
| `baseWeight`       | 是   | variant 抽選基礎權重                                                      |
| `conditionMode`    | 否   | `all`／`some`                                                             |
| `conditions`       | 否   | 是否可選此 variant                                                        |
| `weightModifiers`  | 否   | 調整 variant 權重                                                         |
| `presentationTags` | 否   | 任意字串陣列，目前只記錄在 decision/debug 資料，沒有通用 runtime renderer |
| `performanceId`    | 否   | 對應 `characterPerformances.json` 的 definition `id`                      |
| `offlineRecap`     | 否   | 此 variant 的離線摘要，通常比 event 層更具體                              |
| `activity`         | 否   | 要建立的多人／可觀察活動規則                                              |

如果所有 variant 都不符合條件或權重皆 `<= 0`，event 仍可能被選中，但不會有 selected variant，也不會取得 variant activity/performance。

### 3.8 `activity`

建議優先使用現有三種 activity type：

| Type             | 適合用途                   |
| ---------------- | -------------------------- |
| `chat`           | 聊天、討論、社交互動       |
| `playWithItem`   | 拿某物、玩某物、使用某物   |
| `playAtLocation` | 去某處或在某地一起進行活動 |

只要能歸入這三類，現有 live 與 offline 流程較能直接處理。新增新的 activity type 需要同步修改型別、parser、live resolver 與 offline resolver。

完整結構：

```json
{
  "key": "chat.casual",
  "type": "chat",
  "startPhase": "active",
  "destination": "randomDestination.play",
  "availability": {
    "timeOfDay": ["morning", "afternoon"],
    "timeWindows": [{ "from": "09:00", "to": "12:00" }]
  },
  "group": {
    "inviteNearbyRange": 4,
    "minParticipants": 2,
    "maxParticipants": 4
  },
  "joinable": true,
  "durationMs": 20000,
  "refreshDurationOnJoin": true,
  "joinWindowMs": 8000,
  "joinRequirements": {
    "type": "none"
  },
  "cooldowns": {},
  "effects": {},
  "effectsByRole": {},
  "dialogueScriptId": "activity-chat-script",
  "dialogueSubjectSelection": {},
  "rolls": []
}
```

| Key                        | 必填 | 功能與影響                                                                                                                                                                                  |
| -------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `key`                      | 是   | 活動種類的穩定識別碼，寫入 runtime activity 的 `activityKey`                                                                                                                                |
| `type`                     | 是   | `chat`、`playWithItem`、`playAtLocation`                                                                                                                                                    |
| `startPhase`               | 否   | `active` 或 `traveling`；省略時，有 `destination` 為 `traveling`，否則為 `active`                                                                                                           |
| `destination`              | 否   | `"randomDestination.play"`、`"randomDestination.coffee"`、`"randomDestination.sketch"`、`"randomDestination.jogging"`、`"randomDestination.photography"`，或 `{ "x": number, "y": number }` |
| `availability`             | 否   | 活動可用時段。目前由 offline simulation 使用；live town activity 流程尚未套用                                                                                                               |
| `group`                    | 是   | 邀請距離與人數                                                                                                                                                                              |
| `joinable`                 | 否   | live town activity 必須明確設為 `true` 才會建立；省略或 `false` 時 starter 會立即結束該 activity                                                                                            |
| `durationMs`               | 是   | 活動 phase 的持續時間，必須 `>= 0`                                                                                                                                                          |
| `refreshDurationOnJoin`    | 否   | 新角色加入時是否把結束時間重設為「現在 + duration」                                                                                                                                         |
| `joinWindowMs`             | 否   | 邀請／加入窗口時間，必須 `>= 0`                                                                                                                                                             |
| `joinRequirements`         | 否   | 加入活動的物品要求；省略等同 `{ "type": "none" }`                                                                                                                                           |
| `cooldowns`                | 是   | 發起者、受邀者、配對與重複活動冷卻                                                                                                                                                          |
| `effects`                  | 否   | 活動正常完成後，所有參與者共用的效果                                                                                                                                                        |
| `effectsByRole`            | 否   | 正常完成後，依 initiator／target 覆寫共用效果                                                                                                                                               |
| `dialogueScriptId`         | 否   | 地圖上可觀察活動使用的 dialogue script                                                                                                                                                      |
| `dialogueSubjectSelection` | 否   | 對話前從角色記憶挑選談論對象                                                                                                                                                                |
| `rolls`                    | 否   | 活動中的加權分支與終局結果                                                                                                                                                                  |

#### `availability`

```json
{
  "timeOfDay": ["morning", "evening"],
  "timeWindows": [{ "from": "22:00", "to": "02:00" }]
}
```

- `timeOfDay` 目前 parser 接受任意非空／空字串陣列，沒有 enum 驗證；建議沿用 `morning`、`afternoon`、`evening`、`night`。
- `timeWindows[].from`、`to` 必須是 24 小時制 `HH:mm`。
- `from` 不可等於 `to`。
- 跨午夜可用 `22:00` 到 `02:00`。
- `availability` 至少要有非空 `timeOfDay` 或 `timeWindows`。
- 目前這些限制會影響 offline simulation；live town 決策尚未依時段排除 activity。

#### `group`

| Key                 | 預設              | 功能                             |
| ------------------- | ----------------- | -------------------------------- |
| `inviteNearbyRange` | 呼叫端常視為 `0`  | 以地圖格距離搜尋邀請對象         |
| `minParticipants`   | `1`               | 活動成立與持續所需最少人數       |
| `maxParticipants`   | `minParticipants` | 活動人數上限；實際值不會小於 min |

三者 parser 只接受非負數，但沒有強制整數。這些是人數與格數，應填非負整數。

`minParticipants > 1` 或 `maxParticipants > 1` 時會走群組邀請流程。

#### `joinRequirements`

無條件：

```json
{ "type": "none" }
```

需要物品：

```json
{
  "type": "hasItem",
  "itemId": "toy-ball",
  "scope": "host"
}
```

| Key      | 功能                                    |
| -------- | --------------------------------------- |
| `type`   | `none` 或 `hasItem`                     |
| `itemId` | `hasItem` 必填，對應 item definition ID |
| `scope`  | `joiner` 或 `host`；省略預設 `joiner`   |

- `joiner`：每位要加入的人都必須持有該 item。
- `host`：只要求活動發起者持有，受邀者不必持有。

#### `cooldowns`

```json
{
  "selfMs": 12000,
  "targetMs": 9000,
  "pairMs": 35000,
  "category": "social",
  "repeatPenalty": {
    "windowMs": 120000,
    "weightMultiplierPerRepeat": 0.4,
    "maxRepeats": 3
  }
}
```

| Key                                       | 功能                                         |
| ----------------------------------------- | -------------------------------------------- |
| `selfMs`                                  | 發起者在同 category 內不能再次發起的時間     |
| `targetMs`                                | 受邀者在同 category 內的冷卻時間             |
| `pairMs`                                  | 同一對角色在同 category 內不能再次配對的時間 |
| `category`                                | 共用冷卻分類；省略時為 `activity`            |
| `repeatPenalty.windowMs`                  | 在此時間窗內計算連續重複次數                 |
| `repeatPenalty.weightMultiplierPerRepeat` | 每次重複把候選權重乘上的倍率，範圍 `0..1`    |
| `repeatPenalty.maxRepeats`                | 計算倍率時最多採用幾次重複                   |

重複倍率：

```text
multiplier = weightMultiplierPerRepeat ^ repeatCount
```

多人候選時，系統會取各可用 target 倍率的平均值。

注意：目前冷卻設定是從 event 中「第一個帶 activity 的 variant」取得。若同一 event 的不同 variant 使用不同 cooldown，實際冷卻可能不符合抽中的 variant。建議同一 event 的 variants 共用相同 cooldown，或拆成不同 event。

### 3.9 `effects` 與 `effectsByRole`

```json
{
  "effects": {
    "relationshipIntimacyDelta": 1,
    "relationshipFeelingTarget": "warm",
    "moodValueDelta": 10,
    "moodStageTarget": "happy",
    "playNeedDelta": -35
  },
  "effectsByRole": {
    "initiator": {
      "moodValueDelta": 5
    },
    "target": {
      "relationshipIntimacyDelta": -1
    }
  }
}
```

| Key                         | 功能                                                                     |
| --------------------------- | ------------------------------------------------------------------------ |
| `relationshipIntimacyDelta` | 增減對另一位參與者的親密度                                               |
| `relationshipFeelingTarget` | 直接把 feeling 設為指定值                                                |
| `moodValueDelta`            | 增減 moodValue，最後限制在 `0..100`，並重新計算 mood                     |
| `moodStageTarget`           | 直接把 moodValue 設為該 mood 階段的最低值；存在時優先於 `moodValueDelta` |
| `playNeedDelta`             | 增減 playNeed，最後限制在 `0..100`                                       |

共用 `effects` 先套用，再由 `effectsByRole[role]` 以 key 覆寫。不是將同一 key 相加。

例如 shared `moodValueDelta: 10`，target role 又有 `moodValueDelta: -2`，target 最終使用 `-2`，不是 `8`。

Feeling 可用值：

```text
hate, dislike, wary, neutral, warm, like, fond,
secret_crush, open_crush, love
```

Mood 可用值：

```text
ecstatic, happy, relaxed, peaceful, nervous,
sad, upset, heartbroken, angry, afraid
```

### 3.10 `acceptance`

```json
{
  "minMoodValue": 20,
  "allowedMoods": ["peaceful", "relaxed", "happy", "ecstatic"],
  "relationships": [
    {
      "minIntimacy": 0,
      "maxIntimacy": 100,
      "allowedFeelings": ["neutral", "warm", "like"],
      "allowedSocialStatuses": ["stranger", "acquaintance", "friend"]
    }
  ],
  "baseChance": 0.75,
  "fallbackChance": 0.25,
  "weightModifiers": [
    {
      "path": "character.personality.socialTendency",
      "operator": ">=",
      "value": 4,
      "multiplier": 1.2
    }
  ]
}
```

系統先判斷受邀者是否同時符合：

1. `minMoodValue`。
2. `allowedMoods`。
3. `relationships` 中至少一組完整符合。

符合時以 `baseChance` 作為基礎接受機率，省略等同 `1`；不符合時改用
`fallbackChance`，省略等同 `0`。接著依序套用 `weightModifiers`，最後把機率限制
在 `0..1` 並進行隨機判定。

`acceptance.weightModifiers` 使用和 event 頂層 `weightModifiers` 相同的規則格式。此處的
`character` 是受邀者，`utility` 是受邀者目前的需求分數；邀請判定沒有額外感知輸入，
所以 `input.*` 會是空陣列或 `0`，通常不應用來調整接受機率。

| Key                                     | 限制                                                   |
| --------------------------------------- | ------------------------------------------------------ |
| `minMoodValue`                          | 必須 `>= 0`；parser 沒限制最大 100                     |
| `allowedMoods`                          | 必須使用 Mood enum                                     |
| `relationships[].minIntimacy`           | finite number                                          |
| `relationships[].maxIntimacy`           | finite number                                          |
| `relationships[].allowedFeelings`       | 必須使用 Feeling enum                                  |
| `relationships[].allowedSocialStatuses` | 必須使用 SocialStatus enum                             |
| `baseChance`                            | 符合心情與關係要求時的基礎接受機率，`0..1`，省略為 `1` |
| `fallbackChance`                        | `0..1`                                                 |
| `weightModifiers`                       | 依受邀者狀態、需求或 personality 調整接受機率          |

SocialStatus 可用值：

```text
hostile, distant, stranger, acquaintance, friendly,
friend, close_friend, best_friend, lovers, married
```

### 3.11 `dialogueSubjectSelection`

用於活動被觀察時，先從某位參與者的 relationship memories 中選出可談論的第三人。

```json
{
  "sourceRole": "initiator",
  "memoryType": "impression",
  "minCount": 1,
  "count": 1,
  "excludeParticipants": true
}
```

| Key                   | 必填 | 功能                                                  |
| --------------------- | ---- | ----------------------------------------------------- |
| `sourceRole`          | 是   | 從 `initiator` 或 `target` 的記憶挑選                 |
| `memoryType`          | 是   | `impression`、`argument`、`fight`、`kiss`、`wallSlam` |
| `minCount`            | 是   | 記憶次數至少多少，允許 `0`                            |
| `count`               | 是   | 要選幾個主題，必須 `> 0`                              |
| `excludeParticipants` | 否   | 是否排除本活動參與者，預設 `true`                     |

如果可用 subject 少於 `count`，觀察對話不會開啟。

### 3.12 `rolls`

`rolls` 是活動中的加權分支。每個 roll 可有多個 branch：

```json
{
  "id": "argumentResult",
  "resolvesActivity": true,
  "branches": [
    {
      "id": "agreed",
      "baseWeight": 50,
      "conditionMode": "all",
      "conditions": [],
      "weightModifiers": [],
      "performanceId": "social.chat.argument.preference.agreed",
      "effects": {},
      "effectsByRole": {},
      "memoryEffects": [],
      "offlineRecap": {}
    }
  ]
}
```

#### Roll 欄位

| Key                | 必填 | 功能                                      |
| ------------------ | ---- | ----------------------------------------- |
| `id`               | 是   | performance `roll` step 使用的 `rollId`   |
| `resolvesActivity` | 否   | `true` 表示此 roll 選出 branch 後結束活動 |
| `branches`         | 是   | 非空分支陣列                              |

#### Branch 欄位

| Key                | 必填 | 功能                                                                    |
| ------------------ | ---- | ----------------------------------------------------------------------- |
| `id`               | 是   | 結果 ID；後續 roll 可由 `activity.rolls.<rollId>.selectedBranchId` 讀取 |
| `baseWeight`       | 是   | 非負權重                                                                |
| `resolvesActivity` | 否   | 單一 branch 可提前結束活動                                              |
| `conditionMode`    | 否   | `all`／`some`                                                           |
| `conditions`       | 否   | branch 是否可進候選                                                     |
| `weightModifiers`  | 否   | 調整 branch 權重                                                        |
| `performanceId`    | 否   | 選中 branch 後播放的 performance                                        |
| `effects`          | 否   | 終局結果的共用效果                                                      |
| `effectsByRole`    | 否   | 終局結果的角色效果                                                      |
| `memoryEffects`    | 否   | 終局結果寫入關係記憶                                                    |
| `offlineRecap`     | 否   | 此結果的離線摘要                                                        |

若 roll 本身不是 `resolvesActivity: true`，branch 也沒有 `resolvesActivity: true`，該 branch 不可包含 `effects`、`effectsByRole` 或 `memoryEffects`，否則 parser 會報錯。

#### Activity roll rule paths

roll 規則 path 必須以 `initiator.`、`target.` 或 `activity.` 開頭。

目前 context 的主要欄位：

```text
initiator.status.mood
initiator.status.moodValue
initiator.personality.socialTendency
initiator.personality.initiative
initiator.personality.activityPace
initiator.personality.emotionalExpression
initiator.personality.noveltyPreference
initiator.personality.interpersonalAttitude
initiator.relationshipToTarget.feeling
initiator.relationshipToTarget.intimacy
initiator.relationshipToTarget.socialStatus
initiator.relationshipToTarget.memories.impression

target.status.mood
target.status.moodValue
target.personality.<上述 personality key>
target.relationshipToInitiator.feeling
target.relationshipToInitiator.intimacy
target.relationshipToInitiator.socialStatus
target.relationshipToInitiator.memories.impression

activity.participantCount
activity.rollContext.<dialogue 傳入的 key>
activity.rolls.<rollId>.selectedBranchId
activity.rolls.<rollId>.rollContext.<key>
```

非終局 roll 的結果可影響後續 roll：

```json
{
  "path": "activity.rolls.argumentReaction.selectedBranchId",
  "operator": "==",
  "value": "considerOtherSide"
}
```

#### `memoryEffects`

```json
{
  "recipientRole": "both",
  "target": "otherParticipant",
  "memoryType": "argument",
  "countDelta": 1,
  "startedByRole": "initiator"
}
```

| Key             | 必填 | 功能                                                                |
| --------------- | ---- | ------------------------------------------------------------------- |
| `recipientRole` | 是   | `initiator`、`target` 或 `both`，誰要記住                           |
| `target`        | 是   | `otherParticipant` 或 `dialogueSubject`，記憶指向誰                 |
| `memoryType`    | 是   | MemoryType enum                                                     |
| `countDelta`    | 是   | 必須 `> 0`；目前不能用此欄位減少記憶                                |
| `startedByRole` | 否   | `initiator` 或 `target`；省略時 runtime 以 initiator 作為 startedBy |

使用 `target: "dialogueSubject"` 時，若活動沒有成功選到 subject，就不會寫入該筆記憶。

### 3.13 `offlineRecap`

可放在：

- event definition
- presentation variant
- activity roll branch

格式：

```json
{
  "summary": "{participantNameList} 一起聊了天。",
  "detail": "兩人的距離稍微拉近了。",
  "quote": "下次再聊。",
  "priority": 10,
  "sequenceKey": "chat-story",
  "sequenceOrder": 1
}
```

所有 key 都可省略，但 object 至少要有一個有效欄位。

| Key             | 功能                      |
| --------------- | ------------------------- |
| `summary`       | 簡短摘要                  |
| `detail`        | 詳細描述                  |
| `quote`         | 可顯示的引言              |
| `priority`      | 摘要排序／挑選優先度      |
| `sequenceKey`   | 把多筆 recap 串成同一序列 |
| `sequenceOrder` | 序列中的順序              |

活動可沿用 offline 系統的前提：

- activity 放在 `presentationVariants` 內。
- `type` 是 `chat`、`playWithItem` 或 `playAtLocation`。
- `group`、`cooldowns` 等必要欄位通過 parser。
- 有 rolls 時，依流程配置；終局 roll 或 branch 設 `resolvesActivity: true`。
- 共用結果放 `effects`，角色差異放 `effectsByRole`。
- Offline 只計算與摘要結果，不播放 `characterPerformances.json`。

### 3.14 其他頂層物件

#### `card`

```json
{
  "label": "壁咚",
  "promptTemplate": "{initiator} 壁咚 {target}",
  "participantMode": "initiatorTarget",
  "performanceId": "social.wallSlam"
}
```

| Key               | 必填 | 功能                                    |
| ----------------- | ---- | --------------------------------------- |
| `label`           | 是   | 卡片顯示名稱                            |
| `promptTemplate`  | 是   | 帶 `{initiator}`、`{target}` 的操作描述 |
| `participantMode` | 是   | 目前只能是 `initiatorTarget`            |
| `performanceId`   | 是   | 卡片執行時的 performance                |

#### `onInterrupted`、`onInterruptRejected`

元素沿用 presentation variant 欄位，另外可填：

```json
{
  "dialogueGroupId": "changed_mind_from_food"
}
```

目前 parser 會驗證並保留這些設定，但專案內尚未找到執行它們的 runtime 消費端，因此現階段不應依賴它們播放內容。

### 3.15 目前已知但不生效的 event 設定

- `interruptPolicy`
- `commitment`
- `onInterrupted`
- `onInterruptRejected`
- `presentationTags` 除了 decision/debug 顯示之外沒有通用效果執行器

## 4. `characterPerformances.json`

### 4.1 Definition 結構

```json
{
  "id": "social.chat.casual",
  "steps": [
    {
      "phase": "proposal",
      "type": "bubble",
      "target": "initiator",
      "text": "{initiator}：要聊一下嗎？",
      "delayMs": 0,
      "durationMs": 3200
    }
  ]
}
```

| Key     | 必填 | 功能                                                             |
| ------- | ---- | ---------------------------------------------------------------- |
| `id`    | 是   | 唯一 performance ID，供 event、variant、roll branch 或 card 引用 |
| `steps` | 是   | 演出步驟陣列；parser 允許空陣列                                  |

同一 phase 的 steps 不是按陣列順序逐一等待，而是全部以各自 `delayMs` 排程。若希望 A 播完再播 B，必須自行把 B 的 `delayMs` 設為 A 的 delay + duration。

例如：

```json
[
  {
    "phase": "active",
    "type": "bubble",
    "target": "initiator",
    "text": "第一句",
    "delayMs": 0,
    "durationMs": 2000
  },
  {
    "phase": "active",
    "type": "bubble",
    "target": "target",
    "text": "第二句",
    "delayMs": 2200,
    "durationMs": 2000
  }
]
```

### 4.2 共用 step 欄位

一般 step：

```json
{
  "phase": "active",
  "type": "expression",
  "target": "both",
  "participantCount": {
    "min": 2,
    "max": 4
  },
  "delayMs": 1000,
  "durationMs": 3000
}
```

| Key                | 必填             | 功能                                                                         |
| ------------------ | ---------------- | ---------------------------------------------------------------------------- |
| `phase`            | 是               | 此 step 在哪個生命週期階段播放                                               |
| `type`             | 是               | step 種類                                                                    |
| `target`           | 大多數 type 必填 | `initiator`、`target`、`both`；animation 另支援 `heldItem`；roll 不填 target |
| `participantCount` | 否               | 只在活動播放流程中依參與者總數過濾                                           |
| `delayMs`          | 否               | 相對 phase 開始延遲多久播放，預設 `0`，必須 `>= 0`                           |
| `durationMs`       | 否               | 顯示／動畫持續時間，必須 `>= 0`；roll 沒有此欄位                             |

`participantCount`：

- `min`、`max` 至少填一個。
- 都必須 `>= 0`。
- 同時存在時 `min <= max`。
- 建議填整數。
- 一般非 activity 的 `playPerformanceStepsById()` 不會套用此過濾；主要對 activity performance 有效。

### 4.3 `phase`

| Phase                  | 目前觸發時機                                                              |
| ---------------------- | ------------------------------------------------------------------------- |
| `proposal`             | 群組活動送出邀請時                                                        |
| `accepted`             | 至少有受邀者接受，活動準備成立時                                          |
| `rejected`             | 型別與 parser 支援；目前主要 activity invite 流程沒有使用此 generic phase |
| `rejectedBusy`         | 型別與 parser 支援；目前 activity invite resolver 沒有觸發                |
| `rejectedMood`         | 接受人數低於 `minParticipants` 時                                         |
| `active`               | 活動正式開始；roll branch performance 也固定用 `active` phase 播放        |
| `participantLeftSolo`  | 離開事件後只剩單人，或 group reaction 後恢復成單人                        |
| `participantLeftGroup` | 原本多人活動有人離開時                                                    |
| `end`                  | 活動時間到或被正常結束，且不是由 resolving roll 結束時                    |

若某 phase 沒有 steps，通常就是沒有演出。`participantLeftGroup` 是例外：完全沒有相符 step 時，runner 會播放 5 秒 surprised fallback。

### 4.4 `target`

一般互動：

| Target      | 對象         |
| ----------- | ------------ |
| `initiator` | 發起者       |
| `target`    | 對象角色     |
| `both`      | 發起者與對象 |

Activity：

| Target      | 對象                                                            |
| ----------- | --------------------------------------------------------------- |
| `initiator` | `hostCharacterIds`；沒有 host 時取第一位 participant            |
| `target`    | 非 host 的所有 participants；沒有 host 時從第二位開始           |
| `both`      | 所有 participants                                               |
| `heldItem`  | 只允許 animation；作用於 host，沒有 host 時取第一位 participant |

### 4.5 Step types

#### `bubble`

```json
{
  "phase": "active",
  "type": "bubble",
  "target": "both",
  "text": "{initiator} 正在和 {target} 聊天",
  "delayMs": 0,
  "durationMs": 3000
}
```

| Key    | 必填 | 功能                   |
| ------ | ---- | ---------------------- |
| `text` | 是   | 角色頭上的文字泡泡模板 |

模板目前支援傳入值：

- `{initiator}`：host／發起者名稱，多人 host 以 `、` 串接。
- `{target}`：非 host 參與者名稱，以 `、` 串接。
- `{dialogueSubjectName}`：有 dialogue subject 的 roll branch performance。
- 其他由呼叫端放進 `templateValues` 的 key。

未知 placeholder 不會被刪除，會原樣保留，例如 `{unknown}`。

未填 `durationMs` 時會交給 UI port 使用其預設行為；若此 step 用作 interaction bubble fallback，呼叫端另有 fallback duration。

#### `expression`

```json
{
  "phase": "active",
  "type": "expression",
  "target": "target",
  "expressionPresetId": "surprised",
  "durationMs": 3000
}
```

`expressionPresetId` 必須存在於 `src/constants/expressionPresets.json`。目前可用：

```text
normal, laugh, cry, mad, surprised, curious, smirk_smile
```

有 `durationMs` 時，時間到會重設為預設表情 `normal`；省略時不會由這個 step 自動重設。

#### `expressionBubble`

```json
{
  "phase": "active",
  "type": "expressionBubble",
  "target": "both",
  "expressionBubbleId": "laugh",
  "durationMs": 3000
}
```

目前可用：

```text
surprised, angry, laugh, sigh, play, sad,
question, sparkle_light, determined, hungry
```

省略 `durationMs` 時 runner 使用 `1200ms`。

#### `mapEffect`

```json
{
  "phase": "active",
  "type": "mapEffect",
  "target": "both",
  "effectId": "chatTogether",
  "label": "聊天中",
  "durationMs": 20000
}
```

| Key        | 必填 | 功能                                       |
| ---------- | ---- | ------------------------------------------ |
| `effectId` | 是   | 建立、更新與清除地圖活動顯示時使用的識別碼 |
| `label`    | 否   | 地圖上顯示的文字；省略時顯示 `effectId`    |

在 activity 的 `active` phase，如果 event activity 有 `dialogueScriptId`，map effect 會帶「觀察」互動入口。

`label` 支援與 bubble 相同的模板替換，例如 `{dialogueSubjectName}`。

`participantLeftGroup` 的 map effect 會為每位剩餘角色建立獨立顯示。

#### `motion`

```json
{
  "phase": "active",
  "type": "motion",
  "target": "both",
  "motionId": "face.bottom",
  "durationMs": 3000
}
```

`motionId` 只驗證為非空字串，不驗證 catalog。

**目前 runner 對 `motion` 直接 return，沒有實際播放任何動作。** 此 type 可通過 parser，但現階段是 no-op。

#### `animation`

```json
{
  "phase": "active",
  "type": "animation",
  "target": "heldItem",
  "animationId": "heldItemCelebrationAnim",
  "durationMs": 3000
}
```

目前可用 `animationId`：

```text
heldItemCelebrationAnim
characterJumpAnim
```

`target` 可用一般三種 target，另支援 `heldItem`。注意目前 `heldItem` 的 target resolution 是選 host character，實際動畫 port 如何表現持有物由 widget 實作決定。

#### `dialogue`

```json
{
  "phase": "active",
  "type": "dialogue",
  "target": "both",
  "scriptId": "activity-wall-slam-tension-choice",
  "displayMode": "ambient"
}
```

| Key               | 必填   | 功能                         |
| ----------------- | ------ | ---------------------------- |
| `dialogueGroupId` | 二擇一 | 由 dialogue group 選內容     |
| `scriptId`        | 二擇一 | 直接播放指定 dialogue script |
| `displayMode`     | 否     | `preview` 或 `ambient`       |

`dialogueGroupId` 與 `scriptId` 至少要有一個；parser 允許兩者同時存在，但通常應選一種來源避免語意不清。

Activity 的可點擊「觀察」主流程通常不是靠 performance dialogue step，而是：

```text
characterEvents.json activity.dialogueScriptId
  → active mapEffect 顯示觀察入口
  → TownActivityDialogueObserver 開啟 script
```

#### `roll`

```json
{
  "phase": "active",
  "type": "roll",
  "participantCount": {
    "min": 2
  },
  "rollId": "gossipResult",
  "delayMs": 7600
}
```

| Key      | 必填 | 功能                       |
| -------- | ---- | -------------------------- |
| `rollId` | 是   | 對應 activity `rolls[].id` |

`roll`：

- 不填 `target`。
- 不填 `durationMs`。
- 到 `delayMs` 時要求 activity resolver 抽 branch。
- 若 branch 有 `performanceId`，會以該 performance 的 `active` phase 播放。
- 若 roll 或 branch `resolvesActivity`，會停止原活動演出、播放結果 performance，等演出時間結束後套用 effects 並結束活動。
- 如果 `rollId` 找不到，runtime 不會得到有效 branch。

### 4.6 演出時間如何計算

一組 phase steps 的總時間：

```text
max(step.delayMs + step.durationMs)
```

`roll` 的 duration 視為 `0`。

這個總時間會用於：

- 等待 roll branch 結果演完後才結算。
- 等待 `end` phase 演完後清理。

因此結果 performance 若只有 bubble 但漏填 `durationMs`，計算出的演出時間可能是 `0`，系統會改用固定 fallback cleanup delay；若要精準控制結算時機，應明確填 `durationMs`。

### 4.7 完整 activity + performance 範例

`characterEvents.json`：

```json
{
  "id": "environment.nearbyCharacter.exampleChat",
  "bucketId": "environment",
  "motivation": "chat",
  "characterEvent": {
    "type": "startActivity"
  },
  "baseWeight": 0,
  "weightSource": "chat",
  "addWeight": 5,
  "maxWeight": 60,
  "requiresNearbyCharacter": true,
  "conditions": [
    {
      "path": "input.nearbyCharacterCount",
      "operator": ">",
      "value": 0
    }
  ],
  "acceptance": {
    "minMoodValue": 20,
    "fallbackChance": 0.2
  },
  "presentationVariants": [
    {
      "id": "example_chat.default",
      "baseWeight": 10,
      "performanceId": "social.chat.example",
      "offlineRecap": {
        "summary": "{participantNameList} 隨意聊了一會兒。"
      },
      "activity": {
        "key": "chat.example",
        "type": "chat",
        "startPhase": "active",
        "group": {
          "inviteNearbyRange": 3,
          "minParticipants": 2,
          "maxParticipants": 2
        },
        "joinable": true,
        "durationMs": 12000,
        "refreshDurationOnJoin": false,
        "joinWindowMs": 5000,
        "cooldowns": {
          "selfMs": 10000,
          "targetMs": 8000,
          "pairMs": 30000,
          "category": "social_example",
          "repeatPenalty": {
            "windowMs": 120000,
            "weightMultiplierPerRepeat": 0.5,
            "maxRepeats": 3
          }
        },
        "effects": {
          "relationshipIntimacyDelta": 1,
          "moodValueDelta": 2
        },
        "joinRequirements": {
          "type": "none"
        }
      }
    }
  ]
}
```

`characterPerformances.json`：

```json
{
  "id": "social.chat.example",
  "steps": [
    {
      "phase": "proposal",
      "type": "bubble",
      "target": "initiator",
      "text": "{initiator}：要聊一下嗎？",
      "durationMs": 2200
    },
    {
      "phase": "accepted",
      "type": "bubble",
      "target": "target",
      "text": "{target}：好啊。",
      "durationMs": 1800
    },
    {
      "phase": "rejectedMood",
      "type": "bubble",
      "target": "target",
      "text": "{target}：今天先不了。",
      "durationMs": 2200
    },
    {
      "phase": "active",
      "type": "mapEffect",
      "target": "both",
      "effectId": "exampleChat",
      "label": "閒聊中",
      "durationMs": 12000
    },
    {
      "phase": "active",
      "type": "expression",
      "target": "both",
      "expressionPresetId": "laugh",
      "delayMs": 1500,
      "durationMs": 2400
    },
    {
      "phase": "end",
      "type": "bubble",
      "target": "both",
      "text": "聊得真開心。",
      "durationMs": 1800
    }
  ]
}
```

## 5. 新增或修改時的檢查清單

### `characterEvents.json`

- [ ] event `id` 唯一且不會隨文案改名。
- [ ] `bucketId` 與觸發來源一致。
- [ ] `motivation` 使用 parser 實際接受的五種值。
- [ ] `characterEvent.type` 與必要 target 正確。
- [ ] `conditions` 使用確實存在的 path。
- [ ] `in` 的 `value` 是陣列；`includes` 的實際 path 是陣列。
- [ ] 權重經 `baseWeight`、`weightSource`、modifier、repeat penalty 後仍可能大於 0。
- [ ] 至少有一個 presentation variant 能符合條件且權重大於 0。
- [ ] variant `performanceId` 在 performance JSON 中存在。
- [ ] activity 有 `key`、`type`、`group`、`durationMs`、`cooldowns`。
- [ ] `minParticipants <= maxParticipants`。
- [ ] `joinRequirements.itemId` 是有效 item ID。
- [ ] 有 roll 時，performance 的 `rollId` 與 `activity.rolls[].id` 完全一致。
- [ ] 只有 resolving roll／branch 放 effects 與 memoryEffects。
- [ ] 終局 branch 有合理的結果 performance 與 offline recap。
- [ ] 沒有誤以為 interrupt 設定或 presentation tags 已有完整 runtime 效果。

### `characterPerformances.json`

- [ ] performance `id` 唯一，並與引用端完全一致。
- [ ] `phase` 確實會被目前流程觸發。
- [ ] `target` 對 activity participant 結構有正確語意。
- [ ] 連續演出已用 `delayMs` 排好，不是假設陣列會自動串行。
- [ ] `durationMs` 足以覆蓋 UI 顯示與結算等待。
- [ ] expression preset、expression bubble、animation ID 都存在。
- [ ] dialogue step 至少有 `dialogueGroupId` 或 `scriptId`。
- [ ] roll step 不含 `target`，且 `rollId` 存在。
- [ ] 沒有依賴目前仍是 no-op 的 `motion`。
- [ ] map effect 的 `effectId` 在同一活動語境下穩定，確保能正確清除。

## 6. 相關程式碼位置

| 責任                           | 檔案                                                             |
| ------------------------------ | ---------------------------------------------------------------- |
| Event 型別與資料入口           | `src/constants/charactarEventsDefinitions.ts`                    |
| Event definition parser        | `src/utils/jsonParser/definitionSchema.ts`                       |
| Action parser                  | `src/utils/jsonParser/actionSchema.ts`                           |
| Activity、effects、roll parser | `src/utils/jsonParser/activitySchema.ts`                         |
| Variant parser                 | `src/utils/jsonParser/presentationSchema.ts`                     |
| Rule parser                    | `src/utils/jsonParser/ruleSchema.ts`                             |
| Event 候選與權重               | `src/services/characterEvents/buckets.ts`                        |
| 動機與事件抽選                 | `src/services/characterEvents/decision.ts`                       |
| Rule 實際比較方式              | `src/services/ruleEvaluator.ts`                                  |
| Variant 抽選                   | `src/services/characterEvents/variants.ts`                       |
| Activity roll 抽選             | `src/services/characterEvents/activityRolls.ts`                  |
| Activity effects               | `src/services/characterEvents/activityCompletionEffects.ts`      |
| Activity runtime               | `src/services/characterEvents/joinableActivities.ts`             |
| 邀請與接受條件                 | `src/services/townActivities/TownActivityInviteResolver.ts`      |
| Performance 型別與資料入口     | `src/services/characterEvents/performances.ts`                   |
| Performance parser             | `src/services/characterEvents/performanceSchema.ts`              |
| Performance 執行器             | `src/services/characterEvents/characterPerformanceRunner.ts`     |
| Activity 表演與結算            | `src/services/townActivities/TownActivityPerformanceDirector.ts` |
| 可觀察活動對話                 | `src/services/townActivities/TownActivityDialogueObserver.ts`    |
