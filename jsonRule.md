大量新增活動時，優先用現有三個 activity type 表達：

chat：聊天、討論、互動對話類
playWithItem：拿某物、玩某物、使用某物
playAtLocation：去某地、在某處一起做事
只要能歸到這三種，offline 幾乎不用再改。等你真的覺得某一類行為已經有固定規則，例如「eatAtLocation」、「workAtLocation」、「giftItem」，再新增 activity type 和對應 resolver。
