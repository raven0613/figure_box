大量新增活動時，優先用現有三個 activity type 表達：

chat：聊天、討論、互動對話類
playWithItem：拿某物、玩某物、使用某物
playAtLocation：去某地、在某處一起做事
只要能歸到這三種，offline 幾乎不用再改。等你真的覺得某一類行為已經有固定規則，例如「eatAtLocation」、「workAtLocation」、「giftItem」，再新增 activity type 和對應 resolver。

新增 activity 會自動被 offline 系統辨識，只要：

- 放在事件的 presentationVariants 內。
- type 是目前支援的 chat、playWithItem 或 playAtLocation。
- 活動有符合 JSON schema 的 group、cooldowns 等必要欄位。
- 若有 rolls，依順序配置，終局 roll 使用 resolvesActivity: true。
- 終局 branch 的 effects 會自動套用。
- variant 或終局 branch 可設定 offlineRecap；沒設定則使用活動類型的通用文案。

仍不會自動處理的是：
新的 activity type。
新的 effect 類型。
新的 rule path/operator。
表演本身。Offline 只計算結果，不播放 characterPerformances。
因此以目前相同 JSON 架構新增活動，offline log 和結算會自動知道。
